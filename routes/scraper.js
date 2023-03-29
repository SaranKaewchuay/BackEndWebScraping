const express = require("express");
const router = express.Router();
const { getArticleOfAuthor, getAllAuthorURL } = require("../scraper/function");

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
  const startURL = "https://scholar.google.com/citations?view_op=view_org&org=16635630670053173100&hl=en&oi=io";
  const authorURL = await getAllAuthorURL(startURL);
 
  let articleOfAuthor = [];
  //authorURL.length
  for (let i = 0; i < 2; i++) {
    console.log("Author ", i + 1, " : " + authorURL[i].name)
    const num = i + 1;
    const data = await getArticleOfAuthor(authorURL[i].url, num);
    articleOfAuthor.push(data)
    console.log(articleOfAuthor)
    await insertDatatoDb(articleOfAuthor)
    articleOfAuthor = []
  }
  console.log("Finish")

  res.status(200).json({
    meseage: "successful",    
  });

});

module.exports = router;