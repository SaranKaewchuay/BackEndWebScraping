const express = require("express");
const router = express.Router();
const {
  getAuthorAllDetail,
  getURLScholar,
} = require("../scraper/function_google_scholar");

const { scraper } = require("../scraper/fuction_scopus");
process.setMaxListeners(100);

router.get("/scholar", async (req, res) => {
  try {
    const authorURL = await getURLScholar();
    let url_not_ready = [];
    let num_scraping = 0;
    console.log("\nStart Scraping Researcher Data\n");

    const batchSize = 20;

    for (let i = 0; i < authorURL.length; i += batchSize) {
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
            num_scraping += 1;
          }
        } else if (result.status === "rejected") {
          console.error(`Error: ${result.reason.message}`);
        }
      });
    }

    console.log("");
    console.log("Finish Scraping Researcher Data");

    res.status(200).json({
      message: "Successful scraping",
      num_scraping: num_scraping,
      num_not_ready: url_not_ready.length,
      url_not_ready: url_not_ready,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract data",
    });
  }
});

router.get("/scopus", async (req, res) => {
  try {
    const author_scopus = await scraper();

    res.status(200).json({
      meseage: author_scopus,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract data",
    });
  }
});

module.exports = router;