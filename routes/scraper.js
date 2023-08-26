const express = require("express");
const router = express.Router();
const {
  getAuthorAllDetail,
  getAuthorScholar,
  getArticleScholar,
  getURLScholar
} = require("../scraper/scholar/function_google_scholar");
const axios = require("axios");
const {
  scraperAuthorScopus,
} = require("../scraper/scopus/function_author");
const {
  scraperOneArticleScopus,
  scraperArticleScopus,  
} = require("../scraper/scopus/function_article");
const { scrapJournal, resetVariableJournal } = require("../scraper/scopus/function_journal");
const {
  getOldAuthorData,
  getCountRecordInArticle,
  resetLogScraping,
  getLogScraping,
  getNowDateTime
} = require("../qurey/qurey_function");
const puppeteer = require("puppeteer");


const { createLogFile } = require("../scraper/scopus/function_Json");
(async () => {
  await getOldAuthorData();
})();

const { getBaseURL } = require('../qurey/baseURL')
const baseApi = require('../scraper/baseApi')


const logging = async () => {
  try {
    const logScraping = getLogScraping();

    resetLogScraping();

    const journalLog = {
      numJournalScraping: logScraping.journal.numJournalScraping,
      numUpdateCiteScoreYear: logScraping.journal.numUpdateCiteScoreYear
    }
    const finishLog = {
      message: "Scraping Data For Scopus Completed Successfully.",
      finishTime: getNowDateTime(),
      numAuthorScraping: logScraping.author.numAuthorScraping,
      numArticleScraping: logScraping.article.numArticleScraping,
      numJournalScraping: journalLog,
      errorLinkRequest: logScraping.error,
    };

    await createLogFile(finishLog, "scopus");

    return finishLog
  } catch (error) {

    console.error("An error occurred:", error);
  }
};

let finshLogScholar

router.get("/scraper-scopus-cron", async (req, res) => {
  try {
    await getOldAuthorData();
    const articleCount = await getCountRecordInArticle();

    let journalRequest;
    const authorRequest = axios.get(
      `${baseApi}scraper/scopus-author`
    );
    const articleRequest = axios.get(
      `${baseApi}scraper/scopus-article`
    );
    if (articleCount !== 0) {
      journalRequest = axios.get(
        `${baseApi}scraper/scopus-journal`
      );
    }
    let finishLog

    if (articleCount === 0) {
      console.log("Scrap")
      await Promise.all([authorRequest, articleRequest]);
      setTimeout(async () => {
        await axios.get(`${baseApi}scraper/scopus-journal`);
        finishLog = await logging()
        resetVariableJournal();
        // await createLogFile(finshLogScholar, "scholar");
        res.status(200).json(finishLog);
      }, 1500);
    } else {
      await Promise.all([authorRequest, articleRequest, journalRequest]);
      finishLog = await logging()
      resetVariableJournal();
      // await createLogFile(finshLogScholar, "scholar");
      res.status(200).json(finishLog);
    }
    console.log("\n---------------------------------------------------------------")
    console.log("Finsih Log Scraping : ",finishLog)
    console.log("---------------------------------------------------------------\n")


  } catch (error) {
    console.error("Cron job error:", error);
    res.status(500).json({
      error: "Internal server error.",
    });
  }
});


router.get("/scholar", async (req, res) => {
  try {
    let count = 0;
    const authorURL = await getURLScholar();


    let url_not_ready = [];
    let num_scraping = 0;
    console.log("\nStart Scraping Researcher Data From Google Scholar\n");
    const batchSize = 5;
    // authorURL.length
    for (let i = 255; i < authorURL.length; i += batchSize) {
      const batchAuthors = authorURL.slice(i, i + batchSize);
      const scrapingPromises = batchAuthors.map((author, index) => {
        const number_author = i + index + 1;
        return getAuthorAllDetail(author, number_author, authorURL.length);
      });

      const batchResults = await Promise.allSettled(scrapingPromises);
      batchResults.forEach((result) => {
        if (result.status === "fulfilled") {
          const data = result.value;
          if (data.all === false) {
            url_not_ready.push(data.url_not_ready);
          } else {
            count += data.num;
            num_scraping += 1;
          }
        } else if (result.status === "rejected") {
          console.error(`Error: ${result.reason.message}`);
        }
      });
    }
    finshLogScholar = {
      message: "Scraping Data For Scholar Completed Successfully.",
      finishTime: getNowDateTime(),
      numAuthorScraping: num_scraping,
      numArticleScraping: count,
      errorLinkRequest: url_not_ready,
    }
    await createLogFile(finshLogScholar ,"scholar");

    console.log("\n----------------------------------------------------------------")
    console.log("Finish Scraping Author and Article Data From Scholar : ", finshLogScholar)
    console.log("----------------------------------------------------------------\n")

    res.status(200).json(finshLogScholar);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract author and article data from google scholar",
    });
  }
});

