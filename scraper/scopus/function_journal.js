const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { insertDataToJournal } = require("../insertToDb/insertToDb");
const { updateDataToJournal } = require("../insertToDb/insertToDb");
const { getyearJournal, getCountRecordInJournal } = require("../../qurey/qurey_function");
const { getSourceID, getAllSourceIDJournal, getAllSourceIdOfArticle, getCiteSourceYearLastestInDb } = require("../../qurey/qurey_function");

let roundJournal = 0;
let journal = [];
let checkUpdate;
let checkNotUpdate;

const waitForElement = async (selector, maxAttempts = 10, delay = 200) => {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      await page.waitForSelector(selector, { timeout: 100 });
      break; 
    } catch (error) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const scrapJournal = async () => {
  try {
    let hasSource = false;
    const batchSize = 5;
    let journalData;

    if(await getCountRecordInJournal() === 0){
        journalData = await getAllSourceIdOfArticle()
        console.log("journalData = ",journalData)
    }else{
        hasSource = true;
        journalData = await getAllSourceIDJournal();
    }

    for (let i = roundJournal; i < journalData.length; i += batchSize) {
      const batch = journalData.slice(i, i + batchSize);
      roundJournal = i;
      console.log("\nroundScraping =", roundJournal,"\n");
      const promises = batch.map(async (journalItem, index) => {
        checkUpdate = false;
        checkNotUpdate = false;
        let browser; 
      
        try {
          browser = await puppeteer.launch({ headless: "new" });
          const page = await browser.newPage();
          const currentIndex = i + index + 1;
          console.log(currentIndex, "/", journalData.length, "| Source ID:", journalItem);
          const link = `https://www.scopus.com/sourceid/${journalItem}`;
          await page.goto(link, { waitUntil: "networkidle2" });
          // await page.waitForTimeout(1600)
          await waitForElement("#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(2) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc")
          const sourceIDs = await getSourceID(journalItem);
          let yearLastestInDb = 0;
          let yearLastestInWebPage = 0
          let numNewJournal = 0
      
          if (hasSource) {        
            const yearDb = Number(await getCiteSourceYearLastestInDb(journalItem));    
            if(yearDb !== null){
              // await page.waitForSelector("#year-button > span.ui-selectmenu-text")
              await waitForElement("#year-button > span.ui-selectmenu-text")
              yearLastestInWebPage = await scraperCiteScoreYearLastestInWebPage(page);
              yearLastestInDb = yearDb
              numNewJournal = yearLastestInWebPage  - yearLastestInDb
            }
          }
      
          if (!sourceIDs) {
            console.log("\n------------------------------");
            console.log("First Scraping Source ID : ", journalItem);
            console.log("------------------------------");
            console.log("yearLastestInWebPage = ", yearLastestInWebPage);
            console.log("yearLastestInDb = ", yearLastestInDb,"\n");
            const data = await scraperJournalData(journalItem, numNewJournal);
            return { status: "fulfilled", value: data, source_id: journalItem };
          } else if (yearLastestInWebPage > yearLastestInDb) {
            checkUpdate = true;
            console.log("\n------------------------------");
            console.log("Update Journal Data Source ID : ", journalItem);
            console.log("-------------------------------");
            console.log("yearLastestInWebPage = ", yearLastestInWebPage);
            console.log("yearLastestInDb = ", yearLastestInDb,"\n");
            const new_cite_source_year = await processDropdowns(page, numNewJournal);
            return { status: "fulfilled", value: new_cite_source_year, source_id: journalItem, checkUpdate: checkUpdate };
          } else {
            checkNotUpdate = true;
            console.log("\n------------------------------");
            console.log("skip source_id", journalItem);
            console.log("------------------------------");
            console.log("yearLastestInWebPage = ", yearLastestInWebPage);
            console.log("yearLastestInDb = ", yearLastestInDb,"\n");
            return { status: "fulfilled", value: [], checkNotUpdate: checkNotUpdate };
          }
        } catch (error) {
          return { status: "rejected" };
        } finally {
          if (browser) {
            await browser.close();
          }
        }
      });
      
      const batchResults = await Promise.allSettled(promises);
      const mappedResults = batchResults.map((result) => result.value.value !== null && result.value.status !== 'rejected');
      console.log("mappedResults = ", mappedResults);
      const hasFalse = mappedResults.includes(false);
      const finalResult = !hasFalse;
      if (finalResult) {
        if (batchResults.length === batchSize || batchResults.length === batch.length) {
          for (const result of batchResults) {
            if (result.status === "fulfilled") {
              const data = result.value;
              if (data.value.length !== 0 || data.checkUpdate) {
                if (checkUpdate == false && checkNotUpdate == false ){
                  await insertDataToJournal(data.value, data.source_id);
                  journal.push(data.value)
                } else if (data.checkUpdate) {
                  await updateDataToJournal(data.value, data.source_id);
                }
              } else if (data.checkNotUpdate) {
                continue;
              } else {
                console.log("------ Array 0 --------");
              }
            } else if (result.status === "rejected") {
              console.error("\nError occurred while scraping\n");
              await scrapJournal();
            }
          }
          
        } else {
          console.log("!== batchsize");
          await scrapJournal();
        }
      } else {
        console.log("have author null")
        await scrapJournal();
      }

      roundJournal += batchSize; 
    }
    console.log("Finish Scraping Scopus");
    return journal;
  } catch (error) {
    console.error("\nError occurred while scraping\n");
    await scrapJournal()
    return [];
  }
};

