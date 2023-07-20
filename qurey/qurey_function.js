const AuthorScopus = require("../models/AuthorScopus");
const ArticleScopus = require("../models/ArticleScopus");

const Author = require("../models/Author");
const Article = require("../models/Article");
const Journal = require("../models/journal");
const connectToMongoDB = require("./connectToMongoDB");
const { MongoClient } = require("mongodb");
(async () => {

  await connectToMongoDB();

})();

let oldAuthorData = []

const getOldAuthorData = async () => {
  try {
    const authors = await AuthorScopus.find();
    oldAuthorData.push(authors);
  } catch (error) {

  }
};

const addCountDocumenInWu = async(scopus_id, documentsInWu) => {
  try {
    console.log("documentsInWu = ",documentsInWu)
    console.log("scopus_id= ",scopus_id)
    const filter = { author_scopus_id : scopus_id };

    const updateOperation = { $set: { wu_documents: documentsInWu } };

    const result = await AuthorScopus.updateOne(filter, updateOperation);

    if (result.modifiedCount > 0) {
      console.log('Added Count Documen In Wu | Scopus ID : ',scopus_id ,' successfully.');
    } else {
      console.log('Document not found or no changes made.');
    }
  } catch (error) {
    console.error('Error occurred:', error);
  } 
}



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
    // console.log('Num Document updated successfully!');
  } catch (error) {
    console.error('Error updating document:', error);
  }
};


const getNumArticleInDB = async (scopus_id) => {
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
    // console.error(
    //   "An error occurred while getting year journal from the database:",
    //   error
    // );
    return 0;
  }
};

const getSourceID = async (sourceId) => {
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
      const firstCiteSourceYear = document.cite_source[0].year;
      return firstCiteSourceYear
    } else {
      return null
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

module.exports = {
  getNumArticleInDB,
  getOldNumDocInPage,
  getyearJournal,
  getSourceID,
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
  addCountDocumenInWu
};
