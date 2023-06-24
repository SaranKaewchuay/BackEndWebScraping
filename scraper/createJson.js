const fs = require("fs");

const createJson = async (author) => {
    const filePath = "../JsonFile/Scopus_Author.json";
  
    try {
      const fileExists = fs.existsSync(filePath);
  
      if (fileExists) {
        const rawData = fs.readFileSync(filePath);
        const data = JSON.parse(rawData);
        data.push(author);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      } else {
        fs.writeFileSync(
          filePath,
          JSON.stringify([author], null, 2)
        );
      }
      console.log("");
      console.log("Author data has been saved.");
      console.log("");
    } catch (error) {
      console.error("Error occurred while saving JSON data:", error);
    }
  };
  

const createJournal = async (journalData) => {
    const filePath = "../JsonFile/Scopus_Journal.json";
  
    try {
      const fileExists = fs.existsSync(filePath);
  
      if (fileExists) {
        const rawData = fs.readFileSync(filePath);
        const data = JSON.parse(rawData);
        data.push(journalData);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      } else {
        fs.writeFileSync(
          filePath,
          JSON.stringify([journalData], null, 2)
        );
      }
      console.log("");
      console.log("Journal data has been saved.");
      console.log("");
    } catch (error) {
      console.error("Error occurred while saving journal data:", error);
    }
  };
  




module.exports = {
    createJson,
    createJournal 
  };
  
