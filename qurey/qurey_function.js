const AuthorScopus = require("../models/AuthorScopus");
const ArticleScopus = require("../models/ArticleScopus");
const Author = require("../models/Author");
const Article = require("../models/Article");
const Journal = require("../models/journal");
const Coressponding = require("../models/Corresponding");
const connectToMongoDB = require("./connectToMongoDB");
const { MongoClient } = require("mongodb");
(async () => {

  await connectToMongoDB();

})();

let oldAuthorData = []

const getOldNumArticleInWU = async (author_scopus_id) => {
  try {
    const result = await AuthorScopus.findOne({ author_scopus_id: author_scopus_id });

    let wuDocuments = 0;
    if (result) {
      wuDocuments = result.wu_documents;
    }
    return wuDocuments;
  } catch (err) {
    return 0; 
  }
};



const getOldAuthorData = async () => {
  try {
    oldAuthorData = []
    const authors = await AuthorScopus.find();
    oldAuthorData.push(authors);
    // console.log("oldAuthorData = ",oldAuthorData)
  } catch (error) {

  }
};

const getOldNumDocInPage = async (scopus_id) => {
  try {
    const author = oldAuthorData[0].find(item => item.author_scopus_id === scopus_id);
    if (author) {
      return Number(author.documents);
    } else {
      return 0;
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return 0;
  }
};

const addCountDocumenInWu = async(scopus_id, documentsInWu ,author_name) => {
  try {
    const filter = { author_scopus_id : scopus_id };
    const updateOperation = { $set: { wu_documents: documentsInWu } };
    const result = await AuthorScopus.updateOne(filter, updateOperation);

    if (result.modifiedCount > 0) {
      console.log('\nAdded Count Document In Wu Of ',author_name ,' successfully.\n');
    } else {
      console.log('Document not found or no changes made.');
    }
  } catch (error) {
    console.error('Error occurred:', error);
  } 
}

const addFieldPageArticle = async (eid, scopus_id, pages) => {
  try {
    const filter = { eid: eid, author_scopus_id: scopus_id };
    const updateOperation = { $set: { pages: pages } };
    const result = await ArticleScopus.updateOne(filter, updateOperation);
    if (result.modifiedCount > 0) {
      console.log('\nAdded article pages of EID | ', eid, ' successfully.\n');
    } else {
      console.log('Document not found or no changes were made.');
    }
  } catch (error) {
    console.error('An error occurred:', error.message);
  }
};


const hasScopusIdInAuthor = async (scopus_id) => {
  try {
    const results = await AuthorScopus.find({ author_scopus_id: scopus_id });
    return results.length > 0;
  } catch (error) {
    console.error('Error while querying the database:', error);
    return false; 
  }
};


const getCountAuthorScholar = async () => {
  try {
    const num = await Author.countDocuments();
    if(typeof num  === 'undefined'){
        return 0
    }else{
        return num;
    }
   
  } catch (error) {
    return 0    
  }
};

const getCountArticleScholar = async () => {
  try {
    const num = await Article.countDocuments();
    if(typeof num  === 'undefined'){
        return 0
    }else{
        return num;
    }
   
  } catch (error) {
    return 0    
  }
};


const checkHasSourceId = async (source_id) => {
  try {
    const journals = await Journal.find({ source_id: source_id });
    if(journals.length > 0){
        return true
    }else{
        return false
    }
  } catch (error) {
    console.error(error);
    return false
  }
};

const updateNewDoc = async (scopus_id, numDocInPage) => {
  try {
    await AuthorScopus.updateOne(
      { author_scopus_id: scopus_id },
      {
        $set: {
          documents: numDocInPage,
        }
      }
    );
  } catch (error) {
    console.error('Error updating document:', error);
  }
};


const getNumArticleOfAuthorInDB = async (scopus_id) => {
  try {
    const articles = await ArticleScopus.find({ author_scopus_id: scopus_id });
    if (articles.length > 0) {
      return articles.length;
    } else {
      return 0;
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return 0;
  }
};

const getyearJournal = async (sourceId) => {
  try {
    const journal = await Journal.findOne({ source_id: sourceId });
    if (journal && journal.cite_source) {
      const years = journal.cite_source;
      return years.length;
    } else {
      return 0;
    }
    
  } catch (error) {
    return 0;
  }
};

const hasSourceEID = async (eid) => {
  try {
    const count = await Coressponding.countDocuments({ scopusEID: eid });
    if (count > 0) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(
      "An error occurred while getting source ID from the database:",
      error
    );
    return false;
  }
};

const hasSourceID = async (sourceId) => {
  try {
    const journal = await Journal.findOne({ source_id: sourceId });
    if (journal) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error(
      "An error occurred while getting source ID from the database:",
      error
    );
    return false;
  }
};

const getCountRecordInJournal = async () => {
  try {
    const journal = await Journal.countDocuments();
    return journal;
  } catch (error) {

    throw error;
  }
};

const getCountRecordInArticle = async () => {
  try {
    const article = await ArticleScopus.countDocuments();
    return article ;
  } catch (error) {

    throw error;
  }
};

const getCountRecordInAuthor = async () => {
  try {
    const num = await AuthorScopus.countDocuments();
    if(typeof num  === 'undefined'){
        return 0
    }else{
        return num;
    }   
  } catch (error) {
    return 0    
  }
};

const getAllSourceIdOfArticle = async () => {
  try {
    const pipeline = [
      { $match: { source_id: { $ne: null } } }, 
      { $group: { _id: "$source_id", source_id: { $first: "$source_id" } } },
      { $project: { _id: 0, source_id: 1 } },
    ];

    const result = await ArticleScopus.aggregate(pipeline);
    const uniqueSourceIds = result.map((item) => item.source_id);
    return uniqueSourceIds;
  } catch (err) {
    console.error("Error occurred while fetching source IDs:", err);
  }
};


const getAllSourceIDJournal = async () => {
  try {
    const journal = await Journal.find({}, 'source_id');
    const sourceIds = journal.map(entry => entry.source_id);
    if(sourceIds){
      return sourceIds
    }else{
      return []
    }
    
  } catch (error) {
    console.error(
      "An error occurred while getting source ID from the database:",
      error
    );
    return false;
  }
};

const getCiteSourceYearLastestInDb = async (sourceId) => {
  try {
    const document = await Journal.findOne({ source_id: sourceId });

    if (document && document.cite_source && document.cite_source.length > 0) {
      const firstCiteSourceYear = document.cite_source[0].cite.year;
      return firstCiteSourceYear
    } else {
      return null
    }
  } catch (error) {
    console.error('Error:', error);
    return null
  }
}

const getArticleOfAuthorNotPage = async (scopus_id) => {
  try {
    const documents = await ArticleScopus.find(
      { pages: { $exists: false }, author_scopus_id: scopus_id },
      { url: 1, _id: 0 }
    );
    const urls = documents.map((item) => item.url);
    return urls
  } catch (error) {
    console.error('Error:', error);
    return null
  }
}

module.exports = {
  getArticleOfAuthorNotPage,
  getNumArticleOfAuthorInDB,
  getOldNumDocInPage,
  getyearJournal,
  hasSourceID,
  checkHasSourceId,
  updateNewDoc,
  getAllSourceIDJournal,
  getCountRecordInJournal,
  getCountRecordInAuthor,
  getOldAuthorData,
  getCountRecordInArticle,
  getAllSourceIdOfArticle,
  getCiteSourceYearLastestInDb,
  getCountAuthorScholar,
  getCountArticleScholar,
  addCountDocumenInWu,
  hasScopusIdInAuthor,
  getOldNumArticleInWU,
  addFieldPageArticle,
  hasSourceEID
};
