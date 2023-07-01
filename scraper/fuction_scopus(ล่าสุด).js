const axios = require("axios");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const {
  insertDataToDbScopus,
} = require("./insertToDb");
let roundScraping = 528; // Scraping Author 178 of 539: Asst.Prof.Dr.Thippawan Bunsanong
let allAuthors = [];
let author_backup = {};

const scraper = async () => {
  try {
    const allURLs = await getURLScopus();

    for (let i = roundScraping; i < allURLs.length; i++) {
      roundScraping = i;
      console.log(
        `Scraping Author ${i + 1} of ${allURLs.length}: ${allURLs[i].name}`
      );
      console.log(`URL: ${allURLs[i].url}`);

      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();

      try {
        if (Object.keys(author_backup).length === 0) {
          const author = await scrapeAuthorData(allURLs[i].url, page);
          author_backup = author;
        }
        const article = await scrapeArticleData(allURLs[i].url, page);

        if (Object.keys(author_backup).length !== 0 && article.length !== 0) {
          author_backup.articles = article;
          allAuthors.push(author_backup);
          await insertDataToDbScopus(author_backup);
          author_backup = {};
        }
      } catch (error) {
        console.error("Error occurred while scraping:", error);
        await scraper();
      } finally {
        await browser.close();
      }
    }

    console.log("Finish Scraping Scopus");
    return allAuthors;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraper();
    return []; // Return an empty array if an error occurs
  }
};

let roundArticle = 0;
let article_detail = [];

const scrapeArticleData = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: "networkidle2" });
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

    if (link_Article.length == 0) {
      await scraper();
    } else {
      console.log("Number of Articles: ", link_Article.length);
      // console.log("Scraping Articles: ");
      // link_Article.length
      for (let i = roundArticle; i < link_Article.length; i++) {
        roundArticle = i;
        console.log("Article : ", i + 1);
        const article_url = link_Article[i];
        await page.goto(article_url, { waitUntil: "networkidle2" });
        const article_data = await getArticleDetail(page, article_url);
        article_detail.push(article_data);
      }
      roundArticle = 0;
      const result = article_detail;
      article_detail = [];

      return result;
    }
  } catch (error) {
    console.error("An error occurred:", error);
    await scraper();
    return null;
  }
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
          console.log("sourceIDAll : ", sourceID);
          return id;
        } else {
          return id;
        }
      } else {
        console.log("Element does not have ViewFullSource");
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
  sourceID,
  allAuthors,
};
