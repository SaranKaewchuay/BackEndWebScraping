const connectToMongoDB = require("../qurey/connectToMongoDB");
const Coressponding = require("../models/Coressponding");

(async () => {
  await connectToMongoDB();
})();


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
  
const insertDataToCoressponding = async (data) => {
    try {
        const newCoressponding = new Coressponding({
            scopusEID: data.scopusEID,
            corresAuthorID: data.corresAuthorID,
            correspondingData: data.correspondingData,
        });
  
        await newCoressponding.save();
        console.log("Coressponding Data | Scopus EID:", data.scopusEID, "saved successfully to MongoDB.\n");
    } catch (error) {
        console.error('Error saving data to MongoDB:', error);
    }
  };

  (async () => {
    const data = {
        scopusEID : "85482522",
        corresAuthorID: "11111111",
        correspondingData: [
            {
              "corresName": "Srisuphanunt, M.",
              "address": "Department of Medical Technology, School of Allied Health Sciences, Walailak University, Nakhon Si Thammarat, Thailand",
              "email": "mayuna.sr@mail.wu.ac.th"
            },
            {
              "corresName": "Puttaruk, P.",
              "address": "Department of Medical Technology Laboratory, Thammasat University Hospital, Thammasat University, Rangsit Centre, Pathum Thani, Thailand",
              "email": "palakorn@tu.ac.th"
            },
            {
              "corresName": "Wilairatana, P.",
              "address": "Department of Clinical Tropical Medicine, Faculty of Tropical Medicine, Mahidol University, Bangkok, Thailand",
              "email": "polrat.wil@mahidol.ac.th"
            }
          ]
    }

    if(!(await hasSourceEID(data.scopusEID))){
        await insertDataToCoressponding(data);
    }else{
        console.log("\nScopus EID | ", data.scopusEID," Is Duplicate\n")
    }    
  })();
  