const scraperCiteScoreYearLastestInWebPage = async (page) => {
  try {
    const html = await page.content();
    const $ = cheerio.load(html);
    const yeareLastest = $("#year-button > span.ui-selectmenu-text").text();
    return Number(yeareLastest);
  } catch (error) {
    // Handle the error here or rethrow it if needed
    console.error("Error occurred in scraperCiteScoreYearLastestInWebPage:", error);
    throw error; // Rethrow the error to be handled by the calling code
  }
};



const scrapOneJournal = async (source_id) => {
  try {
    const batchSize = 5;
    let roundJournal = 0;

    const journal_data = [];
    const journal_All = source_id.split(",").map(e => e.trim());

    let sizeLoop =
      journal_All.length < batchSize && journal_All.length > 0
        ? journal_All.length
        : batchSize;

    for (let i = roundJournal; i < journal_All.length; i += sizeLoop) {
      const batch = journal_All.slice(i, i + batchSize);

      const promises = batch.map(async (journalItem, index) => {
        const currentIndex = i + index + 1;
        console.log(
          currentIndex,
          "/",
          journal_All.length,
          "| Source ID:",
          journalItem
        );

        try {
          const data = await scraperJournalData(journalItem, 0);
          console.log("Finish Scraping Journal ID: ", journalItem);
          return { status: "fulfilled", value: data };
        } catch (error) {
          console.error("\nError occurred while scraping\n");
          return { status: "rejected"}
        }
      });



      const results = await Promise.allSettled(promises);
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value !== null) {
          journal_data.push(result.value.value);
        }
      });
      roundJournal += batchSize;

    }
    console.log("journal_data =", journal_data);
    return journal_data;
  } catch (error) {
    console.error("\nError occurred while scraping\n");
    return [];
  }
};


//scrapJournalDetail()
const scraperJournalData = async (source_id, numNewJournal) => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    const link = `https://www.scopus.com/sourceid/${source_id}`;
    await page.goto(link, { waitUntil: "networkidle2" });
    await page.waitForSelector(
      "#jourlSection > div.col-md-9.col-xs-9.noPadding > div"
    );
    const html = await page.content();
    const $ = cheerio.load(html);

    const journal = {
      source_id,
      journal_name: $(
        "#jourlSection > div.col-md-9.col-xs-9.noPadding > div > h2"
      )
        .text()
        .trim(),
    };

    const fieldPromises = [];

    $("#jourlSection > div.col-md-9.col-xs-9.noPadding > div > ul > li").each(
      (index, element) => {
        const fieldText = $(element)
          .find("span.left")
          .text()
          .trim()
          .toLowerCase()
          .replace(":", "")
          .replace(/ /g, "_")
          .replace("-", "");
        const fieldValue = $(element).find("span.right").text().trim();
        if (fieldText === "issneissn:") {
          journal.issn = $(element)
            .find("#issn > span:nth-child(2)")
            .text()
            .trim();
          journal.eissn = $(element)
            .find("span.marginLeft1.right")
            .text()
            .trim();
        } else if (fieldText === "subject_area") {
          fieldPromises.push(
            scrapSubjectAreaJournal(html).then((subjectArea) => {
              journal[fieldText] = subjectArea;
            })
          );
        } else {
          journal[fieldText] = fieldValue;
        }
      }
    );

    await Promise.all(fieldPromises);

    journal.cite_source = await processDropdowns(page, numNewJournal);

    await browser.close();

    return journal;
  } catch (error) {
    console.error("\nError occurred while scraping\n");
    return null;
  }
};

