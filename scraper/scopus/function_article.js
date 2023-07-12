const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { getURLScopus } = require("./fuction_author");
const { insertArticleDataToDbScopus,insertDataToJournal} = require("../insertToDb/insertToDb");
const {
  getOldNumDocInPage,
  getNumArticleInDB,
  checkHasSourceId,
  updateNewDoc,
} = require("../../qurey/qurey_function");
const { scrapJournal, scraperJournalData } = require("./function_journal");
const { createJsonScourceID } = require("./function_Json");

const batchSize = 3;
let roundScraping = 0;
let allArticle = [];
let allURLs;
let checkUpdate;
let checkNotUpdate;
let errorURLs = [];
let sourceID = [];

const scraperArticleScopus = async () => {
  try {
    allURLs = await getURLScopus();
    //allURLs.length
    while (roundScraping < 3) {
      console.log("roundScraping == ", roundScraping);
      const batchURLs = allURLs.slice(roundScraping, roundScraping + batchSize);

      const batchPromises = batchURLs.map(async (url, index) => {
        checkUpdate = false;
        checkNotUpdate = false;
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        try {
          const scopus_id = await getScopusID(url.url);
          console.log(`Scraping Author ${roundScraping + index + 1} of ${allURLs.length}: ${url.name}`);
          console.log(`URL: ${url.url}`);

          await page.goto(url.url, { waitUntil: "networkidle2" });
          await page.waitForTimeout(1600)

          const html = await page.content();

          await page.waitForSelector(
            "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(2) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc"
          );
          const numDocInPage = await getDocumentInpage(html);
          const oldNumDocInPage = await getOldNumDocInPage(scopus_id);
          const numArticleInDB = await getNumArticleInDB(scopus_id);

          console.log("numArticleInDB =", numArticleInDB);
          console.log("oldNumDocInPage =", oldNumDocInPage);
          console.log("numDocinPage =", numDocInPage);

          if (numArticleInDB === 0) {
            console.log("-------------------------");
            console.log("Do this loop First Scrap");
            console.log("-------------------------");
            const article = await scrapeArticleData(url.url, page, 0, url.name);
            console.log("\nNumber of WU Articles of ",url.name,": ",article.article.length,"\n");
            allArticle.push(article.article);
            return { status: "fulfilled", article: article.article };
          } else if (numDocInPage !== oldNumDocInPage) {
            checkUpdate = true;
            console.log("---------------------------------------");
            console.log("Do this loop Scrap Add New Article");
            console.log("---------------------------------------");
            const numNewDoc = numDocInPage - oldNumDocInPage;
            const article = await scrapeArticleData(url.url,page,numNewDoc, url.name);
            console.log("\nNumber of WU Articles of ",url.name,": ",article.article.length,"\n");
            allArticle.push(article.article);
            return {
              status: "fulfilled",
              article: article.article,
              scopus_id: scopus_id,
              checkUpdate: checkUpdate,
              numDocInPage: numDocInPage,
            };
          } else if (numDocInPage === oldNumDocInPage) {
            checkNotUpdate = true;
            console.log("-------------");
            console.log("Skip Loop");
            console.log("-------------");
            return {
              status: "fulfilled",
              article: [],
              checkNotUpdate: checkNotUpdate,
            };
          } else {
            return { status: "fulfilled", article: [] };
          }
        } catch (error) {
          console.error("Error occurred while scraping:", error);
          return { status: "rejected", reason: error };
        } finally {
          await browser.close();
        }
      });

      const results = await Promise.allSettled(batchPromises);
      console.log("results =", results);

      const fulfilledResults = results.filter((result) => result.status === "fulfilled");
      const rejectedResults = results.filter((result) => result.status === "rejected");

      for (const result of fulfilledResults) {
        const data = result.value;
        if (data.article.length !== 0 || data.checkUpdate) {
          await insertArticleDataToDbScopus(data.article);
          if (data.checkUpdate) {
            await updateNewDoc(data.scopus_id, data.numDocInPage);
          }
        } else if (data.checkNotUpdate) {
          continue;
        } else {
          console.log("------ Array 0 --------");
        }
      }

      for (const result of rejectedResults) {
        console.error("Error occurred while scraping:", result.reason);
        const errorIndex = rejectedResults.indexOf(result);
        errorURLs.push(allURLs[roundScraping + errorIndex]);
      }
      roundScraping += batchSize;
    }
    console.log("\nStart Scraping Journal\n")
    await scrapJournal(sourceID)

    console.log("Finish Scraping Scopus");
    return allArticle;
  } catch (error) {
    console.error("An error occurred:", error);
    // console.log("Catch 1");
    await scraperArticleScopus()
    return [];
  }
};

