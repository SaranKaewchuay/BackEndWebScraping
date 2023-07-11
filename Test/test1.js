
const axios = require("axios");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

const {getArticleUrl} = require("./scraper/scopus/function_article");

// const getE_Id = async () => {
//     const url = "https://www.scopus.com/record/display.uri?eid=2-s2.0-85091173951&origin=resultslist&sort=plf-f";
//     const substring = url.substring(url.indexOf('eid=') + 3);

//     const desiredValue = substring.substring(8, substring.indexOf('&'));
//     console.log("desiredValue = ",desiredValue)
//     if(desiredValue){
//         return desiredValue
//     }else{
//         return ""
//     }
//   };
  
//   getE_Id();
  
  

// const checkArticleWU = async (html) => {
//     const html = await page.content();
//     const $ = cheerio.load(html);
//     const searchString = "Walailak";
//     const affiliationText = $("#affiliation-section > div > div > ul").text();
//     console.log("affiliationText: ", affiliationText);
//     const found = affiliationText.includes(searchString);
//     console.log(found ? "true" : "false");
//     return found;
//   };
  

// checkArticleWU();


const checkArticleWU = async () => {


    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.goto( "https://www.scopus.com/record/display.uri?eid=2-s2.0-84866700880&origin=resultslist&sort=plf-f", { waitUntil: "networkidle2" });
       await page.waitForSelector(
            "#affiliation-section"
          );
    const html = await page.content()
    const searchString = "Walailak";
    let $ = cheerio.load(html);
    let affiliationText
  
    if ($('#show-additional-affiliations').length > 0) {
        page.click("#show-additional-affiliations")
        // await page.waitForTimeout(2000)
        page.waitForResponse(response => response.url().includes('affiliation-section') && response.status() === 200)
        $ = cheerio.load(html);
        affiliationText = $("#affiliation-section > div").text();
        console.log("affiliationText add = ",affiliationText)
    } else {
        affiliationText = $("#affiliation-section > div > div > ul").text();
        console.log("affiliationText not = ",affiliationText)
    }
    
    const found = affiliationText.includes(searchString);
    if(found){
      console.log("true")
      return true
    }else{
      console.log("false")
      return false
    }
  }




checkArticleWU()

// const Journal = require("./models/journal");
// const connectToMongoDB = require("./qurey/connectToMongoDB");
// (async () => {
//   await connectToMongoDB();
// })();


// const check_has_source_id = async (source_id) => {
//   try {
//     const journals = await Journal.find({ source_id: source_id });
//     if(journals.length > 0){
//         return true
//     }else{
//         return false
//     }
//   } catch (error) {
//     console.error(error);
//   }
// };


//   check_has_source_id ("21100258402")


// const getOldNumDocInPage = async (scopus_id) => {
//     try {
//       const authors = await AuthorScopus.find({ author_scopus_id: scopus_id });
//       console.log("authorsauthorsauthors = ",authors)
//       if (authors.length > 0) {
//         console.log("Number(authors[0].documents) = ",Number(authors[0].documents))
//         return Number(authors[0].documents); 
//       } else {
//         return 0;
//       }
//     } catch (error) {
//       console.error("An error occurred:", error);
//       return 0;
//     }
//   };


//   getOldNumDocInPage("57216418752")
  