const dropDownOption = async (page) => {
  const dropdownSelector = 'select[name="year"]';
  if (await page.$(dropdownSelector)) {
    await page.waitForSelector(dropdownSelector);

    // getDropdownOptions()
    const dropdownOptions = await page.evaluate((selector) => {
      const dropdown = document.querySelector(selector);
      const options = Array.from(dropdown.options).map(
        (option) => option.textContent
      );
      return options;
    }, dropdownSelector);
    return dropdownOptions;
  }
};

const processDropdowns = async (page, numNewJournal) => {
  const dataCitation = [];
  const dropDownOptions = await dropDownOption(page);
  let loopDropDown;
  if (dropDownOptions) {
    if (numNewJournal == 0) {
      loopDropDown = dropDownOptions.length;
    } else {
      loopDropDown = numNewJournal;
    }
    for (let index = 0; index < loopDropDown; index++) {
      const option = dropDownOptions[index];
      await page.click(
        "#year-button > span.ui-selectmenu-icon.ui-icon.btn-primary.btn-icon.ico-navigate-down.flexDisplay.flexAlignCenter.flexJustifyCenter.flexColumn"
      );
      await page.waitForTimeout(1700);
      await page.click(`#ui-id-${index + 1}`);
      await page.waitForTimeout(2000);
      const html = await page.content();
      const $ = cheerio.load(html);
      const year = $("#year-button > span.ui-selectmenu-text").text();
      const citation = $("#rpResult").text();
      const category = await scrapCategoryJournal(html);
      const data = { year, citation, category };
      dataCitation.push(data);
    }
  } else if (await page.$("#rpResult")) {
    const html = await page.content();
    const $ = cheerio.load(html);
    const year =
      $("#csCalculation > div:nth-child(2) > div:nth-child(1) > h3")
        .text()
        .match(/\d{4}/)?.[0] || null;
    const citation = $("#rpResult").text();
    const category = await scrapCategoryJournal(html);
    const data = { year, citation, category };
    dataCitation.push(data);
  }
  return dataCitation.length > 0 ? dataCitation : null;
};

const scrapSubjectAreaJournal = async (html) => {
  try {
    const $ = cheerio.load(html);
    const subjectAreaJournal = $("#csSubjContainer > span")
      .map((index, element) => $(element).text().trim())
      .get();
    return subjectAreaJournal;
  } catch (error) {
    console.error("\nError occurred while scraping\n");
    return null;
  }
};

const scrapCategoryJournal = async (html) => {
  try {
    const $ = cheerio.load(html);
    const subjectAreaArticle = $("#CSCategoryTBody > tr")
      .map((index, element) => ({
        category_name: $(element).find("td > div:nth-child(1)").text().trim(),
        sub_category: $(element)
          .find("tr > td:nth-child(1) > div.treeLineContainer")
          .text()
          .trim(),
        rank: $(element).find("tr > td:nth-child(2)").text().trim(),
        percentile: $(element)
          .find(
            "tr > td:nth-child(3) > div:nth-child(2) > div.pull-left.paddingLeftQuarter"
          )
          .text()
          .trim(),
      }))
      .get();
    return subjectAreaArticle;
  } catch (error) {
    console.error("\nError occurred while scraping\n");
    return null;
  }
};

module.exports = {
  scrapJournal,
  scraperJournalData,
  scrapOneJournal,
};