const scraperOneArticleScopus = async (eid) => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    const batchSize = 7;
    const article_detail = [];
    const all_eid = eid.split(",").map(e => e.trim());
    console.log("all_eid = ",all_eid)
    let sizeLoop =
      all_eid.length < batchSize && all_eid.length > 0
        ? all_eid.length
        : batchSize;

    let articleCount = 0;
    for (let i = 0; i < all_eid.length; i += sizeLoop) {
      const batchEid = all_eid.slice(i, i + sizeLoop);
      const promises = batchEid.map(async (id, index) => {
        articleCount++;
        console.log("Article =", articleCount);
        const articlePage = await page.browser().newPage();
        const url = `https://www.scopus.com/record/display.uri?eid=2-s2.0-${id}&origin=resultslist&sort=plf-f`;
        await articlePage.goto(url, { waitUntil: "networkidle2" });
        await articlePage.waitForSelector(
          "#affiliation-section > div > div > ul"
        );
        await articlePage.waitForTimeout(2000);
        const check = await checkArticleWU(articlePage);

        if (check === "true") {
          const article_data = await getArticleDetail(articlePage, url);
          console.log("article_data = ",article_data)
          await articlePage.close();
          return article_data;
        } else {
          await articlePage.close();
          return null;
        }
      });

      const results = await Promise.allSettled(promises);
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value !== null) {
          article_detail.push(result.value);
        }
      });
    }
    await browser.close();
    return article_detail;
  } catch (error) {
    return [];
  }
};




const getDocumentInpage = async (html) => {
  const $ = cheerio.load(html);
  const numDoc = $(
    "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(2) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc"
  ).text();

  return Number(numDoc);
};

const checkArticleWU = async (page) => {
  try {
    const searchString1 = "Walailak";
    const searchString2 = "walailak";
    let affiliationText;

    let html = await page.content();
    let $ = cheerio.load(html);
    if ($("#show-additional-affiliations").length > 0) {
      await page.click("#show-additional-affiliations");
      await page.waitForTimeout(1300);
      html = await page.content();
      $ = cheerio.load(html);
      affiliationText = $("#affiliation-section > div").text();
    } else {
      affiliationText = $("#affiliation-section > div > div > ul").text();
    }

    const found =
      affiliationText.includes(searchString1) ||
      affiliationText.includes(searchString2);
    if (found) {
      return "true";
    } else {
      return "false";
    }
  } catch (error) {
    return;
  }
};