router.get("/scopus-data", async (req, res) => {
  try {
    console.log("\nStart Scraping Data From Scopus\n");

    const [author, article] = await Promise.all([
      scraperAuthorScopus(),
      scraperArticleScopus(),
    ]);

    console.log("\nFinish Scraping Data From Scopus\n");

    res.status(200).json({
      authorScopus: author,
      articleScopus: article,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract data from Scopus",
    });
  }
});

router.get("/scopus-author", async (req, res) => {
  try {
    console.log("\n **** Start Scraping Author Data From Scopus **** \n");
    const author = await scraperAuthorScopus();
    console.log("\n **** Finish Scraping Author Data From Scopus **** \n");

    res.status(200).json({
      authorScopus: "Scraping Author Success",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract authors data from scopus",
    });
  }
});

router.get("/scopus-article", async (req, res) => {
  try {
    console.log("\n **** Start Scraping Article Data From Scopus + **** \n");
    const article = await scraperArticleScopus();
    console.log("\n **** Finish Scraping Article Data From Scopus **** \n");

    res.status(200).json({
      articleScopus: "Scraping Article Success"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract articles data from scopus",
    });
  }
});

router.get("/scopus-journal", async (req, res) => {
  try {
    console.log("\n **** Start Scraping Journal Data From Scopus ****\n");
    const journal = await scrapJournal();
    console.log("\n **** Finish Scraping Journal Data From Scopus ****\n");
    res.status(200).json({
      journalScopus: "Scraping Journal Success"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract journals data from scopus",
    });
  }
});

// ------------------------------------------------------------------- //

router.get("/scraper-author-scopus", async (req, res) => {
  try {
    const scopus_id = req.query.scopus_id;
    console.log("\nAll Scopus Id : ",scopus_id, "\n")
    const allURLs = scopus_id.split(",").map((e) => ({
      name: e.trim(),
      scopus_id: e.trim()
    }));
    console.log("\nStart Scraping Author Scopus\n");
    const message = await scraperAuthorScopus(allURLs);
    console.log("\nFinish Scraping Author Scopus\n");
    res.status(200).json({
      AuthorScopusData: message,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract Authors data from scopus",
    });
  }
});

router.get("/scraper-article-scopus", async (req, res) => {
  try {
    const eid = req.query.eid;
    console.log("\nStart Scraping Article Scopus\n");
    const article = await scraperOneArticleScopus(eid);
    console.log("\nFinish Scraping Article Scopus\n");

    res.status(200).json({
      ArticleScopusData: article,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract Authors data from scopus",
    });
  }
});

router.get("/scraper-articleOfauthor-scopus", async (req, res) => {
  try {
    const scopus_id = req.query.scopus_id;
    console.log("\nAll Scopus Id : ",scopus_id, "\n")
    const allScopusId = scopus_id.split(",").map((e) => ({
      name: e.trim(),
      scopus_id: e.trim()
    }));
    console.log("\nStart Scraping Article Scopus\n");
    const message = await scraperArticleScopus(allScopusId)
    console.log("\nFinish Scraping Article Scopus\n");


    res.status(200).json({
      AuthorScholarData: message,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract Authors data from scopus",
    });
  }
});

router.get("/scraper-journal-scopus", async (req, res) => {
  try {
    const source_id = req.query.source_id;
    const allSourceId = source_id.split(",").map((e) => e.trim());
    console.log("\nStart Scraping Journal Scopus\n");
    const message = await scrapJournal(allSourceId)
    console.log("\nFinish Scraping Journal Scopus\n");

    res.status(200).json({
      JournalScopusData: message,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract Authors data from scopus",
    });
  }
});

router.get("/scraper-author-scholar", async (req, res) => {
  try {
    const scholar_id = req.query.id;
    console.log("\nStart Scraping Author Scholar\n");
    const author = await getAuthorScholar(scholar_id);
    console.log("\nFinish Scraping Author Scholar\n");

    res.status(200).json({
      AuthorScholarData: author.all,
      URL_Not_Ready: author.url_not_ready,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract Authors data from scopus",
    });
  }
});

router.get("/scraper-article-scholar", async (req, res) => {
  try {
    const scholar_id = req.query.id;
    console.log("\nStart Scraping Article Scholar\n");
    const article = await getArticleScholar(scholar_id);
    console.log("\nFinish Scraping Article Scholar\n");

    res.status(200).json({
      AuthorScholarData: article.all,
      URL_Not_Ready: article.url_not_ready,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract Authors data from scopus",
    });
  }
});

module.exports = router;