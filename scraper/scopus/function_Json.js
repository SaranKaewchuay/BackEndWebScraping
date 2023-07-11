const fs = require('fs');

const filePath = '../../../numDoc/numDocInWalailak.json';
  
const createJson = async (data) => {
    try {
      let existingData = [];
  
      try {
        const existingJson = await fs.promises.readFile(filePath, "utf8");
        existingData = JSON.parse(existingJson);
      } catch (err) {
      }
  
      const updatedData = [...existingData, data];
      const jsonData = JSON.stringify(updatedData, null, 2); 
  
      await fs.promises.writeFile(filePath, jsonData, "utf8");
      console.log("JSON file has been successfully created or updated.");
    } catch (err) {
      console.error("An error occurred while writing the file:", err);
    }
  };


  const createJsonScourceID = async (data) => {
    try {
      let existingData = [];
      const filePath = '../../../numDoc/source_id.json';
      try {
        const existingJson = await fs.promises.readFile(filePath, "utf8");
        existingData = JSON.parse(existingJson);
      } catch (err) {
      }
  
      const updatedData = [...existingData, data];
      const jsonData = JSON.stringify(updatedData, null, 2); 
  
      await fs.promises.writeFile(filePath, jsonData, "utf8");
      // console.log("JSON source id file has been successfully created or updated.");
    } catch (err) {
      console.error("An error occurred while writing the file:", err);
    }
  };

  const updateJson = async (newNotWu, scopus_id) => {
    try {
      const data = await fs.promises.readFile(filePath, "utf8");
      const numDocNotWalailak = JSON.parse(data);
      const oldArticle = numDocNotWalailak.find(
        (article) => article.scopus_id === scopus_id
      );
  
      if (oldArticle) {
        oldArticle.numDocNotWalailak += newNotWu;
  
        await fs.promises.writeFile(
          filePath,
          JSON.stringify(numDocNotWalailak, null, 2), 
          "utf8"
        );
  
        console.log("JSON data has been successfully updated.");
      } else {
        console.error(`Article with scopus_id ${scopus_id} not found.`);
      }
    } catch (err) {
      console.error("An error occurred while reading/writing the file:", err);
    }
  };
  

  const getNumNotWu = async (scopus_id) => {
    try {
      const data = await fs.promises.readFile(filePath, "utf8");
      const numDocNotWalailak = JSON.parse(data);
      const author = numDocNotWalailak.find(
        (author) => author.scopus_id === scopus_id
      );
      if (author) {
        return author.numDocNotWalailak;
      } else {
        return 0;
      }
    } catch (err) {
      return 0;
    }
  };
  
  

module.exports = {
    createJson,
    updateJson,
    getNumNotWu ,
    createJsonScourceID
  };
  