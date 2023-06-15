const express = require("express");
const router = express.Router();
const { getAuthorAllDetail, getURLScholar } = require("../scraper/function_google_scholar");

const {scraper} = require("../scraper/fuction_scopus");

const Author = require('../models/Author.js');
const Article = require('../models/Article.js');
const { ObjectId } = require('mongodb');

const insertDatatoDb = async (all) => {

  all.map(async (author) => {
    const objectId = new ObjectId();

    const newAuthor = new Author({
      _id: objectId,
      author_name: author.author_name,
      department: author.department,
      subject_area: author.subject_area,
      image: author.image,
      citation_by: {
        table: author.citation_by.table,
        graph: author.citation_by.graph
      }
    });

    author.articles.map(async (article) => {
      const newArticle = new Article({
        article_name: article.article_name,
        authors: article.authors,
        publication_date: article.publication_date,
        conference: article.conference,
        institution: article.institution,
        journal: article.journal,
        volume: article.volume,
        issue: article.issue,
        pages: article.pages,
        publisher: article.publisher,
        description: article.description,
        total_citations: article.total_citations,
        url: article.url,
        author_id: objectId,
      });
      return await newArticle.save();
    });
    return await newAuthor.save();
  });
};


router.get("/scholar", async (req, res) => {
  try {
    const authorURL = await  getURLScholar();
    let authorAllDetail = [];
    let url_not_ready = []
    let num_scraping
    console.log("")
    console.log("Start Scraping Researcher Data \n")

    //authorURL.length
    for (let i = 255; i < 257; i++) {
        console.log("Author ", i + 1, " / ",authorURL.length, ": " + authorURL[i].name)
        console.log("authorURL[i].url = ",authorURL[i].url)
        const number_author = i + 1;
        const data = await getAuthorAllDetail(authorURL[i], number_author);
        if(data.all === false){
          url_not_ready.push(data.url_not_ready)
          continue;
        }
        authorAllDetail.push(data.all)
        await insertDatatoDb(authorAllDetail)
        console.log("")
        console.log("Data insertion was completed successfully")
        console.log("Researcher name: ", authorURL[i].name)
        console.log("")
        authorAllDetail = []
    }
    console.log("")
    console.log("Finish Scraping Researcher Data")

    res.status(200).json({
      meseage: "successful scraping",    
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
    
    const author_scopus = await scraper()

    res.status(200).json({
      meseage: author_scopus ,    
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract data",
    });
  }
});


module.exports = router;