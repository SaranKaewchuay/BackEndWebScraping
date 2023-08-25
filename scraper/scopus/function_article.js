const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const {
  insertArticleDataToDbScopus,
  insertDataToJournal,
  insertDataToCoressponding,
  insertWuDocBeforAuthorScopus,
} = require("../insertToDb/insertToDb");
const {
  getOldNumDocInPage,
  getNumArticleOfAuthorInDB,
  checkHasSourceId,
  getArticleOfAuthorNotPage,
  addCountDocumentInWu,
  getCountRecordInArticle,
  getCountRecordInJournal,
  getOldNumArticleInWU,
  addFieldPageArticle,
  hasSourceEID,
  hasEidOfAuthor,
  pushLogScraping,
  hasScopusIdInAuthor,
  hasFieldWuDoc,
} = require("../../qurey/qurey_function");
const {
  scraperJournalData,
  scrapJournal,
  getLogJournalScraping,
} = require("./function_journal");
const { getBaseURL } = require("../../qurey/baseURL");
const getAllScopusAuthIDs = require("./getScopusIdFromApi");

const batchSize = 3;
let roundScraping = 0;
let allArticle = [];
let checkUpdate;
let checkNotUpdate;
let checkFirst;
let errorURLs = [];
let sourceID = [];
let linkError = [];
let checkAddArtilce = false;
let checkScrapingFirst = false;
let checkArticleScrapingFirst = false;
let checkAddSourceId = false;
let numOldDocument = 0;

