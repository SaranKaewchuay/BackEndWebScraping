const axios = require("axios");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { insertDataToDbScopus } = require("../scraper/insertToDb");

const batchSize = 5; 

let roundScraping = 16; 
let allAuthors = [];

const scraper = async () => {
  try {
    const allURLs = await getURLScopus();

    while (i = roundScraping  < allURLs.length) {
      const batchURLs = allURLs.slice(roundScraping, roundScraping + batchSize);
      const promises = batchURLs.map(async (url, index) => {
        const authorIndex = roundScraping + index;
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        try {
          const author = await scrapeAuthorData(url.url, page);
          const article = await scrapeArticleData(url, page , authorIndex + 1, allURLs.length);
          author.articles = article;
          allAuthors.push(author);
          await insertDataToDbScopus(author,url.name);
          roundScraping += batchSize;

        } catch (error) {
          console.error("Error occurred while scraping:", error);
          await scraper();
        } finally {
          await browser.close();
        }
      });

      await Promise.allSettled(promises);
    
    }

    console.log("Finish Scraping Scopus");
    return allAuthors;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraper();
    return []; 
  }
};

const scrapeArticleData = async (url, page , index_aouthor, lenght_author) => {
  await page.goto(url.url, { waitUntil: "networkidle2" });
  await page.waitForSelector("#preprints");
  await page.click("#preprints");
  await page.waitForTimeout(1500);
  await page.waitForSelector("#documents");
  await page.click("#documents");
  await page.waitForTimeout(1600);
  let html = await page.content();
  let link_Article = await getArticleUrl(html);

  const selector =
    "div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > els-paginator > nav > ul > li:last-child > button";

  if (await page.$(selector)) {
    while (await page.$eval(selector, (button) => !button.disabled)) {
      await page.click(selector);
      await page.waitForTimeout(1500);
      const html = await page.content();
      const link = await getArticleUrl(html);
      link_Article = [...link_Article, ...link];
    }
  }
  console.log("");
  console.log(`Scraping Author ${index_aouthor} of ${lenght_author}: ${url.name}`);
  console.log(`URL: ${url.url}`);
  console.log("Number of Articles: ", link_Article.length);
  console.log("");

  const batchSize = 5; 
  const article_detail = [];
  for (let i = 0; i < link_Article.length; i += batchSize) {
    const batchUrls = link_Article.slice(i, i + batchSize);
    const promises = batchUrls.map(async (article_url, index) => {
      // console.log("Article =", i + index + 1);
      const articlePage = await page.browser().newPage();
      await articlePage.goto(article_url, { waitUntil: "networkidle2" });
      const article_data = await getArticleDetail(articlePage, article_url);
      await articlePage.close();
      return article_data;
    });

    const results = await Promise.allSettled(promises);

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        article_detail.push(result.value);
      } else {
        console.error("Failed to scrape article:", result.reason);
      }
    });
  }

  return article_detail;
};

