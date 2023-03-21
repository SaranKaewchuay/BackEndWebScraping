const express = require("express");
const router = express.Router();
const { getArticleOfAuthor, getAllAuthorURL, getArticleAll } = require("../scraper/function");

const Author = require('../models/Author.js');
const Article = require('../models/Article.js');
const { ObjectId } = require('mongodb');

const insertDatatoDb = async (all) => {

  all.map(async (author) => {
    const objectId = new ObjectId();

    const newAuthor = new Author({
      _id: objectId,
      authorName: author.authorName,
      department: author.department,
      subjectArea: author.subjectArea,
      h_index: author.h_index,
      image: author.image,
    });

    author.article.map(async (article) => {
      const newArticle = new Article({
        articleName: article.articleName,
        author: article.author,
        releaseDate: article.releaseDate,
        academicJournal: article.academicJournal,
        volume: article.volume,
        no: article.no,
        page: article.page,
        publisher: article.publisher,
        description: article.description,
        url: article.url,
        author_id: objectId,
      });
      return await newArticle.save();
    });
    return await newAuthor.save();
  });
};

router.get("/", async (req, res) => {
  const startURL = "https://scholar.google.com/citations?view_op=view_org&org=16635630670053173100&hl=th&oi=io";
  const selectorForURL = "#gsc_sa_ccl > div.gsc_1usr";
  const authorURL = await getAllAuthorURL(selectorForURL, startURL);

  const selector = "#gsc_a_b > tr";
  let all = [];

  for (let i = 0; i < authorURL.length ; i++) {
    console.log("Author ", i + 1, " : " + authorURL[i].name)
    const num = i + 1;
    const data = await getArticleOfAuthor(selector, authorURL[i].url, num);
    all.push(data.all)
    console.log(all)
    await insertDatatoDb(all)
    all = []
  }
  console.log("Finish")

  res.status(200).json({
    data: all
  });
});

module.exports = router;