const scraperArticleScopus = async (authorId) => {
  try {
    const baseAuthorUrl = getBaseURL();
    let allURLs;
    if (typeof authorId !== "undefined") {
      allURLs = authorId;
    } else {
      allURLs = await getAllScopusAuthIDs();
      allURLs = allURLs.slice(0, 3);
    }

    if (numOldDocument === 0) {
      numOldDocument = await getCountRecordInArticle();
    }

    let numRecordArticle = await getCountRecordInArticle();
    if (numRecordArticle === 0) {
      checkScrapingFirst = true;
    }

    //allURLs.length
    while (roundScraping < allURLs.length) {
      console.log("\nRound Article Scraping : ", roundScraping, "\n");
      const batchURLs = allURLs.slice(roundScraping, roundScraping + batchSize);

      const batchPromises = batchURLs.map(async (data, index) => {
        checkUpdate = false;
        checkNotUpdate = false;
        checkFirst = false;
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        try {
          console.log(
            `Scraping Article of Author ${roundScraping + index + 1} of ${
              allURLs.length
            }: ${data.name}`
          );
          const scopusId = data.scopus_id;
          const author_url = `${baseAuthorUrl}${scopusId}`;
          console.log(`URL: ${author_url}`);

          const response = await page.goto(author_url, {
            waitUntil: "networkidle2",
          });
          await page.waitForTimeout(1600);

          const selector_num_doc =
            "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(2) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc";
          await waitForElement(selector_num_doc);

          const element = await page.$(
            "#warningMsgContainer > span:nth-child(2)"
          );
          let checkPageNotFound = false;

          if (element) {
            const textContent = await element.evaluate((el) => el.textContent);
            if (textContent === "Page not found") {
              checkPageNotFound = true;
            }
          }

          if (response.ok() && !checkPageNotFound) {
            const html = await page.content();
            const numDocInPage = await getDocumentInpage(html);
            const oldNumDocInPage = await getOldNumDocInPage(scopusId);
            const numArticleOfAuthor = await getNumArticleOfAuthorInDB(
              scopusId
            );
            const checkNumDoc = {
              numDocInPage: numDocInPage,
              oldNumDocInPage: oldNumDocInPage,
            };
            let article_data;
            if (numArticleOfAuthor === 0 || typeof authorId !== "undefined") {
              checkFirst = true;
              checkArticleScrapingFirst = true;
              checkNumDoc.status = "first";
              if (numDocInPage == 0) {
                if (await hasScopusIdInAuthor(scopusId)) {
                  await addCountDocumentInWu(scopusId, 0, data.name);
                } else {
                  await insertWuDocBeforAuthorScopus(scopusId, 0, data.name);
                }

                return {
                  status: "fulfilled",
                  article: [],
                  author_name: data.name,
                };
              } else {
                const article = await scrapeArticleData(
                  author_url,
                  page,
                  0,
                  data.name,
                  checkNumDoc,
                  numDocInPage,
                  checkFirst,
                  scopusId,
                  false
                );
                if (typeof article !== "undefined") {
                  if (article !== null && article.hasOwnProperty("article")) {
                    article_data = article.article;
                    allArticle = allArticle.concat(article_data);
                  } else {
                    article_data = null;
                  }
                } else {
                  article_data = null;
                }

                return {
                  status: "fulfilled",
                  article: article_data,
                  scopus_id: scopusId,
                  checkFirst: checkFirst,
                  author_name: data.name,
                };
              }
            } else if (
              numDocInPage > oldNumDocInPage &&
              oldNumDocInPage !== 0 &&
              numDocInPage !== 0
            ) {
              checkUpdate = true;
              const numNewDoc = numDocInPage - oldNumDocInPage;
              checkNumDoc.numNewDoc = numNewDoc;
              checkNumDoc.status = "update";
              // await scraperArticlePageUpdate(scopusId, page);

              const article = await scrapeArticleData(
                author_url,
                page,
                numNewDoc,
                data.name,
                checkNumDoc,
                numDocInPage,
                (checkFirst = false),
                scopusId,
                false
              );

              if (typeof article !== "undefined") {
                if (article !== null && article.hasOwnProperty("article")) {
                  article_data = article.article;
                  allArticle = allArticle.concat(article_data);
                } else {
                  article_data = null;
                }
              } else {
                article_data = null;
              }

              return {
                status: "fulfilled",
                article: article_data,
                scopus_id: scopusId,
                checkUpdate: checkUpdate,
                numDocInPage: numDocInPage,
                author_name: data.name,
              };
            } else if (numDocInPage === oldNumDocInPage) {
              checkNotUpdate = true;
              console.log(
                "\n--------------------------------------------------------------------------"
              );
              console.log("Article Of ", data.name, " is not update.");
              console.log(
                "--------------------------------------------------------------------------"
              );
              console.log("Number Of Article In Web Page : ", numDocInPage);
              console.log("Number Of Article In Database : ", oldNumDocInPage);

              // await scraperArticlePageUpdate(scopusId, page);

              return {
                status: "fulfilled",
                article: [],
                checkNotUpdate: checkNotUpdate,
              };
            } else {
              return { status: "fulfilled", article: [] };
            }
          } else {
            const newEntry = { name: data.name, url: author_url };
            const isDuplicate = linkError.find(
              ({ name, url }) => name === newEntry.name && url === newEntry.url
            );
            if (!isDuplicate) {
              linkError.push(newEntry);
            }
            console.log("linkError : ", linkError);
            return { status: "fulfilled", article: "Page not found" };
          }
        } catch (error) {
          console.error("\nError occurred while scraping : ", error);
          return { status: "rejected" };
        } finally {
          await browser.close();
        }
      });

      const results = await Promise.allSettled(batchPromises);
      const mappedResults = results.map((result) => {
        if (typeof result.value.article === "undefined") {
          result.value.article = null;
        }
        return (
          result.value.article !== null && result.value.status !== "rejected"
        );
      });

      console.log("All Article Of Author Results Status : ", mappedResults);
      const hasFalse = mappedResults.includes(false);
      const finalResult = !hasFalse;

      const rejectedResults = results.filter(
        (result) => result.status === "rejected"
      );
      if (finalResult) {
        if (
          results.length === batchSize ||
          results.length === batchURLs.length
        ) {
          for (const result of results) {
            if (
              result.status === "fulfilled" &&
              result.value.article !== "Page not found"
            ) {
              const data = result.value;
              if (data.article.length > 0 || data.checkUpdate) {
                checkAddArtilce = true;
              } else if (data.checkNotUpdate) {
                continue;
              } else {
                console.log("------ Array 0 --------");
              }
            } else if (result.status === "rejected") {
              console.error("\nError occurred while scraping : ", error);
              if (typeof authorId !== "undefined") {
                await scraperArticleScopus(authorId);
              } else {
                await scraperArticleScopus();
              }
              return;
            }
          }
          if (
            sourceID.length > 0 &&
            checkArticleScrapingFirst &&
            (await getCountRecordInJournal()) > 0 && typeof authorId === "undefined"
          ) {
            await scrapJournal(sourceID);
          }
        } else {
          console.log("!== batchsize");
          if (typeof authorId !== "undefined") {
            await scraperArticleScopus(authorId);
          } else {
            await scraperArticleScopus();
          }
          return;
        }
      } else {
        console.log("Some article data is incomplete.");
        if (typeof authorId !== "undefined") {
          await scraperArticleScopus(authorId);
        } else {
          await scraperArticleScopus();
        }
        return;
      }

      for (const result of rejectedResults) {
        const errorIndex = rejectedResults.indexOf(result);
        errorURLs.push(allURLs[roundScraping + errorIndex]);
      }
      roundScraping += batchSize;
    }
    let numScrapingArticle = 0;

    if (checkScrapingFirst) {
      numScrapingArticle = await getCountRecordInArticle();
    } else if (!checkScrapingFirst) {
      const doc = (await getCountRecordInArticle()) - Number(numOldDocument);
      numScrapingArticle = Math.abs(doc);
    }

    let error = linkError;

    const logScraping = {
      message: "Scraping Article Data For Scopus Completed Successfully.",
      numArticleScraping: numScrapingArticle,
      error: error,
    };
    pushLogScraping(logScraping, "article");
    console.log(
      "\n-------------------------------------------------------------------------------------------"
    );
    console.log("Finsh Scraping Article Data : ", logScraping);
    console.log(
      "-------------------------------------------------------------------------------------------\n"
    );

    if (!checkScrapingFirst && checkAddArtilce && checkAddSourceId) {
      const { addJournalData, updateCiteScoreYear, journal } =
        await getLogJournalScraping();
      if (addJournalData.length > 0 && journal.length > 0) {
        numScraping = journal.length + addJournalData.length;
      } else if (addJournalData.length > 0) {
        numScraping = addJournalData.length;
      } else if (journal.length > 0) {
        numScraping = journal.length;
      }
      const logJournal = {
        message: "Scraping Journal Data For Scopus Completed Successfully.",
        numJournalScraping: numScraping,
        numUpdateCiteScoreYear: updateCiteScoreYear.length,
      };

      pushLogScraping(logJournal, "journal");
      console.log(
        "\n---------------------------------------------------------------------------------------------"
      );
      console.log("Update Log Scraping journal Data : ", logJournal);
      console.log(
        "---------------------------------------------------------------------------------------------\n"
      );
    }
    checkAddArtilce = false;
    checkScrapingFirst = false;
    checkAddSourceId = false;
    checkArticleScrapingFirst = false;
    roundScraping = 0;
    allArticle = [];
    errorURLs = [];
    sourceID = [];
    linkError = [];
    numOldDocument = 0;

    return logScraping;
  } catch (error) {
    console.error("\nError occurred while scraping : ", error);
    if (typeof authorId !== "undefined") {
      await scraperArticleScopus(authorId);
    } else {
      await scraperArticleScopus();
    }
    return null;
  }
};

