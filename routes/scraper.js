const express = require("express");
const router = express.Router();
const { getAuthorAllDetail, getURLScholar } = require("../scraper/function");

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


router.get("/", async (req, res) => {
  try {
    const authorURL = await  getURLScholar();
    let authorAllDetail = [];
    console.log("")
    console.log("Start Scraping Researcher Data \n")

    //authorURL.length
    for (let i = 9; i < authorURL.length; i++) {
      console.log("Author ", i + 1, " / ",authorURL.length, ": " + authorURL[i].name)
      const number_author = i + 1;
      console.log("authorURL[i] = ",authorURL[i].url)
      const data = await getAuthorAllDetail(authorURL[i], number_author);
      
      authorAllDetail.push(data)
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
      meseage: "successful",    
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Unable to extract data",
    });
  }
});


module.exports = router;