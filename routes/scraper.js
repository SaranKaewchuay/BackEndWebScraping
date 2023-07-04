const express = require("express");
const router = express.Router();
const {
  getAuthorAllDetail,
  getURLScholar,
} = require("../scraper/scholar/function_google_scholar");

const { scraperAuthorScopus } = require("../scraper/scopus/fuction_author");
const {
  scraperArticleScopus,
  sourceID,
} = require("../scraper/scopus/function_article");
const { scrapJournal } = require("../scraper/scopus/function_journal");
process.setMaxListeners(100);


router.get("/scholar", async (req, res) => {
  try {
    const authorURL = await getURLScholar();
    let url_not_ready = [];
    let num_scraping = 0;
    console.log("\nStart Scraping Researcher Data From Google Scholar\n");
    const batchSize = 1;
    //214 284 585
    for (let i = 585; i < 586; i += batchSize) {
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

router.get("/scopus-author", async (req, res) => {
  try {

    console.log("\nStart Scraping Author Data From Scopus\n");
    const author = await scraperAuthorScopus()
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
    const article = await scraperArticleScopus()
    console.log("\nFinish Scraping Article Data From Scopus\n");

    res.status(200).json({
      articleScopus: article,
      all_source_id: sourceID,
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

module.exports = router;
