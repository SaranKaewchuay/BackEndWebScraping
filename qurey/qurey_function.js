const AuthorScopus = require("../models/AuthorScopus");
const ArticleScopus = require("../models/ArticleScopus");
const Journal = require("../models/journal");
const connectToMongoDB = require("./connectToMongoDB");
(async () => {

  await connectToMongoDB();

})();

let oldAuthorData = []

const getOldAuthorData = async () => {
  try {
    const authors = await AuthorScopus.find();
    oldAuthorData.push(authors);
  } catch (error) {
    // Handle the error here
    // console.error('Error occurred while fetching old author data:', error);
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

// const getOldNumDocInPage = async (scopus_id) => {
//   try {
//     const authors = await AuthorScopus.find({ author_scopus_id: scopus_id });
//     if (authors.length > 0) {
//       return Number(authors[0].documents);
//     } else {
//       return 0;
//     }
//   } catch (error) {
//     console.error("An error occurred:", error);
//     return 0;
//   }
// };


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
    console.log('Num Document updated successfully!');
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
  getOldAuthorData
};
