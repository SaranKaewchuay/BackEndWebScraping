const axios = require("axios");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { insertAuthorDataToDbScopus  } = require("../insertToDb/insertToDb");

const batchSize = 5; 
let roundScraping = 0;
let allAuthors = [];

const scraperAuthorScopus = async () => {
  try {
    const allURLs = await getURLScopus();

    for (let i = roundScraping; i < allURLs.length; i += batchSize) {
      const batchURLs = allURLs.slice(i, i + batchSize);

      roundScraping = i
      console.log(" roundScraping = ", roundScraping)
      const promises = batchURLs.map(async (url, index) => {
        const i = roundScraping + index;
        console.log(`Scraping Author ${i + 1} of ${allURLs.length}: ${url.name}`);
        console.log(`URL: ${url.url}`);
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        try {
          const author = await scrapeAuthorData(url.url, page);
          allAuthors.push(author);
          return { status: "fulfilled",author: author};
        } catch (error) {
          console.error("Error occurred while scraping:", error);
          return { status: "rejected", reason: error };
        } finally {
          await browser.close();
        }
      });

      const results = await Promise.allSettled(promises);
      console.log("Num Scraping Finish = ",results.length)  // เช็คสุดท้าย   results.length === batchSize
      if(results.length === batchSize || results.length === batchURLs.length  ){  
        for (const result of results) {
          if (result.status === "fulfilled") {
            const data = result.value.author;
            await insertAuthorDataToDbScopus(data, data.name);
          }
          else if (result.status === "rejected") {
            console.error("Error occurred while scraping:", result.reason);
          }
        }
          roundScraping += batchSize;
      }else{
        await scraperAuthorScopus();     
      }
    }

    console.log("Finish Scraping Scopus");
    return allAuthors;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraperAuthorScopus();
    return [];
  }
};


const scraperOneAuthorScopus = async (scopus_id) => {
  try {
    const allURLs = scopus_id.split(",").map(e => e.trim());
    console.log("allURLs =", allURLs);

    const scrapePromises = allURLs.map(async (id) => {
      const url = `https://www.scopus.com/authid/detail.uri?authorId=${id}`;
      console.log(`Scopus ID: ${id}`);
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();
      try {
        const author = await scrapeAuthorData(url, page);
        console.log("Finish Scraping Author Scopus ID : ",id);
        return author;
      } catch (error) {
        console.error("Error occurred while scraping:", error);
        return null;
      } finally {
        await browser.close();
      }
    });

    const author_data = await Promise.all(scrapePromises);
    const filtered_data = author_data.filter((author) => author !== null);

    console.log("Finish Scraping Author Scopus");
    return filtered_data;
  } catch (error) {
    console.error("An error occurred:", error);
    return [];
  }
};



const scrapeAuthorData = async (url, page) => {
  try {
    await page.goto(url, { waitUntil: "networkidle2" });
    const html = await page.content();
    const $ = cheerio.load(html);
    const author = {
      author_scopus_id: await getScopusID(url),
      name: $(
        "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > div > h1 > strong"
      ).text(),
      citation: $(
        "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(1) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc"
      ).text(),
      citations_by: $(
        "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(1) > div > div > div:nth-child(2) > span > p > span > em > strong"
      ).text(),
      documents: $(
        "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(2) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc"
      ).text(),
      h_index: $(
        "#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(3) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc"
      ).text(),
      subject_area: await scrapSubjectArea(page),
      citations_graph: await scrapCitation(url, page),
      documents_graph: await scrapDocument(url, page),
      url: url,
    };

    return author;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraperAuthorScopus();
    return null;
  }
};

const getURL = async () => {
  try {
    const response = await axios.get(
      "https://iriedoc.wu.ac.th/data/apiwris/RPS_PERSON.php"
    );
    return response.data;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraperAuthorScopus();
    return null;
  }
};

const getURLScopus = async () => {
  try {
    const data = await getURL();

    const scopusArray = data
      .map((element) => ({
        name: element.TITLEENG + element.FNAMEENG + " " + element.LNAMEENG,
        url: element.SCOPUSURL,
      }))
      .filter((data) => data.url !== "1" && data.url !== "0");

    return scopusArray;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraperAuthorScopus();
    return null;
  }
};

const scrapCitation = async (url, page) => {
  try {
    const scopusID = await getScopusID(url);
    const url_citaion = `https://www.scopus.com/hirsch/author.uri?accessor=authorProfile&auidList=${scopusID}&origin=AuthorProfile`;
    await page.goto(url_citaion, { waitUntil: "networkidle2" });
    await page.click("#analyzeCitations-miniGraph > button");
    const html = await page.content();
    const $ = cheerio.load(html);
    const content = $("#analyzeCitations-table > tbody > tr");
    const citations = [];
    content.each(function () {
      const year = $(this).find("td:nth-child(1)").text();
      const cite = $(this).find("td.alignRight > a > span").text();
      if (cite) {
        const citation = {
          year: year,
          citations: cite,
        };
        citations.push(citation);
      }
    });

    return citations;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraperAuthorScopus();
    return null;
  }
};

const scrapDocument = async (url, page) => {
  try {
    const scopusID = await getScopusID(url);
    const url_citaion = `https://www.scopus.com/hirsch/author.uri?accessor=authorProfile&auidList=${scopusID}&origin=AuthorProfile`;
    await page.goto(url_citaion, { waitUntil: "networkidle2" });
    await page.click("#analyzeYear-miniChart > header > h2 > button");
    const html = await page.content();
    const $ = cheerio.load(html);
    const content = $("#analyzeYear-table > tbody > tr");
    const documents = [];
    content.each(function () {
      const year = $(this).find("td:nth-child(1)").text();
      const document = $(this).find("td.alignRight > a > span").text();
      if (document) {
        const citations = {
          year: year,
          documents: document,
        };
        documents.push(citations);
      }
    });

    return documents;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraperAuthorScopus();
    return null;
  }
};

const getScopusID = async (url) => {
  try {
    const match = url.match(/authorId=\d+/)[0];
    const scopusID = match.match(/=(\d+)/)[1];
    return scopusID;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraperAuthorScopus();
    return null;
  }
};

const scrapSubjectArea = async (page) => {
  try {
    await page.click("#AuthorHeader__showAllAuthorInfo");
    const html = await page.content();
    const $ = cheerio.load(html);
    const clickViewMore = $(
      "div > div > div > div > div > div > div:nth-child(4) > div > span"
    ).text();
    const bulletChar = "•";
    const bulletCount = (clickViewMore.match(new RegExp(bulletChar, "g")) || [])
      .length;
    const subjectArea = [];

    for (let i = 0; i < bulletCount + 1; i++) {
      const sub = clickViewMore.split(bulletChar)[i].trim();
      subjectArea[i] = sub;
    }
    return subjectArea;
  } catch (error) {
    console.error("An error occurred:", error);
    await scraperAuthorScopus();
    return null;
  }
};

module.exports = {
  scraperAuthorScopus,
  getScopusID,
  getURLScopus,
  scraperOneAuthorScopus
};