const checkStrings = (array, strings) =>
  strings.some((str) => array.includes(str));

const mapDataToArticle = async (data, article_data, stringsToCheck) => {
  try {
    let [fieldText, fieldValue] = data.split(" ");
    const checkField = checkStrings(data, stringsToCheck);
    if (checkField) {
      const lowerCaseFieldText = fieldText.toLowerCase();
      if (lowerCaseFieldText === "pages") {
        const page = data.split(" ");
        fieldValue = page.slice(1).join(" ");
      }
      article_data[lowerCaseFieldText] = fieldValue;
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
};

const scraperArticlePageUpdate = async (scopus_id, page) => {
  try {
    const link_Article = await getArticleOfAuthorNotPage(scopus_id);
    console.log(
      "\nNum Article Not Have Field Page of Scopus ID | ",
      scopus_id,
      " : ",
      link_Article.length,
      "\n"
    );
    let roundArticleScraping = 0;
    const batchSize = 7;
    for (
      let i = roundArticleScraping;
      i < link_Article.length;
      i += batchSize
    ) {
      roundArticleScraping = i;
      const batchUrls = link_Article.slice(i, i + batchSize);
      const promises = batchUrls.map(async (article_url, index) => {
        const articlePage = await page.browser().newPage();
        try {
          await articlePage.goto(article_url, { waitUntil: "networkidle2" });
          const html = await articlePage.content();
          const $ = cheerio.load(html);
          const detail1 = $(
            "#doc-details-page-container > article > div:nth-child(1) > div > div > span:nth-child(2)"
          )
            .text()
            .split(",")
            .map((item) => item.trim());
          const detail2 = $(
            "#doc-details-page-container > article > div:nth-child(1) > div > div > span:nth-child(3)"
          )
            .text()
            .split(",")
            .map((item) => item.trim());
          const stringsToCheck = ["Pages"];
          let data = [];
          if (detail1[0] !== "") {
            data = detail1;
          } else if (detail2[0] !== "") {
            data = detail2;
          }
          const article_data = {};

          await Promise.all(
            data.map((data) =>
              mapDataToArticle(data, article_data, stringsToCheck)
            )
          );
          const hasPageField = article_data.hasOwnProperty("pages");
          const eid = await getE_Id(article_url);
          if (hasPageField) {
            console.log(
              "Article EID | ",
              eid,
              " Page Update | Pages : ",
              article_data.pages
            );
            await addFieldPageArticle(eid, scopus_id, article_data.pages);
          } else {
            console.log("Article EID | ", eid, " Page is not update");
          }
          await articlePage.close();
        } catch (error) {
          console.error("\nError occurred while scraping : ", error);
          await articlePage.close();
        }
      });

      await Promise.all(promises);
    }
  } catch (error) {
    console.error("\nError occurred while scraping : ", error);
  }
};

const waitForElement = async (selector, maxAttempts = 10, delay = 200) => {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      await page.waitForSelector(selector, { timeout: 1200 });
      break;
    } catch (error) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const scraperOneArticleScopus = async (eid) => {
  try {
    const browser = await puppeteer.launch({ headless: false });

    const batchSize = 7;
    const article_detail = [];
    const all_eid = eid.split(",").map((e) => e.trim());
    console.log("all_eid = ", all_eid);
    let sizeLoop =
      all_eid.length < batchSize && all_eid.length > 0
        ? all_eid.length
        : batchSize;

    let articleCount = 0;
    for (let i = 0; i < all_eid.length; i += sizeLoop) {
      const batchEid = all_eid.slice(i, i + sizeLoop);
      const promises = batchEid.map(async (id, index) => {
        articleCount++;
        console.log(
          `Scraping Article Of Author (${index + 1}/${
            all_eid.length
          }): Scopus ID ${id}`
        );
        const page = await browser.newPage();
        const articlePage = await page.browser().newPage();
        const url = `https://www.scopus.com/record/display.uri?eid=2-s2.0-${id}&origin=resultslist&sort=plf-f`;
        await articlePage.goto(url, { waitUntil: "networkidle2" });
        const waitElement =
          "#affiliation-section > div > div > ul > li:nth-child(1) > span";
        await waitForElement(waitElement);

        const check = await checkArticleWU(articlePage);
        const article_data = await getArticleDetail(
          articlePage,
          url,
          check.department
        );
        await articlePage.close();
        return article_data;
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
    return null;
  }
};

const getDocumentInpage = async (html) => {
  try {
    const $ = cheerio.load(html);
    const numDoc = $(
      "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(2) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc"
    ).text();

    return Number(numDoc);
  } catch (error) {
    console.error("\nError occurred while scraping : ", error);
    return null;
  }
};

const checkArticleWU = async (page) => {
  try {
    const searchString = "Walailak";
    let department = [];

    await page.evaluate(() => {
      const showAdditionalAffiliationsButton = document.querySelector(
        "#show-additional-affiliations"
      );
      if (showAdditionalAffiliationsButton)
        showAdditionalAffiliationsButton.click();
    });

    await page.waitForTimeout(500);

    let html = await page.content();
    let $ = cheerio.load(html);

    const affiliationText = $("#affiliation-section > div").text();
    const content = $(
      "#affiliation-section > div > div > ul > li, #affiliation-section > div > els-collapsible-panel > section > div > div > ul > li"
    );

    content.each(function () {
      department.push($(this).text().trim());
    });

    let found = affiliationText
      .toLowerCase()
      .includes(searchString.toLowerCase());

    return {
      status: found,
      department: found ? department : undefined,
    };
  } catch (error) {
    console.error("\nError occurred while scraping : ", error);
    return null;
  }
};

const scrapeArticlesBatch = async (
  page,
  link_Article,
  numNewDoc,
  author_name,
  url,
  roundArticleScraping,
  article_detail,
  oneArticle,
  status
) => {
  const batchSize = 7;
  const link_not_wu = [];

  let lengthArticle = numNewDoc === 0 ? link_Article.length : numNewDoc;
  let sizeLoop = numNewDoc < batchSize && numNewDoc > 0 ? numNewDoc : batchSize;
  let articleCount = 0;

  for (let i = roundArticleScraping; i < lengthArticle; i += sizeLoop) {
    const article = [];
    roundArticleScraping = i;
    console.log("------------------------------------");
    console.log("Round Article Scraping : ", roundArticleScraping);
    console.log("------------------------------------");
    const batchUrls = link_Article.slice(i, i + sizeLoop);

    const promises = batchUrls.map(async (article_url, index) => {
      let articlePage
      const eid = await getE_Id(article_url);
      const scopus_id = await getScopusID(url);
      try {
        const hasEidAuthor = await hasEidOfAuthor(eid, scopus_id);
        
        if (hasEidAuthor === false) {
          articlePage = await page.browser().newPage();
          await Promise.all([
            articlePage.goto(article_url, { waitUntil: "networkidle2" }),
            articlePage.waitForTimeout(1700),
            waitForElement("#source-preview-flyout"),
            waitForElement("#affiliation-section > div > div > ul > li > span"),
          ]);

          const check = await checkArticleWU(articlePage);
          articleCount++;
          if (numNewDoc === 0) {
            if (check.status) {
              console.log(
                "Article |",
                articleCount,
                "| EID : ",
                eid,
                " Of Author : ",
                author_name
              );
            } else {
              console.log(
                "Article |",
                articleCount,
                "| EID : ",
                eid,
                " Of Author : ",
                author_name,
                " does not belong to the Walailak Department."
              );
            }
          } else {
            console.log(
              "Article |",
              articleCount,
              "| Add New Article EID : ",
              eid,
              " Of Author : ",
              author_name
            );
          }

          if (!check.status) {
            link_not_wu.push(article_url);
            articlePage.close();
            return { article: {}, status: "skip" };
          } else if (check.status) {
            const article_data = await getArticleDetail(
              articlePage,
              article_url,
              check.department,
              url,
              oneArticle,
              status
            );
            articlePage.close();
            return { article: article_data, status: "articleOfWu" };
          }
        } else {
          console.log(
            "\nArticle Eid : ",
            eid,
            " Of Author : ",
            scopus_id,
            "is duplicate\n"
          );
          return { article: {}, status: "skip" };
        }
      } catch (error) {
        console.error("Failed to scrape article : ",error);
        if (articlePage) {
          articlePage.close(); 
        }
        return { article: null, status: "Failed" };
      }
    });

    const results = await Promise.allSettled(promises);
    const mappedResults = results.map((result, index) => {
      if (typeof result.value.article === "undefined") {
        result.value.article = null;
      }
      return (
        result.value.article !== null && result.value.status !== "rejected"
      );
    });

    console.log("Article Results Status  : ", mappedResults);
    const hasFalse = mappedResults.includes(false);
    const finalResult = !hasFalse;
    if (finalResult) {
      await Promise.all(
        results.map(async (result) => {
          if (result.status === "fulfilled" && result.value.article !== null) {
            if (result.value.status === "articleOfWu") {
              const data = result.value.article;
              article.push(data);
              article_detail.push(data);
            }
          }
        })
      );
      roundArticleScraping += batchSize;
    } else {
      await scrapeArticlesBatch(
        page,
        link_Article,
        numNewDoc,
        author_name,
        url,
        roundArticleScraping,
        article_detail,
        oneArticle,
        status
      );
      return;
    }
  }
  console.log(
    "\nNumber of WU Articles of ",
    author_name,
    ": ",
    article_detail.length,
    "\n"
  );

  return { link_not_wu: link_not_wu };
};

const scrapeArticleData = async (
  url,
  page,
  numNewDoc,
  author_name,
  checkNumDoc,
  numDocInPage,
  checkFirst,
  scopus_id,
  oneArticle
) => {
  try {
    await page.waitForSelector("#preprints");
    await page.click("#preprints");
    await page.waitForSelector("#documents");
    await page.click("#documents");
    let html;
    let link_Article = [];

    const waitElement1 =
      "#documents-panel > div > div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > div:nth-child(2) > ul > li:nth-child(1) > div > div.col-lg-21.col-md-18.col-xs-18 > div.list-title.margin-size-24-t.margin-size-0-b.text-width-32 > h4 > a > span > span";
    await waitForElement(waitElement1);
    if (numNewDoc === 0) {
      html = await page.content();
      if (oneArticle !== false) {
        numDocInPage = await getDocumentInpage(html);
      }
      if (numDocInPage <= 10) {
        link_Article = await getArticleUrl(html, numNewDoc);
      } else {
        const waitElement2 =
          "#documents-panel > div > div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > els-paginator > nav > els-select > div > label";
        await waitForElement(waitElement2);

        const waitElement3 =
          "#documents-panel > div > div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > els-paginator > nav > els-select > div > label > select";
        await page.select(waitElement3, "200");
        await page.waitForTimeout(1750);

        await waitForElement(waitElement1);
        html = await page.content();
        link_Article = await getArticleUrl(html, numNewDoc);

        while (
          await page.$eval(
            "#documents-panel > div > div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > els-paginator > nav > ul > li:last-child > button",
            (button) => !button.disabled
          )
        ) {
          await page.click(
            "#documents-panel > div > div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > els-paginator > nav > ul > li:last-child > button"
          );
          await page.waitForTimeout(1750);
          await waitForElement(waitElement1);
          html = await page.content();
          link_Article = link_Article.concat(
            await getArticleUrl(html, numNewDoc)
          );
        }
      }
    } else {
      await waitForElement(waitElement1);
      html = await page.content();
      link_Article = await getArticleUrl(html, numNewDoc);
    }

    if (link_Article.length === 0) {
      console.log("Link Article is not data");
    } else {
      if (checkFirst) {
        console.log(
          "\n---------------------------------------------------------------------------------"
        );
        console.log("First Scraping Article Of | ", author_name);
        console.log(
          "---------------------------------------------------------------------------------"
        );
        console.log(
          "\nNumber of Articles In scopus of ",
          author_name,
          ": ",
          link_Article.length
        );
      } else if (checkUpdate) {
        console.log(
          "\n-------------------------------------------------------------------------------------"
        );
        console.log("Scraping Add New Article of ", author_name);
        console.log(
          "-------------------------------------------------------------------------------------"
        );
        console.log(
          "Number Of Article In Web Page : ",
          checkNumDoc.numDocInPage
        );
        console.log(
          "Number Of Article In Database : ",
          checkNumDoc.oldNumDocInPage
        );
        console.log("Number Of New Article : ", numNewDoc);
      }
      console.log("Scraping Articles: ");
      const roundArticleScraping = 0;
      const article_detail = [];
      let status;
      if (typeof checkNumDoc !== "undefined") {
        status = checkNumDoc.status;
      } else {
        status = "first";
      }

      await scrapeArticlesBatch(
        page,
        link_Article,
        numNewDoc,
        author_name,
        url,
        roundArticleScraping,
        article_detail,
        oneArticle,
        status
      );

      if (article_detail.length > 0) {
        checkAddArtilce = true;
        await insertArticleDataToDbScopus(article_detail, author_name);
        if (checkFirst) {
          if (await hasScopusIdInAuthor(scopus_id)) {
            if (await hasFieldWuDoc(scopus_id)) {
              const articleInWU =
                Number(await getOldNumArticleInWU(scopus_id)) +
                article_detail.length;
              await addCountDocumentInWu(scopus_id, articleInWU, author_name);
            } else {
              await addCountDocumentInWu(
                scopus_id,
                article_detail.length,
                author_name
              );
            }
          } else {
            await insertWuDocBeforAuthorScopus(
              scopus_id,
              article_detail.length,
              author_name
            );
          }
        } else {
          const articleInWU =
            Number(await getOldNumArticleInWU(scopus_id)) +
            article_detail.length;
          if (await hasScopusIdInAuthor(scopus_id)) {
            await addCountDocumentInWu(scopus_id, articleInWU, author_name);
          } else {
            await insertWuDocBeforAuthorScopus(
              scopus_id,
              articleInWU,
              author_name
            );
          }
        }
      } else {
        if (await hasScopusIdInAuthor(scopus_id)) {
          if (await hasFieldWuDoc(scopus_id)) {
            let articleInWU =
              Number(await getOldNumArticleInWU(scopus_id)) +
              article_detail.length;
            await addCountDocumentInWu(scopus_id, articleInWU, author_name);
          } else {
            await addCountDocumentInWu(scopus_id, 0, author_name);
          }
        } else {
          await insertWuDocBeforAuthorScopus(scopus_id, 0, author_name);
        }
      }

      return { article: article_detail };
    }
  } catch (error) {
    console.error("\nError occurred while scraping : ", error);
    return { article: null };
  }
};

const getScopusID = async (url) => {
  try {
    const match = url.match(/authorId=\d+/)[0];
    const scopusID = match.match(/=(\d+)/)[1];
    return scopusID;
  } catch (error) {
    console.error("\nError occurred while scraping : ", error);
    return null;
  }
};

const getArticleUrl = async (html, numNewDoc) => {
  try {
    const $ = cheerio.load(html);
    const selector =
      "div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > div:nth-child(2) > ul > li";
    const content = $(selector);
    let loopContent = numNewDoc > 0 ? numNewDoc : content.length;
    // console.log("loopContent =", loopContent);

    const url_data = [];
    for (let i = 0; i < loopContent; i++) {
      const link = content.eq(i).find("h4 > a").attr("href");
      url_data.push(link);
    }

    return url_data;
  } catch (error) {
    console.error("Error occurred while scraping : ", error);
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
    console.error("\nError occurred while scraping : ", error);
    return null;
  }
};

const scraperCoressId = async (page, index, coAuthor) => {
  try {
    let selector;
    let dataSelector;
    let exit;
    const elseIndexNum = index - coAuthor.last_index;
    const elseIndex = Math.abs(elseIndexNum) + 1;

    if (coAuthor.hasAdditional) {
      if (index < coAuthor.last_index) {
        // console.log("index : ",index)
        // console.log("coAuthor.last_index : ",coAuthor.last_index)
        console.log("index > coAuthor.last_index");
        selector = `#doc-details-page-container > article > div:nth-child(2) > section > div > div > ul > li:nth-child(${
          index + 1
        }) > button`;
        dataSelector = `#doc-details-page-container > article > div:nth-child(2) > section > div > div > ul > li:nth-child(${
          index + 1
        }) > div > div > div > div > div > div > div > div:nth-child(2) > div > a`;
        exit = `#doc-details-page-container > article > div:nth-child(2) > section > div > div > ul > li:nth-child(${
          index + 1
        }) > div > div > div > div > header > div > button`;
      } else {
        selector = `#doc-details-page-container > article > div:nth-child(2) > section > div > div > els-collapsible-panel-v2 > section > div > div > ul > li:nth-child(${elseIndex}) > button`;
        dataSelector = `#doc-details-page-container > article > div:nth-child(2) > section > div > div > els-collapsible-panel-v2 > section > div > div > ul > li:nth-child(${elseIndex}) > div > div > div > div > div > div > div:nth-child(1) > div:nth-child(2) > div > a`;
        exit = `#doc-details-page-container > article > div:nth-child(2) > section > div:nth-child(2) > div > els-collapsible-panel-v2 > section > div > div > ul > li:nth-child(${elseIndex}) > div > div > div > div > header > div > button`;
      }
    } else {
      selector = `#doc-details-page-container > article > div:nth-child(2) > section > div > div > ul > li:nth-child(${
        index + 1
      }) > button`;
      dataSelector = `#doc-details-page-container > article > div:nth-child(2) > section > div > div > ul > li:nth-child(${
        index + 1
      }) > div > div > div > div > div > div > div > div:nth-child(2) > div > a`;
      exit = `#doc-details-page-container > article > div:nth-child(2) > section > div > div > ul > li:nth-child(${
        index + 1
      }) > div > div > div > div > header > div > button`;
    }

    await page.click(selector);
    await page.waitForTimeout(1000);
    await waitForElement(exit);
    const html = await page.content();
    await page.click(exit);
    await page.waitForTimeout(1000);

    const $ = cheerio.load(html);
    const scopus_url = $(dataSelector).attr("href");
    const scopus_id = await getScopusID(scopus_url);
    return scopus_id;
  } catch (error) {
    console.error("An error occurred: ", error);
  }
};

const scraperCorresponding = async (page, html, coAuthor, eid) => {
  try {
    let $ = cheerio.load(html);
    const pattern = /©.*$/s;
    let data = $("p.corrAuthSect").text().trim().replace(pattern, "");
    const emails = [];
    const corresAuthorID = [];
    const correspondingData = [];
    const emailRegex = /([^;]+);[^:]+:([^ ]+)/g;
    let match;
    while ((match = emailRegex.exec(data))) {
      const email = match[2].trim();
      emails.push(email);
    }

    const detailsSplitRegex = /email:.+?(?=\s{2}|$)/g;
    const sections = data
      .split(detailsSplitRegex)
      .map((str) => str.trim())
      .filter(Boolean);
    html = await page.content();
    $ = cheerio.load(html);
    const backup_page = page;

    for (let index = 0; index < sections.length; index++) {
      try {
        if (index === 1) {
          page = backup_page;
        }
        const str = sections[index];
        const semicolonSplit = str.split(";");
        const corresName = semicolonSplit[0].trim();
        const address = semicolonSplit[1].trim();
        let email = emails[index];

        if (typeof email === "undefined") {
          email = "";
        }

        const n = coAuthor.data.findIndex((author) => {
          let words;
          let partialString = corresName.replace(".", "").split(", ");
          let newPartialString =
            partialString[0] + ", " + partialString[1].charAt(0);

          let newString;
          if (author.includes(", ")) {
            words = author.split(", ");
            newString = words[0] + ", " + words[1].charAt(0);
          } else if (author.includes(" ")) {
            words = author.replace(".", "").split(" ");
            newString = words[0] + ", " + words[1].charAt(0);
          } else {
            newString = author;
          }

          return (
            newPartialString.toLocaleUpperCase() ===
            newString.toLocaleUpperCase()
          );
        });

        if (n !== -1) {
          const corresFullName = coAuthor.data[n].replace("*", "").trim();
          const authorID = await scraperCoressId(page, n, coAuthor);
          const corresponding = {
            corresName: corresName,
            corresFullName: corresFullName,
            address: address,
            email: email,
          };
          corresAuthorID.push(authorID);
          correspondingData.push(corresponding);
        }
      } catch (innerError) {
        console.error("Inner Error or Not have corresponding");
      }
    }

    return { corresAuthorID, correspondingData };
  } catch (error) {
    console.error("Main Function Error:", error);
    throw error;
  }
};

const getArticleDetail = async (
  page,
  url,
  department,
  author_url,
  oneArticle,
  status
) => {
  try {
    let author_scopus_id;
    if (typeof author_url === "undefined") {
      author_url = null;
    } else {
      author_scopus_id = await getScopusID(author_url);
    }
    await page.click("#show-additional-source-info");
    await page.waitForTimeout(1200);
    const html = await page.content();
    const $ = cheerio.load(html);

    const eid = await getE_Id(url);
    const coAuthor = await scrapCo_Author(page);
    const corresponding = {};
    const check = await hasSourceEID(eid);

    if (!check) {
      corresponding.scopusEID = eid;
      const data = await scraperCorresponding(page, html, coAuthor, eid);
      corresponding.corresAuthorID = data.corresAuthorID;
      corresponding.correspondingData = data.correspondingData;

      if (
        corresponding.corresAuthorID.length > 0 &&
        corresponding.correspondingData.length > 0
      ) {
        await insertDataToCoressponding(corresponding);
      } else {
        console.log("-- Not Have Corresponding Of EID : ", eid);
      }
    } else {
      console.log("-- Corresponding Of EID : ", eid, "is duplicate");
    }
    // else if (typeof oneArticle === "undefined") {
    //   corresponding.scopusEID = eid;
    //   const data = await scraperCorresponding(page, html, coAuthor, eid);
    //   corresponding.corresAuthorID = data.corresAuthorID;
    //   corresponding.correspondingData = data.correspondingData;
    // }

    const source_id = await getSourceID(page, status);
    const check_journal = source_id ? true : false;

    const article_data = {
      eid: eid,
      name: $(
        "#doc-details-page-container > article > div:nth-child(2) > section > div.row.margin-size-8-t > div > h2 > span"
      ).text(),
      ...(check_journal && { source_id: source_id }),
      first_author: coAuthor.data[0].replace(" *", ""),
      co_author: coAuthor.data,
      co_author_department: await department,
      corresponding: corresponding,
    };

    const detail1 = $(
      "#doc-details-page-container > article > div:nth-child(1) > div > div > span:nth-child(2)"
    )
      .text()
      .split(",")
      .map((item) => item.trim());
    const detail2 = $(
      "#doc-details-page-container > article > div:nth-child(1) > div > div > span:nth-child(3)"
    )
      .text()
      .split(",")
      .map((item) => item.trim());
    const stringsToCheck = ["Volume", "Issue", "Pages"];
    if (detail1[0] !== "") {
      await Promise.all(
        detail1.map((data) =>
          mapDataToArticle(data, article_data, stringsToCheck)
        )
      );
    } else if (detail2[0] !== "") {
      await Promise.all(
        detail2.map((data) =>
          mapDataToArticle(data, article_data, stringsToCheck)
        )
      );
    }

    $(
      "#source-info-aside > div > div > div > dl, #source-info-aside > div > div > div > els-collapsible-panel > section > div > div > dl"
    ).each(function (i, element) {
      const fieldText = $(element)
        .find("dt")
        .text()
        .trim()
        .toLowerCase()
        .replace(" ", "_");
      let fieldValue = $(element).find("dd").text().trim();
      if (fieldText === "document_type") {
        if (fieldValue.includes("•")) {
          fieldValue = fieldValue.substring(0, fieldValue.indexOf("•")).trim();
        }
      }
      article_data[fieldText] = fieldValue;
    });
    $(
      "#source-info-aside > div > div > div > dl, #source-info-aside > div > div > div > els-collapsible-panel > section > div > div > dl"
    ).each(function (i, element) {
      const fieldText = $(element)
        .find("dt")
        .text()
        .trim()
        .toLowerCase()
        .replace(" ", "_");
      let fieldValue = $(element).find("dd").text().trim();
      if (fieldText === "document_type") {
        if (fieldValue.includes("•")) {
          fieldValue = fieldValue.substring(0, fieldValue.indexOf("•")).trim();
        }
      }
      article_data[fieldText] = fieldValue;
    });
    const author_keywords = await scrapAuthorKeyword(html);
    if (author_keywords.length > 0) {
      article_data.author_keywords = author_keywords;
    }

    article_data.abstract = $(
      "#doc-details-page-container > article > div:nth-child(4) > section > div > div.margin-size-4-t.margin-size-16-b > p > span"
    ).text();
    article_data.url = url;
    article_data.author_scopus_id = author_scopus_id;
    return article_data;
  } catch (error) {
    console.error("\nError occurred while scraping : ", error);
    return null;
  }
};

const getSourceID = async (page, status) => {
  try {
    const selectorExists = await page.evaluate(() => {
      const element = document.querySelector("#source-preview-flyout");
      return element !== null;
    });

    if (selectorExists) {
      await page.waitForSelector("#source-preview-flyout");
      await page.click("#source-preview-flyout");
      await page.waitForTimeout(1700);
      const elementExists =
        (await page.$("#source-preview-details-link")) !== null;
      if (elementExists) {
        const html = await page.content();
        const $ = cheerio.load(html);
        const source_id = $("#source-preview-details-link")
          .attr("href")
          .split("/")[2];
        let checkUpdateArticle;
        if (typeof status !== "undefined") {
          if (status === "update") {
            checkUpdateArticle = true;
          } else {
            checkUpdateArticle = false;
          }
        }
        if (checkUpdateArticle) {
          // update
          if (!(await checkHasSourceId(source_id))) {
            console.error(
              "\n------------------------------------------------------"
            );
            console.error(
              "---- Add New Journal Of Source ID : ",
              source_id,
              " ----"
            );
            console.error(
              "------------------------------------------------------\n"
            );
            const browser = await puppeteer.launch({ headless: "new" });
            const page = await browser.newPage();
            const link = `https://www.scopus.com/sourceid/${source_id}`;
            await page.goto(link, { waitUntil: "networkidle2" });
            await page.waitForTimeout(1600);
            await waitForElement(
              "#csCalculation > div:nth-child(2) > div:nth-child(2) > div > span.fupValue > a > span"
            );
            // const data = await scraperJournalData(source_id, 0, page);
            const data = await scraperJournalData(
              source_id,
              0,
              page,
              "addJournalNewArticle"
            );
            await browser.close();
            await insertDataToJournal(data, source_id);
            checkAddSourceId = true;
          } else {
            console.log(
              "\n---- Journal Data | Source ID: ",
              source_id,
              " Duplicate data. ----\n"
            );
          }
        } else {
          if (!sourceID.includes(source_id)) {
            sourceID.push(source_id);
          }
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
    console.error("\nError occurred while scraping : ", error);
    return null;
  }
};

const scrapCo_Author = async (page) => {
  try {
    const hasAdditional = await page.evaluate(() => {
      const showAdditionalAffiliationsButton = document.querySelector(
        "#show-additional-authors"
      );
      if (showAdditionalAffiliationsButton) {
        showAdditionalAffiliationsButton.click();
      }

      return !!showAdditionalAffiliationsButton;
    });
    await page.waitForTimeout(500);
    const html = await page.content();
    const $ = cheerio.load(html);
    const content = $(
      "#doc-details-page-container > article > div:nth-child(2) > section > div > div > ul > li, #doc-details-page-container > article > div:nth-child(2) > section > div:nth-child(2) > div > els-collapsible-panel-v2 > section > div > div > ul > li"
    );
    const elementSelector1 =
      "#doc-details-page-container > article > div:nth-child(2) > section > div > div > ul > li";
    const elements1 = $(elementSelector1);

    const co_author_data = [];
    content.each(function () {
      let co_author_name = $(this).find("button > span").text();
      if ($(this).find("a").length > 0) {
        co_author_name = co_author_name + " " + "*";
      }
      co_author_data.push(co_author_name);
    });
    return {
      data: co_author_data,
      last_index: elements1.length,
      hasAdditional: hasAdditional,
    };
  } catch (error) {
    console.error("\nError occurred while scraping : ", error);
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
      const keyword = $(this).text().trim().replace(";", "");
      author_keyword.push(keyword);
    });
    return author_keyword;
  } catch (error) {
    console.error("\nError occurred while scraping : ", error);
    return null;
  }
};

module.exports = {
  scraperArticleScopus,
  getArticleUrl,
  scraperOneArticleScopus,
  scrapeArticleData,
  getArticleDetail,
};