const scrapeArticleData = async (url, page, numNewDoc, author_name) => {
  try {
    await page.waitForSelector("#preprints");
    await page.click("#preprints");
    await page.waitForSelector("#documents");
    await page.click("#documents");

    await page.waitForSelector("#documents-panel > div > div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > div > div > div > label > select");
    await page.select("#documents-panel > div > div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > div > div > div > label > select","200");
    await page.waitForTimeout(2500);
    let html = await page.content();
    let link_Article = await getArticleUrl(html);

    if (link_Article.length == 0) {
      console.log("Catch 1111 **");
    } else {
      const link_not_wu = [];
      console.log("Number of Articles In scopus of ",author_name,": ",link_Article.length);
      console.log("Scraping Articles: ");
      const batchSize = 7;
      const article_detail = [];
      let lengthArticle = numNewDoc === 0 ? link_Article.length : numNewDoc;
      let sizeLoop = numNewDoc < batchSize && numNewDoc > 0 ? numNewDoc : batchSize;
      let articleCount = 0;
      for (let i = 0; i < lengthArticle; i += sizeLoop) {
        const batchUrls = link_Article.slice(i, i + sizeLoop);
        const promises = batchUrls.map(async (article_url, index) => {
          articleCount++;
          console.log("Article =", articleCount);
          const articlePage = await page.browser().newPage();
          await articlePage.goto(article_url, { waitUntil: "networkidle2" });
          await page.waitForTimeout(5000);
          await articlePage.waitForSelector("#affiliation-section > div > div > ul");
          await page.waitForTimeout(5000);
          const check = await checkArticleWU(articlePage);
          
          if (check == "false") {
            link_not_wu.push(article_url);
          }
          if (check === "true") {
            const article_data = await getArticleDetail(
              articlePage,
              article_url,
              url
            );
            await articlePage.close();
            return article_data;
          } else {
            await articlePage.close();
            return null;
          }
        });

        const results = await Promise.allSettled(promises);
        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value !== null) {
            article_detail.push(result.value);
          } else if (result.status === "rejected") {
            // console.error("Failed to scrape article:", result.reason);
            // await scraperArticleScopus();
          }
        });
      }

      return { article: article_detail, link_not_wu: link_not_wu };
    }
  } catch (error) {
    return null;
  }
};



const getScopusID = async (url) => {
  try {
    const match = url.match(/authorId=\d+/)[0];
    const scopusID = match.match(/=(\d+)/)[1];
    return scopusID;
  } catch (error) {
    // console.error("An error occurred:", error);
    // console.log("Catch 4");
    // await scraperAuthorScopus();
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
    return null;
  }
};

const getE_Id = async (url) => {
  try {
    const substring = url.substring(url.indexOf("eid=") + 3);
    const desiredValue = substring.substring(8, substring.indexOf("&"));

    if (desiredValue) {
      return desiredValue;
    } else {
      return "";
    }
  } catch (error) {
    return null;
  }
};

const getArticleDetail = async (page, url, author_url) => {
  try {
    let author_scopus_id
    if (typeof author_url === 'undefined') {
      author_url = null;
    }else{
      author_scopus_id = await getScopusID(author_url);
    }
    // await page.waitForSelector("#show-additional-source-info");
    await page.click("#show-additional-source-info");
    await page.waitForTimeout(1200);
    const html = await page.content();

    const source_id = await getSourceID(page, author_scopus_id);
    const check_journal = source_id ? true : false;
    const $ = cheerio.load(html);

    const article_data = {
      eid: await getE_Id(url),
      name: $(
        "#doc-details-page-container > article > div:nth-child(2) > section > div.row.margin-size-8-t > div > h2 > span"
      ).text(),
      ...(check_journal && { source_id: source_id }),
      co_author: await scrapCo_Author(html),
      corresponding: $("p.corrAuthSect").text().trim().replace(/©.*$/, ""),
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
    article_data.author_scopus_id = author_scopus_id;
    return article_data;
  } catch (error) {
    return null;
  }
};


const getSourceID = async (page, author_scopus_id) => {
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
        const source_id = $("#source-preview-details-link")
          .attr("href")
          .split("/")[2];

        if (checkUpdate) {
          // update
          if (!await checkHasSourceId(source_id)) {
            const data = await scraperJournalData(source_id, 0);
            await insertDataToJournal(data, source_id);
          }
        } else if (!sourceID.includes(source_id)) {
          // first
          sourceID.push(source_id);
          createJsonScourceID(source_id)
          // const data = await scraperJournalData(source_id, 0);
          // await insertDataToJournal(data, source_id);
        }
        return source_id;
      } else {
        // console.log("Element does not have ViewFullSource");
        return null;
      }
    } else {
      return null;
    }
  } catch (error) {
    console.log("Catch 7");

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
        co_author_name = co_author_name + " " + "*";
      }
      co_author_data.push(co_author_name);
    });
    return co_author_data;
  } catch (error) {
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
    return null;
  }
};

module.exports = {
  scraperArticleScopus,
  sourceID,
  errorURLs,
  getArticleUrl,
  scraperOneArticleScopus
};
