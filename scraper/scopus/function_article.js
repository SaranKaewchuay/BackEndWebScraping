const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

const { getURLScopus } = require("../scopus/fuction_author");
const { insertArticleDataToDbScopus } = require("../insertToDb/insertToDb");

const batchSize = 5;
let roundScraping = 0;
let allArticle = [];

const scraperArticleScopus = async () => {
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
        const article = await scrapeArticleData(allURLs[i].url, page);
        allArticle.push(article);
        await insertArticleDataToDbScopus(article);
        roundScraping = i+1;
      } catch (error) {
        console.error("Error occurred while scraping:", error);
        await scraperArticleScopus();
      } finally {
        await browser.close();
      }
    }

    console.log("Finish Scraping Scopus");
    return allArticle;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraperArticleScopus();
    return [];
  }
};


// let roundArticle = 0;
// let article_detail = [];

const scrapeArticleData = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: "networkidle2" });
    await page.waitForSelector("#preprints");
    await page.click("#preprints");
    await page.waitForSelector("#documents");
    await page.click("#documents");

    await page.waitForSelector(
      "#documents-panel > div > div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > els-paginator > nav > els-select > div > label > select"
    );
    await page.select(
      "#documents-panel > div > div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > els-paginator > nav > els-select > div > label > select",
      "200"
    );
    await page.waitForTimeout(1500);
    let html = await page.content();
    let link_Article = await getArticleUrl(html);

    if (link_Article.length == 0) {
      await scraperArticleScopus();
    } else {
      console.log("Number of Articles: ", link_Article.length);
      console.log("Scraping Articles: ");
      const batchSize = 7;
      const article_detail = [];
      for (let i = 0; i < link_Article.length; i += batchSize) {
        const batchUrls = link_Article.slice(i, i + batchSize);
        const promises = batchUrls.map(async (article_url, index) => {
          console.log("Article =", i + index + 1);
          const articlePage = await page.browser().newPage();
          await articlePage.goto(article_url, { waitUntil: "networkidle2" });
          const article_data = await getArticleDetail(articlePage, article_url, url);
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
    }
  } catch (error) {
    console.error("An error occurred:", error);
    await scraperArticleScopus();
    return null;
  }
};


const getScopusID = async (url) => {
  try {
    const match = url.match(/authorId=\d+/)[0];
    const scopusID = match.match(/=(\d+)/)[1];
    return scopusID;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraperAuthorScopus();
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
    console.error("An error occurred:", error);
    await scraperArticleScopus();
    return null;
  }
};

const getArticleDetail = async (page, url, author_url) => {
  try {
    await page.waitForSelector("#show-additional-source-info");
    await page.click("#show-additional-source-info");
    await page.waitForTimeout(1000);
    const html = await page.content();

    const source_id = await getSourceID(page);
    const check_journal = source_id ? true : false;
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
    article_data.author_scopus_id = await getScopusID(author_url);
    return article_data;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraperArticleScopus();
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
    await scraperArticleScopus();
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
    console.error("An error occurred:", error);
    await scraperArticleScopus();
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
    console.error("An error occurred:", error);
    await scraperArticleScopus();
    return null;
  }
};

module.exports = {
  scraperArticleScopus,
  sourceID,
};
