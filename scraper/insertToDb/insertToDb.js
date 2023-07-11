const Author = require('../../models/Author');
const Article = require('../../models/Article');
const AuthorScopus = require('../../models/AuthorScopus');
const ArticleScopus = require('../../models/ArticleScopus.js');
const Journal = require('../../models/journal.js');

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

const insertAuthorDataToDbScopus = async (data,author_name) => {
    try {
        const objectId = new ObjectId();

        const newAuthor = new AuthorScopus({
            _id: objectId,
            author_scopus_id: data.author_scopus_id,
            author_name: data.name,
            citations: data.citation,
            citations_by: data.citations_by,
            documents: data.documents,
            h_index: data.h_index,
            subject_area: data.subject_area,
            citations_graph: data.citations_graph,
            documents_graph: data.documents_graph,
            url: data.url,
        });

        await newAuthor.save();
        console.log('\nAuthors Data of '+author_name+' saved successfully to MongoDB.\n');

    } catch (error) {
        console.error('Error saving Authors data to MongoDB:', error);
    }
};


const insertArticleDataToDbScopus = async (data, scopus_id) => {
  try {

      const articles = data.map((articleData) => {
        const article = {
          eid: articleData.eid,
          article_name: articleData.name,
          ...(articleData.hasOwnProperty('source_id') && { source_id: articleData.source_id }),
          co_author: articleData.co_author,
          corresponding: articleData.corresponding,
          document_type: articleData.document_type,
          source_type: articleData.source_type,
          issn: articleData.issn,
          original_language: articleData.original_language,
          publisher: articleData.publisher,
          author_keywords: articleData.author_keywords, 
          abstract: articleData.abstract,
          url: articleData.url,
          author_scopus_id: articleData.author_scopus_id,
        };
      
        return article;
      });
      

      await ArticleScopus.insertMany(articles);

      console.log('\nArticles Data of | Scopus ID: ' + scopus_id + ' saved successfully to MongoDB.\n');
      console.log("");
  } catch (error) {
      console.error('Error saving Articles data to MongoDB:', error);
  }
};

const insertDataToJournal = async (data,source_id) => {
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
        console.log("Journal Data | Source ID:", source_id, "saved successfully to MongoDB.");
    } catch (error) {
        console.error('Error saving data to MongoDB:', error);
    }
};


const updateDataToJournal = async (data, source_id) => {
  const newData = data.map(item => {
    return {
      year: item.year,
      citation: item.citation,
      category: [
        {
          category_name: item.category[0].category_name,
          sub_category: item.category[0].sub_category,
          rank: item.category[0].rank,
          percentile: item.category[0].percentile
        }
      ]
    };
  });
  console.log('mynewdata');
  newData.forEach(item => console.log(item));
  try {
    const oldData = await Journal.findOne({ source_id });

    if (!oldData) {
      console.log("Source ID not found in the database.");
      return;
    }
    oldData.cite_source.push(...newData);
    oldData.cite_source.sort((a, b) => b.year - a.year);
    await oldData.save();

    console.log("Journal Data | Source ID:", source_id, "updeted successfully to MongoDB.");
    return oldData;
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

module.exports = {
    insertDataToDbScholar,
    insertAuthorDataToDbScopus,
    insertArticleDataToDbScopus,
    insertDataToJournal,
    updateDataToJournal 
};