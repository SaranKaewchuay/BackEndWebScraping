const axios = require("axios");

const recordsPerPage = 100;

const getScopusAuthIDs = async (pageNumber) => {
    const url = `http://202.28.69.137/wurisapi/api/Author/GetResearchers?pageno=${pageNumber}&perpage=${recordsPerPage}`;
  
    try {
      const response = await axios.get(url);
      const data = response.data; 
      const scopusAuthIDs = data.value.records
        .filter((entry) => entry.researcher.scopusAuthID !== "")
        .map((entry) => ({
            name: entry.researcher.auGivenName.replace(/[\r\n]/g, ""),
            scopus_id: entry.researcher.scopusAuthID,
          }))
        
      return scopusAuthIDs;
    } catch (error) {
      console.error(`Error fetching data from page ${pageNumber}:`, error);
      return [];
    }
  };
  
  const getAllScopusAuthIDs = async () => {
    let allAuthIDs = [];
    let pageNumber = 1;
  
    while (true) {
      const scopusAuthIDs = await getScopusAuthIDs(pageNumber);

      if (scopusAuthIDs.length === 0) {
        break; 
      }
      allAuthIDs.push(...scopusAuthIDs);
      pageNumber++;
    }
    return allAuthIDs;
  };



  module.exports = getAllScopusAuthIDs
