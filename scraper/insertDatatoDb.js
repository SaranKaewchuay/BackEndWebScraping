
const Author = require('../models/Author.js');
const Article = require('../models/Article.js');
const { ObjectId } = require('mongodb');
process.setMaxListeners(100); 

const insertDataToDb = async (data) => {
  try {
    const objectId = new ObjectId();

    const newAuthor = new Author({
      _id: objectId,
      author_name: data.author_name,
      department: data.department,
      subject_area: data.subject_area,
      image: data.image,
      citation_by: {
        table: data.citation_by.table,
        graph: data.citation_by.graph
      }
    });

    await Promise.all(data.articles.map(async (article) => {
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
    }));

    await newAuthor.save();

    return { success: true };
  } catch (error) {
    // console.error("Error inserting data:", error);
    throw error; 
  }
};


  module.exports = {
    insertDataToDb
  };