const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { getURLScopus } = require("./fuction_author");
const {
  insertArticleDataToDbScopus,
  insertDataToJournal,
} = require("../insertToDb/insertToDb");
const {
  getOldNumDocInPage,
  getOldAuthorData,
  getNumArticleOfAuthorInDB,
  checkHasSourceId,
  getArticleOfAuthorNotPage,
  addCountDocumenInWu,
  getCountRecordInArticle,
  getCountRecordInJournal,
  getOldNumArticleInWU,
  addFieldPageArticle
} = require("../../qurey/qurey_function");
const { scraperJournalData, scrapJournal } = require("./function_journal");
// const allURLs = require("../../../json/scopus");
const { readUrlScopusData } = require("../scopus/function_Json");

const batchSize = 1;
//318
let roundScraping = 2;
let allArticle = [];
let checkUpdate;
let checkNotUpdate;
let checkFirst;
let errorURLs = [];
let sourceID = [];
let linkError = [];



const checkStrings = (array, strings) => strings.some((str) => array.includes(str));

const mapDataToArticle = async (data, article_data, stringsToCheck) => {
  let [fieldText, fieldValue] = data.split(" ");
  const checkField = checkStrings(data, stringsToCheck);
  if (checkField) {
    const lowerCaseFieldText = fieldText.toLowerCase();
    if (lowerCaseFieldText == "pages") {
      const page = data.split(" ");
      fieldValue = page.slice(1).join(" ");
    }
    article_data[lowerCaseFieldText] = fieldValue;
  }
};

const scraperArticlePageUpdate = async (scopus_id, page) => {
  try {
    const link_Article = await getArticleOfAuthorNotPage(scopus_id);
    console.log("\nNum Article Not Have Field Page : ", link_Article.length, "\n");
    let roundArticleScraping = 0; 
    const batchSize = 7;
    // let articleCount = 0;
    for (let i = roundArticleScraping; i < link_Article.length; i += batchSize) {
      roundArticleScraping = i;
      const batchUrls = link_Article.slice(i, i + batchSize);
      const promises = batchUrls.map(async (article_url, index) => {
        try {
          const articlePage = await page.browser().newPage();
          await articlePage.goto(article_url, { waitUntil: "networkidle2" })
          const html = await articlePage.content();
          const $ = cheerio.load(html);
          // console.log("Article |",i,"| This Article EID : ",await getE_Id(article_url));
          const detail1 = $("#doc-details-page-container > article > div:nth-child(1) > div > div > span:nth-child(2)").text().split(",").map((item) => item.trim());
          const detail2 = $("#doc-details-page-container > article > div:nth-child(1) > div > div > span:nth-child(3)").text().split(",").map((item) => item.trim());
          const stringsToCheck = ["Pages"];
          let data = []
          if (detail1[0] !== "") {
            data = detail1
          } else if (detail2[0] !== "") {
            data = detail2
          }
          const article_data = {} 

          await Promise.all(
            data.map((data) => mapDataToArticle(data, article_data, stringsToCheck))
          );
          const hasPageField = article_data.hasOwnProperty("pages");
          const eid = await getE_Id(article_url)
          if(hasPageField){
            console.log("Article EID | ",eid," Page Update | Pages : ",article_data.pages)
            await addFieldPageArticle(eid,scopus_id, article_data.pages)
          }else{
            console.log("Article EID | ",eid," Page is not update")
          }
          
        } catch (error) {
          console.error("\nError occurred while scraping\n", error);
        }
      });

      await Promise.all(promises); // Wait for all promises to resolve
    }
  } catch (error) {
    console.error("\nError occurred while scraping\n", error);
  }
};



