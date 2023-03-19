const express = require("express");
const router = express.Router();
const { getArticleOfAuthor, getAllAuthorURL, getArticleAll } = require("../scraper/function");

const Author = require('../models/Author.js');
const Article = require('../models/Article.js');
const { ObjectId } = require('mongodb');

var Articles = []
var Authors = []
var All = []


router.post('/author', async (req, res, next) => {

  const authorPromises = All.map(async (author) => {
    const objectId = new ObjectId();

    const newAuthor = new Author({
      _id: objectId,
      authorName: author.authorName,
      department: author.department,
      subjectArea: author.subjectArea,
      h_index: author.h_index,
      image: author.image,
    });

    const articlePromises = author.article.map(async (article) => {
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

    const savedArticles = await Promise.all(articlePromises);

    return await newAuthor.save();
  });

  const savedAuthors = await Promise.all(authorPromises);

  // Return the saved authors and their corresponding articles
  res.json(savedAuthors);
});

// router.post('/author', async (req, res, next) => {
//   try {
//     const authorPromises = Authors.map(async (author) => {
//       const _id = new ObjectId();
//       const newAuthor = new Author({
//         _id: _id,
//         authorName: author.authorName,
//         department: author.department,
//         subjectArea: author.subjectArea,
//         h_index: author.h_index,
//         image: author.image,
//       });

//       const articlePromises = All.map(async (article) => {
//         for(let i = 0 ; i <  author; i++) {
//           const newArticle = new Article({
//             "articleName": article.articleName,
//             "author": article.author,
//             "releaseDate": article.releaseDate,
//             "academicJournal": article.academicJournal,
//             "volume": article.volume,
//             "no": article.no,
//             "page": article.academicJournal,
//             "description": article.page,
//             "url": article.url,
//             "author_id": _id,
//           });
//           return await newArticle.save()
//         }
//         return await newAuthor.save();
//         // return await newArticle.save();
//       })

//     });

//     const authors = await Promise.all(authorPromises);
//     const articles = await Promise.all(articlePromises);
//     res.json(authors);
//   } catch (error) {
//     next(error);
//   }
// });


router.get("/", async (req, res) => {
  const startURL = "https://scholar.google.com/citations?view_op=view_org&org=16635630670053173100&hl=th&oi=io";
  const selectorForURL = "#gsc_sa_ccl > div.gsc_1usr";
  const authorURL = await getAllAuthorURL(selectorForURL, startURL);

  const selector = "#gsc_a_b > tr";
  const author = [];
  const all = [];

  for (let i = 0; i < 3; i++) {
    console.log("Author ", i + 1, " : " + authorURL[i].name)
    const num = i + 1;
    const data = await getArticleOfAuthor(selector, authorURL[i].url, num);
    author.push(data.author);
    all.push(data.all)
  }
  console.log("Finish")

  Ariticles = await getArticleAll()
  Authors = author
  All = all
  res.status(200).json({
    data: all
  });
});

module.exports = router;
