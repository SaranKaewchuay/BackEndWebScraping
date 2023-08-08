const Author = require('../../models/Author');
const Article = require('../../models/Article');
const AuthorScopus = require('../../models/AuthorScopus');
const ArticleScopus = require('../../models/ArticleScopus');
const Coressponding = require('../../models/Coressponding');
const Journal = require('../../models/journal.js');

const { ObjectId } = require('mongodb');
process.setMaxListeners(100);


const insertDataToDbScholar = async (data) => {
  try {
    const objectId = new ObjectId();
    const existingAuthor = await Author.findOne({ scholar_id: data.scholar_id });

    if (existingAuthor) {
      existingAuthor.author_name = data.author_name;
      existingAuthor.documents = data.documents;
      existingAuthor.department = data.department;
      existingAuthor.subject_area = data.subject_area;
      existingAuthor.image = data.image;
      existingAuthor.citation_by.table = data.citation_by.table;
      existingAuthor.citation_by.graph = data.citation_by.graph;
      await existingAuthor.save();

      if (data.articles) {
        await Promise.all(
          data.articles.map(async (article) => {
            if (article) {
              // const existingArticle = await Article.findOne({ author_id: existingAuthor._id && article_id: article.article_id  });
              const existingArticle = await Article.findOne({ article_id: article.article_id, scholar_id: existingAuthor.scholar_id });

              if (existingArticle) {
                // Update existing article 
                existingArticle.set({
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
                  author_id: existingAuthor._id,
                });
      
                await existingArticle.save();
              } else {
                // Create a new article
                const newArticle = new Article({
                  article_id: article.article_id,
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
                  scholar_id: article.scholar_id,
                  url: article.url,
                  author_id: existingAuthor._id,
                });
                
                await newArticle.save();
              }
            }
          })
        );
      }
      console.log("Update data of", data.author_name, "successful.");
    } else {
      const newAuthor = new Author({
        _id: objectId,
        scholar_id: data.scholar_id,
        documents: data.documents,
        author_name: data.author_name,
        department: data.department,
        subject_area: data.subject_area,
        image: data.image,
        citation_by: {
          table: data.citation_by.table,
          graph: data.citation_by.graph,
        },
      });
      await newAuthor.save();

      if (data.articles) {
        await Promise.all(
          data.articles.map(async (article) => {
            if (article) {
              const newArticle = new Article({
                article_id: article.article_id,
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
                scholar_id: article.scholar_id,
                url: article.url,
                author_id: objectId,
              });
              await newArticle.save();
            }
          })
        );
      }
      console.log("Insert data of", data.author_name, "successful.");
    }
  } catch (error) {
    console.error("Error inserting/updating data:", error);
    throw error;
  }
};





const insertAuthorDataToDbScopus = async (data) => {
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
        console.log('\nAuthors Data of | ' + data.name + ' saved successfully to MongoDB.\n');

    } catch (error) {
        console.error('Error saving Authors data to MongoDB:', error);
    }
};


const insertArticleDataToDbScopus = async (data,author_name,roundArticleScraping,batchSize) => {
  try {
    let scopus_id 
      const articles = data.map((articleData) => {
        scopus_id = articleData.author_scopus_id
        const article = {
          eid: articleData.eid,
          article_name: articleData.name,
          ...(articleData.hasOwnProperty('source_id') && { source_id: articleData.source_id }),
          first_author: articleData.first_author,
          co_author: articleData.co_author,
          co_author_department : articleData.co_author_department,
          corresponding: articleData.corresponding,
          volume: articleData.volume,
          issue: articleData.issue,
          pages: articleData.pages,
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

      console.log('\nArticles '+ (roundArticleScraping+Number(1)) +' to '+ (roundArticleScraping + batchSize) +' of | ' + author_name + ' saved successfully to MongoDB.');
      console.log("");
  } catch (error) {
      console.error('Error saving Articles data to MongoDB:', error);
  }
};

const insertDataToJournal = async (data,source_id) => {
    try {
        const newJournal = new Journal({
            source_id: data.source_id,
            journal_name: data.journal_name,
            scopus_coverage_years: data.scopus_coverage_years,
            publisher: data.publisher,
            issn: data.issn,
            eissn: data.eissn,
            source_type: data.source_type,
            subject_area: data.subject_area,
            calculated: data.calculated,
            changeJournal: data.changeJournal,
            cite_source: data.cite_source,
        });

        await newJournal.save();
        console.log("Journal Data | Source ID:", source_id, "saved successfully to MongoDB.\n");
    } catch (error) {
        console.error('Error saving data to MongoDB:', error);
    }
};


const insertDataToCoressponding = async (data) => {
  try {
      const newCoressponding = new Coressponding({
          scopusEID: data.scopusEID,
          corresAuthorID: data.corresAuthorID,
          correspondingData: data.correspondingData,
      });

      await newCoressponding.save();
      console.log("Coressponding Data | Source EID:", data.scopusEID, "saved successfully to MongoDB.\n");
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
  // console.log('mynewdata');
  // newData.forEach(item => console.log(item));
  try {
    const oldData = await Journal.findOne({ source_id });

    if (!oldData) {
      console.log("Source ID not found in the database.");
      return;
    }
    oldData.cite_source.push(...newData);
    oldData.cite_source.sort((a, b) => b.year - a.year);
    await oldData.save();

    console.log("Journal Data | Source ID:", source_id, "updeted successfully to MongoDB.\n");
    return oldData;
  } catch (error) {
    console.error("An error occurred:", error);
  }
}

const updateDataToAuthor = async (data) => {
  try {
    await AuthorScopus.updateOne(
      { "author_scopus_id": data.author_scopus_id},
      {
         $set: {
            "author_scopus_id": data.author_scopus_id,
            "author_name": data.name,
            "citations": data.citation,
            "citations_by": data.citations_by,
            "documents":data.documents,
            "h_index": data.h_index,
            "subject_area": data.subject_area,
            "citations_graph": data.citations_graph,
            "documents_graph": data.documents_graph,
            "url": data.url,
         }
      }
   )
   console.log("Author Data of | ",  data.name, " updeted successfully to MongoDB.\n");   
  } catch (error) {
    // console.error("An error occurred:", error);
  }
}

module.exports = {
    insertDataToDbScholar,
    insertAuthorDataToDbScopus,
    insertArticleDataToDbScopus,
    insertDataToJournal,
    updateDataToJournal,
    updateDataToAuthor
};