const scraperArticleScopus = async () => {
  try {
    await getOldAuthorData();

    // const allURLs = await readUrlScopusData();
    const allURLs = await getURLScopus();

    //allURLs.length
    while (roundScraping < 3) {
      console.log("\nRound Scraping : ", roundScraping, "\n");
      const batchURLs = allURLs.slice(roundScraping, roundScraping + batchSize);

      const batchPromises = batchURLs.map(async (url, index) => {
        checkUpdate = false;
        checkNotUpdate = false;
        checkFirst = false;
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        try {
          const scopus_id = await getScopusID(url.url);
          console.log(
            `Scraping Author ${roundScraping + index + 1} of ${
              allURLs.length
            }: ${url.name}`
          );
          console.log(`URL: ${url.url}`);

          const response = await page.goto(url.url, {
            waitUntil: "networkidle2",
          });
          await page.waitForTimeout(1600);

          const selector_num_doc =
            "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(2) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc";
          await waitForElement(selector_num_doc);

          if (response.ok()) {
            const html = await page.content();
            const numDocInPage = await getDocumentInpage(html);
            const oldNumDocInPage = await getOldNumDocInPage(scopus_id);
            const numArticleOfAuthor = await getNumArticleOfAuthorInDB(
              scopus_id
            );
            const checkNumDoc = {
              numDocInPage: numDocInPage,
              oldNumDocInPage: oldNumDocInPage,
            };
            let article_data;
            if (numArticleOfAuthor === 0) {
              checkFirst = true;
              const article = await scrapeArticleData(
                url.url,
                page,
                0,
                url.name,
                checkNumDoc,
                numDocInPage,
                checkFirst,
                scopus_id
              );
              article_data = article.article;
              allArticle = allArticle.concat(article_data);
              
              return {
                status: "fulfilled",
                article: article_data,
                scopus_id: scopus_id,
                checkFirst: checkFirst,
                author_name: url.name,
              };
            } else if (numDocInPage !== oldNumDocInPage) {
              checkUpdate = true;
              const numNewDoc = numDocInPage - oldNumDocInPage;
              checkNumDoc.numNewDoc = numNewDoc;

              const article = await scrapeArticleData(
                url.url,
                page,
                numNewDoc,
                url.name,
                checkNumDoc,
                numDocInPage,
                checkFirst = false,
                scopus_id
              );

              article_data = article.article;
              allArticle = allArticle.concat(article_data);
              // allArticle.push(article_data);

              await scraperArticlePageUpdate(scopus_id, page)

              return {
                status: "fulfilled",
                article: article_data,
                scopus_id: scopus_id,
                checkUpdate: checkUpdate,
                numDocInPage: numDocInPage,
                author_name: url.name,
              };
            } else if (numDocInPage === oldNumDocInPage) {
              checkNotUpdate = true;
              console.log(
                "\n-----------------------------------------------------"
              );
              console.log("Article Of ", url.name, " is not update.");
              console.log(
                "-----------------------------------------------------"
              );
              console.log("Number Of Article In Web Page : ", numDocInPage);
              console.log("Number Of Article In Database : ", oldNumDocInPage);

              await scraperArticlePageUpdate(scopus_id, page)

              return {
                status: "fulfilled",
                article: [],
                checkNotUpdate: checkNotUpdate,
              };
            } else {
              return { status: "fulfilled", article: [] };
            }
          } else {
            linkError.push({ name: url.name, url: url.url });
          }
        } catch (error) {
          console.error("\nError occurred while scraping\n", error);
          return { status: "rejected" };
        } finally {
          await browser.close();
        }
      });

      const results = await Promise.allSettled(batchPromises);
      const mappedResults = results.map(
        (result) =>
          result.value.article !== null && result.value.status !== "rejected"
      );
      console.log("mappedResults = ", mappedResults);
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
            if (result.status === "fulfilled") {
              const data = result.value;
              if (data.article.length !== 0 || data.checkUpdate) {
                
              } else if (data.checkNotUpdate) {
                continue;
              } else {
                console.log("------ Array 0 --------");
              }
            } else if (result.status === "rejected") {
              console.error("\nError occurred while scraping\n", error);
              await scraperArticleScopus();
              return;
            }
          }
          if ( // เปลี่ยนเป็นเช็คว่าถ้า source มี source id ที่่ ใหม่ ไม่ซ่ำ ส่งไปสกัด
            sourceID.length > 0 &&
            (await getCountRecordInArticle()) > 0 &&
            (await getCountRecordInJournal()) > 0
          ) {
            await scrapJournal(sourceID);
          }
        } else {
          console.log("!== batchsize");
          await scraperArticleScopus();
          return;
        }
      } else {
        console.log("have author null");
        await scraperArticleScopus();
        return;
      }

      for (const result of rejectedResults) {
        // console.error("Error occurred while scraping:", result.reason);
        const errorIndex = rejectedResults.indexOf(result);
        errorURLs.push(allURLs[roundScraping + errorIndex]);
      }
      roundScraping += batchSize;
    }
    let numScraping = allArticle.length
    let error = linkError
    roundScraping = 0;
    allArticle = [];
    errorURLs = [];
    sourceID = [];
    linkError = [];
    // console.log("Finish Scraping Scopus");
    return {
      message: "Finish Scraping Article Scopus",
      error: error,
      numScraping: numScraping,
    };
  } catch (error) {
    console.error("\nError occurred while scraping\n", error);
    await scraperArticleScopus();
    return null;
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
        // await page.waitForTimeout(1600)
        await waitForElement(waitElement);

        const check = await checkArticleWU(articlePage);

        if (check.status) {
          const article_data = await getArticleDetail(
            articlePage,
            url,
            check.department
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
    console.error("\nError occurred while scraping\n");
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

    const found = affiliationText
      .toLowerCase()
      .includes(searchString.toLowerCase());

    return {
      status: found,
      department: found ? department : undefined,
    };
  } catch (error) {
    console.error("\nError occurred while scraping\n");
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
  article_detail
) => {
  const batchSize = 7;
  const link_not_wu = [];

  let lengthArticle = numNewDoc === 0 ? link_Article.length : numNewDoc;
  let sizeLoop = numNewDoc < batchSize && numNewDoc > 0 ? numNewDoc : batchSize;
  let articleCount = 0;

  for (let i = roundArticleScraping; i < lengthArticle; i += sizeLoop) {
    const article = [];
    roundArticleScraping = i;
    console.log("Round Article Scraping : ", roundArticleScraping);
    const batchUrls = link_Article.slice(i, i + sizeLoop);
    const promises = batchUrls.map(async (article_url, index) => {
      try {
        const articlePage = await page.browser().newPage();
        await Promise.all([
          articlePage.goto(article_url, { waitUntil: "networkidle2" }),
          articlePage.waitForTimeout(1600),
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
              "| This Article EID : ",
              await getE_Id(article_url)
            );
          } else {
            console.log(
              "Article |",
              articleCount,
              "| This Article EID : ",
              await getE_Id(article_url),
              " does not belong to the Walailak Department."
            );
          }
        } else {
          console.log(
            "Article |",
            articleCount,
            "| Add New Article EID : ",
            await getE_Id(article_url),
            " of ",
            author_name
          );
        }

        if (!check.status) {
          link_not_wu.push(article_url);
          articlePage.close();
          return { article: {}, status: "skip" };
        }

        if (check.status) {
          const article_data = await getArticleDetail(
            articlePage,
            article_url,
            check.department,
            url
          );
          articlePage.close();
          return { article: article_data, status: "articleOfWu" };
        } else {
          articlePage.close();
          return { article: {}, status: "skip" };
        }
      } catch (error) {
        console.error("Failed to scrape article:", error);
        articlePage.close();
        return null;
      }
    });

    const results = await Promise.allSettled(promises);
    const mappedResults = results.map(
      (result) =>
        result.value.article !== null && result.value.status !== "rejected"
    );
    console.log("ArticleStatusResults : ", mappedResults);
    const hasFalse = mappedResults.includes(false);
    const finalResult = !hasFalse;
    if (finalResult) {
      await Promise.all(
        results.map(async (result) => {
          if (result.status === "fulfilled" && result.value !== null) {
            if (result.value.status === "articleOfWu") {
              const data = result.value.article;
              article.push(data);
              article_detail.push(data);
            }
          }
        })
      );
      if(article.length > 0){
        await insertArticleDataToDbScopus(
          article,
          author_name,
          roundArticleScraping,
          batchSize
        );
      }else{
        console.log('\nArticles '+ (roundArticleScraping+Number(1)) +' to '+ (roundArticleScraping + batchSize +Number(1)) +' of | ' + author_name + ' does not belong to the Walailak Department.\n');
      }
      roundArticleScraping += batchSize;
    } else {
      await scrapeArticlesBatch(
        page,
        link_Article,
        numNewDoc,
        author_name,
        url,
        roundArticleScraping,
        article_detail
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
  scopus_id
) => {
  try {
    await page.waitForSelector("#preprints");
    await page.click("#preprints");
    await page.waitForSelector("#documents");
    await page.click("#documents");
    let html;

    if (numNewDoc == 0) {
      if(numDocInPage > 10){
        const waitElement2 =
        "#documents-panel > div > div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > els-paginator > nav > els-select > div > label";
        await waitForElement(waitElement2);
        const waitElement3 =
          "#documents-panel > div > div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > els-paginator > nav > els-select > div > label > select";
        await page.select(waitElement3, "200");
        await page.waitForTimeout(1500);
      }
    }

    const waitElement1 =
      "#documents-panel > div > div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > div:nth-child(2) > ul > li:nth-child(1) > div > div.col-lg-21.col-md-18.col-xs-18 > div.list-title.margin-size-24-t.margin-size-0-b.text-width-32 > h4 > a > span > span";

    await waitForElement(waitElement1);
    html = await page.content();

    let link_Article = await getArticleUrl(html, numNewDoc);

    if (link_Article.length === 0) {
      console.log("Catch 1111 **");
    } else {
      if (checkFirst) {
        console.log("\n------------------------------------------");
        console.log("First Scraping | ", author_name);
        console.log("------------------------------------------");
        console.log(
          "\nNumber of Articles In scopus of ",
          author_name,
          ": ",
          link_Article.length
        );
      } else if (checkUpdate) {
        console.log("\n----------------------------------------------");
        console.log("Scraping Add New Article of ", author_name);
        console.log("----------------------------------------------");
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
      const { link_not_wu } = await scrapeArticlesBatch(
        page,
        link_Article,
        numNewDoc,
        author_name,
        url,
        roundArticleScraping,
        article_detail
      );

      if (checkFirst) {
        await addCountDocumenInWu(
          scopus_id,
          article_detail.length,
          author_name
        );
      } else {
        const articleInWU =
        Number(await getOldNumArticleInWU(scopus_id)) +
        article_detail.length;
        await addCountDocumenInWu(
          scopus_id,
          articleInWU,
          author_name
        );
      }

      return { article: article_detail, link_not_wu: link_not_wu };
    }
  } catch (error) {
    console.error("\nError occurred while scraping\n");
    console.error("---- Article Error ----", error);
    return { article: null, link_not_wu: null };
  }
};

const getScopusID = async (url) => {
  try {
    const match = url.match(/authorId=\d+/)[0];
    const scopusID = match.match(/=(\d+)/)[1];
    return scopusID;
  } catch (error) {
    console.error("\nError occurred while scraping\n");
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
    console.error("Error occurred while scraping:", error);
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
    console.error("\nError occurred while scraping\n");
    return null;
  }
};


const scraperCorresponding = async (html) => {
  const $ = cheerio.load(html);
  const data = $("p.corrAuthSect").text().trim().replace(/©.*$/, "");

  const emails = [];
  const emailRegex = /([^;]+);[^:]+:([^ ]+)/g;
  let match;
  
  while ((match = emailRegex.exec(data))) {
    const email = match[2].trim();
    emails.push(email);
  }
  const detailsSplitRegex = /email:.+?(?=\s{2}|$)/g;
  const sections = data.split(detailsSplitRegex).map((str) => str.trim()).filter(Boolean);

  const corresponding = sections.map((str, index) => {
    const semicolonSplit = str.split(';');
    const corresName = semicolonSplit[0].trim();
    const address = semicolonSplit[1].trim();
    const email = emails[index];

    return { corresName, address, email };
  });

  return corresponding; 
};





const getArticleDetail = async (page, url, department, author_url) => {
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

    const source_id = await getSourceID(page, author_scopus_id);
    const check_journal = source_id ? true : false;
    const $ = cheerio.load(html);
    const  coAuthor = await scrapCo_Author(html)
    const article_data = {
      eid: await getE_Id(url),
      name: $(
        "#doc-details-page-container > article > div:nth-child(2) > section > div.row.margin-size-8-t > div > h2 > span"
      ).text(),
      ...(check_journal && { source_id: source_id }),
      first_author: coAuthor[0].replace(" *",""),
      co_author: coAuthor,
      co_author_department: await department,
      corresponding: await scraperCorresponding(html)
    };

    const detail1 = $("#doc-details-page-container > article > div:nth-child(1) > div > div > span:nth-child(2)").text().split(",").map((item) => item.trim());
    const detail2 = $("#doc-details-page-container > article > div:nth-child(1) > div > div > span:nth-child(3)").text().split(",").map((item) => item.trim());
    const stringsToCheck = ["Volume", "Issue", "Pages"];
    if (detail1[0] !== "") {
      await Promise.all(
        detail1.map((data) => mapDataToArticle(data, article_data, stringsToCheck))
      );
    } else if (detail2[0] !== "") {
      await Promise.all(
        detail2.map((data) => mapDataToArticle(data, article_data, stringsToCheck))
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
    console.error("\nError occurred while scraping\n", error);
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
      await page.waitForTimeout(1700);
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
          if (!(await checkHasSourceId(source_id))) {
            console.error("\n-------------------------");
            console.error("---- Add New Journal ----");
            console.error("-------------------------\n");
            const browser = await puppeteer.launch({ headless: "new" });
            const page = await browser.newPage();
            const link = `https://www.scopus.com/sourceid/${source_id}`;
            await page.goto(link, { waitUntil: "networkidle2" });
            await page.waitForTimeout(1600);
            await waitForElement(
              "#csCalculation > div:nth-child(2) > div:nth-child(2) > div > span.fupValue > a > span"
            );
            const data = await scraperJournalData(source_id, 0, page);
            await browser.close();
            await insertDataToJournal(data, source_id);
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
    console.error("\nError occurred while scraping\n");
    return null;
  }
};

const scrapCo_Author = async (html) => {
  try {
    const $ = cheerio.load(html);
    const content = $(
      "#doc-details-page-container > article > div:nth-child(2) > section > div > div > ul > li"
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
    console.error("\nError occurred while scraping\n");
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
    console.error("\nError occurred while scraping\n");
    return null;
  }
};

module.exports = {
  scraperArticleScopus,
  sourceID,
  errorURLs,
  getArticleUrl,
  scraperOneArticleScopus,
  scrapeArticleData,
  getArticleDetail,
};
