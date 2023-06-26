const Author = require('../models/Author');
const Article = require('../models/Article');
const AuthorScopus = require('../models/AuthorScopus');
const ArticleScopus = require('../models/ArticleScopus.js');
const Journal = require('../models/journal.js');

const { ObjectId } = require('mongodb');
process.setMaxListeners(100);

const insertDataToDbScholar = async (data) => {
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
            graph: data.citation_by.graph,
          },
        });
    
        if (data.articles) {
          data.articles.map(async (article) => {
            if (article) {
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
            }
          });
        }
    
        return await newAuthor.save();
      } catch (error) {
        console.error("Error inserting data:", error);
        throw error;
      }
};

const insertDataToDbScopus = async (data) => {
    try {
        const objectId = new ObjectId();

        const newAuthor = new AuthorScopus({
            _id: objectId,
            author_name: data.name,
            citations_by: data.citations_by,
            documents: data.documents,
            h_index: data.h_index,
            subject_area: data.subject_area,
            citations_graph: data.citations_graph,
            documents_graph: data.documents_graph,
            url: data.url,
        });

        const articles = data.articles.map((articleData) => ({
            article_name: articleData.name,
            co_author: articleData.co_author,
            document_type: articleData.document_type,
            source_type: articleData.source_type,
            issn: articleData.issn,
            original_language: articleData.original_language,
            publisher: articleData.publisher,
            E_ISSN: articleData.E_ISSN,
            subject_area: articleData.subject_area, 
            author_keywords: articleData.author_keywords, 
            abstract: articleData.abstract,
            url: articleData.url,
            author_id: objectId,
        }));

        await ArticleScopus.insertMany(articles);
        await newAuthor.save();
        console.log('Data saved successfully to MongoDB.');
    } catch (error) {
        console.error('Error saving data to MongoDB:', error);
    }
};

const insertDataToJournal = async (data) => {
    try {
        const objectId = new ObjectId();
        const newJournal = new Journal({
            _id: objectId,
            source_id: data.source_id,
            journal_name: data.journal_name,
            scopus_coverage_years: data.scopus_coverage_years,
            publisher: data.publisher,
            issn: data.issn,
            eissn: data.eissn,
            source_type: data.source_type,
            subject_area: data.subject_area,
            cite_source: data.cite_source,
        });

        await newJournal.save();
        console.log('Data saved successfully to MongoDB.');
    } catch (error) {
        console.error('Error saving data to MongoDB:', error);
    }
};

module.exports = {
    insertDataToDbScholar,
    insertDataToDbScopus,
    insertDataToJournal
};