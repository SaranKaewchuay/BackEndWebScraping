const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

const { getScopusID } = require("../scopus/function_article");

const batchSize = 3;
let roundScraping = 0;
let allAuthors = [];

const collectSource = async (serviceName) => {
    const allURLs = await getURLScopus();
    const batchSize = 10;
      
    try {
      for (let i = roundScraping; i < allURLs.length; i += batchSize) {
        console.log("\nroundScraping == ", roundScraping, "\n");
        const batchURLs = allURLs.slice(i, i + batchSize);
        roundScraping = i
        const batchPromises = batchURLs.map(async (url, index) => {
          const browser = await puppeteer.launch({ headless: true });
          const page = await browser.newPage();
  
          try {
            if (serviceName === "author-scopus") {
              const authorIndex = roundScraping + index;
              console.log(
                `Scraping Author ${authorIndex + 1} of ${allURLs.length}: ${url.name}`
              );
              console.log(`URL: ${url.url}`);
              let countRecordInAuthor = await getCountRecordInAuthor();
              console.log("countRecordInAuthor =", countRecordInAuthor);
  
              const allAuthors = [];
              const promises = batchURLs.map((url, index) =>
                scrapeSingleURL(url, roundScraping + index, allAuthors)
              );
  
              const results = await Promise.allSettled(promises);
              await processBatchResults(
                results,
                batchURLs,
                countRecordInAuthor,
                serviceName
              );
              console.log("Finish Scraping Scopus");
              return allAuthors;
            } else if (serviceName === "article-scopus") {
              const scopus_id = await getScopusID(url.url);
              console.log(
                `Scraping Author ${roundScraping + index + 1} of ${
                  allURLs.length
                }: ${url.name}`
              );
              console.log(`URL: ${url.url}`);
  
              await page.goto(url.url, { waitUntil: "networkidle2" });
              await page.waitForTimeout(1600);
              await page.waitForSelector(
                "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(2) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc"
              );
  
              const article = await scraperArticleScopus(page, scopus_id);
              return article;
            }
          } catch (error) {
            console.error("\nError occurred while scraping\n", error);
            return [];
          } finally {
            await browser.close();
          }
        });
  
        await Promise.all(batchPromises);
      }
    } catch (error) {
      console.error("Error occurred in the main loop\n", error);
    }
  };



  const processBatchResults = async (results, batchURLs, countRecordInAuthor, serviceName) => {
    console.log("Num Scraping Finish =", results.length);
    const mappedResults = results.map((result) => result.value.author !== null);
    const hasFalse = mappedResults.includes(false);
    const finalResult = !hasFalse;
    console.log("mappedResults = ", mappedResults);
  
    if (finalResult) {
      if (results.length === batchSize || results.length === batchURLs.length) {
        for (const result of results) {
          if (result.status === "fulfilled") {
            const data = result.value.author;
            if (countRecordInAuthor > 0) {
              console.log("\n-----------------");
              console.log("Update Author");
              console.log("-----------------");
              await updateDataToAuthor(data);
            } else {
              console.log("\n------------------");
              console.log("First Scraping Author");
              console.log("------------------");
              await insertAuthorDataToDbScopus(data, data.name);
            }
          } else if (result.status === "rejected") {
            console.error("\nError occurred while scraping\n");
            await collectSource();
          }
        }
        roundScraping += batchSize;
      } else {
        console.log("!== batchsize");
        await collectSource(serviceName);
      }
    } else {
      console.log("have author null");
      await collectSource(serviceName);
    }
  };