const scrapeAuthorData = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: "networkidle2" });
    const html = await page.content();
    const $ = cheerio.load(html);
    const author = {
      name: $(
        "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > div > h1 > strong"
      ).text(),
      citation: $(
        "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(1) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc"
      ).text(),
      citations_by: $(
        "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(1) > div > div > div:nth-child(2) > span > p > span > em > strong"
      ).text(),
      documents: $(
        "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(2) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc"
      ).text(),
      h_index: $(
        "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(3) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc"
      ).text(),
      subject_area: await scrapSubjectArea(page),
      citations_graph: await scrapCitation(url, page),
      documents_graph: await scrapDocument(url, page),
      url: url,
    };

    return author;
  } catch (error) {
    // Handle the error here
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

const getURL = async () => {
  try {
    const response = await axios.get(
      "https://iriedoc.wu.ac.th/data/apiwris/RPS_PERSON.php"
    );
    return response.data;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

const getURLScopus = async () => {
  try {
    const data = await getURL();

    const scopusArray = data
      .map((element) => ({
        name: element.TITLEENG + element.FNAMEENG + " " + element.LNAMEENG,
        url: element.SCOPUSURL,
      }))
      .filter((data) => data.url !== "1" && data.url !== "0");

    return scopusArray;
  } catch (error) {
    // Handle the error here
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

const getArticleUrl = async (html) => {
  try {
    const $ = cheerio.load(html);
    const selector =
      "div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > div:nth-child(2) > ul > li";
    const content = $(selector);
    const url_data = [];
    content.each(function () {
      const link = $(this).find("h4 > a").attr("href");
      url_data.push(link);
    });
    return url_data;
  } catch (error) {
    // Handle the error here
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

const scrapAuthorKeyword = async (html) => {
  try {
    const $ = cheerio.load(html);
    const content = $(
      "#doc-details-page-container > article > div:nth-child(4) > section > div.margin-size-16-y > div:nth-child(4) > span"
    );
    const author_keyword = [];
    content.each(function () {
      const keyword = $(this).text();
      author_keyword.push(keyword);
    });
    return author_keyword;
  } catch (error) {
    // Handle the error here
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

let sourceID = [];

const getSourceID = async (page) => {
  try {
    const selectorExists = await page.evaluate(() => {
      const element = document.querySelector("#source-preview-flyout");
      return element !== null;
    });

    if (selectorExists) {
      await page.waitForSelector("#source-preview-flyout");
      await page.click("#source-preview-flyout");
      await page.waitForTimeout(1500);
      const elementExists =
        (await page.$("#source-preview-details-link")) !== null;
      if (elementExists) {
        const html = await page.content();
        const $ = cheerio.load(html);
        const id = $("#source-preview-details-link").attr("href").split("/")[2];
        if (!sourceID.includes(id)) {
          sourceID.push(id);
          // console.log("sourceIDAll : ", sourceID);
          return id;
        } else {
          return id;
        }
      } else {
        // console.log("Element does not have ViewFullSource");
        return null;
      }
    } else {
      return null;
    }
  } catch (error) {
    // Handle the error here
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

const getArticleDetail = async (page, url) => {
  try {
    await page.waitForSelector("#show-additional-source-info");
    await page.click("#show-additional-source-info");
    await page.waitForTimeout(1000);
    const html = await page.content();

    const source_id = await scrapViewFullSource(page);
    let check_journal = false;
    if (source_id) {
      check_journal = true;
      // console.log("source_id = ",source_id)
      // await insertDataToJournal(journal);
    }

    const $ = cheerio.load(html);

    const article_data = {
      name: $(
        "#doc-details-page-container > article > div:nth-child(2) > section > div.row.margin-size-8-t > div > h2 > span"
      ).text(),
      ...(check_journal && { source_id: source_id }),
      co_author: await scrapCo_Author(html),
    };

    $(
      "#source-info-aside > div > div > div > dl, #source-info-aside > div > div > div > els-collapsible-panel > section > div > div > dl"
    ).each(function (i, element) {
      const fieldText = $(element)
        .find("dt")
        .text()
        .trim()
        .toLowerCase()
        .replace(" ", "_");
      const fieldValue = $(element).find("dd").text().trim();
      article_data[fieldText] = fieldValue;
    });

    article_data.author_keywords = await scrapAuthorKeyword(html);
    article_data.abstract = $(
      "#doc-details-page-container > article > div:nth-child(4) > section > div > div.margin-size-4-t.margin-size-16-b > p > span"
    ).text();
    article_data.url = url;

    return article_data;
  } catch (error) {
    // Handle the error here
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

const scrapViewFullSource = async (page) => {
  try {
    const source_id = await getSourceID(page);
    if (source_id) {
      return source_id;
    } else {
      return null;
    }
  } catch (error) {
    // Handle the error here
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

const scrapCo_Author = async (html) => {
  try {
    const $ = cheerio.load(html);
    const content = $(
      "#doc-details-page-container > article > div:nth-child(2) > section > div:nth-child(2) > div > ul > li"
    );
    const co_author_data = [];
    content.each(function () {
      let co_author_name = $(this).find("button > span").text();
      if ($(this).find("a").length > 0) {
        co_author_name = co_author_name + " " + "📧";
      }
      co_author_data.push(co_author_name);
    });
    return co_author_data;
  } catch (error) {
    // Handle the error here
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

const scrapCitation = async (url, page) => {
  try {
    const scopusID = await getScopusID(url);
    const url_citaion = `https://www.scopus.com/hirsch/author.uri?accessor=authorProfile&auidList=${scopusID}&origin=AuthorProfile`;
    await page.goto(url_citaion, { waitUntil: "networkidle2" });
    await page.click("#analyzeCitations-miniGraph > button");
    const html = await page.content();
    const $ = cheerio.load(html);
    const content = $("#analyzeCitations-table > tbody > tr");
    const citations = [];
    content.each(function () {
      const year = $(this).find("td:nth-child(1)").text();
      const cite = $(this).find("td.alignRight > a > span").text();
      if (cite) {
        const citation = {
          year: year,
          citations: cite,
        };
        citations.push(citation);
      }
    });

    return citations;
  } catch (error) {
    // Handle the error here
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

const scrapDocument = async (url, page) => {
  try {
    const scopusID = await getScopusID(url);
    const url_citaion = `https://www.scopus.com/hirsch/author.uri?accessor=authorProfile&auidList=${scopusID}&origin=AuthorProfile`;
    await page.goto(url_citaion, { waitUntil: "networkidle2" });
    await page.click("#analyzeYear-miniChart > header > h2 > button");
    const html = await page.content();
    const $ = cheerio.load(html);
    const content = $("#analyzeYear-table > tbody > tr");
    const documents = [];
    content.each(function () {
      const year = $(this).find("td:nth-child(1)").text();
      const document = $(this).find("td.alignRight > a > span").text();
      if (document) {
        const citations = {
          year: year,
          documents: document,
        };
        documents.push(citations);
      }
    });

    return documents;
  } catch (error) {
    // Handle the error here
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

const getScopusID = async (url) => {
  try {
    const match = url.match(/authorId=\d+/)[0];
    const scopusID = match.match(/=(\d+)/)[1];
    return scopusID;
  } catch (error) {
    // Handle the error here
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

const scrapSubjectArea = async (page) => {
  try {
    await page.click("#AuthorHeader__showAllAuthorInfo");
    const html = await page.content();
    const $ = cheerio.load(html);
    const clickViewMore = $(
      "div > div > div > div > div > div > div:nth-child(4) > div > span"
    ).text();
    const bulletChar = "•";
    const bulletCount = (clickViewMore.match(new RegExp(bulletChar, "g")) || [])
      .length;
    const subjectArea = [];

    for (let i = 0; i < bulletCount + 1; i++) {
      const sub = clickViewMore.split(bulletChar)[i].trim();
      subjectArea[i] = sub;
    }
    return subjectArea;
  } catch (error) {
    // Handle the error here
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
};

module.exports = {
  scraper,
};
