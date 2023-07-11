const express = require("express");
const router = express.Router();
const {
  getAuthorAllDetail,
  getURLScholar,
  getAuthorScholar,
  getArticleScholar,
} = require("../scraper/scholar/function_google_scholar");
const axios = require("axios");
const {
  scraperAuthorScopus,
  scraperOneAuthorScopus,
} = require("../scraper/scopus/fuction_author");
const {
  scraperOneArticleScopus,
} = require("../scraper/scopus/function_article");
const { scrapOneJournal } = require("../scraper/scopus/function_journal");
const { getCountRecordInJournal } = require("../qurey/qurey_function");
const CronJob = require("cron").CronJob;

const {
  scraperArticleScopus,
  sourceID,
  errorURLs,
} = require("../scraper/scopus/function_article");
const { scrapJournal } = require("../scraper/scopus/function_journal");
process.setMaxListeners(100);

router.get("/scraper-scopus-cron", async (req, res) => {
  try {
    axios.get("http://localhost:8000/scraper/scopus-author");
    axios.get("http://localhost:8001/scraper/scopus-article");
    if ((await getCountRecordInJournal()) > 0) {
      axios.get("http://localhost:8002/scraper/scopus-journal");
    }
  } catch (error) {
    console.error("Cron job error:", error);
  }
});

router.get("/scholar", async (req, res) => {
  try {
    const authorURL = await getURLScholar();
    let url_not_ready = [];
    let num_scraping = 0;
    console.log("\nStart Scraping Researcher Data From Google Scholar\n");
    const batchSize = 5;
    //214 284 585
    for (let i = 0; i < authorURL.length; i += batchSize) {
      const batchAuthors = authorURL.slice(i, i + batchSize);
      const scrapingPromises = batchAuthors.map((author, index) => {
        const number_author = i + index + 1;
        return getAuthorAllDetail(author, number_author, authorURL.length);
      });

      // log Scraping
      const batchResults = await Promise.allSettled(scrapingPromises);
      batchResults.forEach((result) => {
        if (result.status === "fulfilled") {
          const data = result.value;
          if (data.all === false) {
            url_not_ready.push(data.url_not_ready);
          } else {
            num_scraping += 1;
          }
        } else if (result.status === "rejected") {
          console.error(`Error: ${result.reason.message}`);
        }
      });
    }
    console.log("\nFinish Scraping Author and Article Data From Scholar\n");

    res.status(200).json({
      message: "Successful scraping",
      num_scraping: num_scraping,
      num_not_ready: url_not_ready.length,
      url_not_ready: url_not_ready,
    });
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

    // Execute both scraper functions concurrently
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
    console.log("\nStart Scraping Author Data From Scopus\n");
    const author = await scraperAuthorScopus();
    console.log("\nFinish Scraping Author Data From Scopus\n");

    res.status(200).json({
      authorScopus: author,
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
    console.log("\nStart Scraping Article Data From Scopus\n");
    const article = await scraperArticleScopus();
    console.log("\nFinish Scraping Article Data From Scopus\n");

    res.status(200).json({
      articleScopus: article,
      all_source_id: sourceID,
      error_URLS: errorURLs,
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
    console.log("\nStart Scraping Journal Data From Scopus\n");
    const journal = await scrapJournal();
    console.log("\nFinish Scraping Journal Data From Scopus\n");

    res.status(200).json({
      journalScopus: journal,
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
    // console.log("scopus_id =", scopus_id);
    console.log("\nStart Scraping Author Scopus\n");
    const author = await scraperOneAuthorScopus(scopus_id);
    console.log("\nFinish Scraping Author Scopus\n");

    res.status(200).json({
      AuthorScopusData: author,
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
    // console.log("scopus_id =", eid);

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

router.get("/scraper-journal-scopus", async (req, res) => {
  try {
    const source_id = req.query.source_id;
    // console.log("source_id =", source_id);

    console.log("\nStart Scraping Journal Scopus\n");
    const journal = await scrapOneJournal(source_id);
    console.log("\nFinish Scraping Journal Scopus\n");

    res.status(200).json({
      JournalScopusData: journal,
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
    // console.log("scholar_id =", scholar_id);

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
    // console.log("scholar_id =", scholar_id);
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
