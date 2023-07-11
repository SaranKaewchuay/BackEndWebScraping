const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { insertDataToJournal } = require("../insertToDb/insertToDb");
const { updateDataToJournal } = require("../insertToDb/insertToDb");
const { getyearJournal } = require("../../qurey/qurey_function");
const { getSourceID, getAllSourceIDJournal } = require("../../qurey/qurey_function");

let roundJournal = 0;
let journal = [];

const scrapJournal = async () => {
  try {
    const batchSize = 5;
    const journalData = await getAllSourceIDJournal()
    if(journalData.length === 0){
      console.log("Journal Is Empty")
    }
  
    for (let i = roundJournal; i < journalData.length; i += batchSize) {
      const batch = journalData.slice(i, i + batchSize);
      const promises = batch.map(async (journalItem, index) => {

        try {
          const browser = await puppeteer.launch({ headless: "new" });
          const page = await browser.newPage();
          const currentIndex = i + index + 1;
          console.log(currentIndex,"/",journalData.length,"| Source ID:",journalItem);
          const link = `https://www.scopus.com/sourceid/${journalItem}`;
          await page.goto(link, { waitUntil: "networkidle2" });
  
          const sourceIDs = await getSourceID(journalItem);
          const yearJournal = await getyearJournal(journalItem);
          const dropdownOptions = await dropDownOption(page);
          console.log("\nSourceID == ",journalItem)
          console.log("dropdownOptions == ",dropdownOptions.length)
          console.log("yearJournal == ",yearJournal,"\n")
          if (sourceIDs == false) {
            console.log("Scrap All Journal Data");
            const data = await scraperJournalData(journalItem, yearJournal);
            console.log("Journal =", data);
            await insertDataToJournal(data, journalItem);
            return { status: "fulfilled", value: data };
          } else if (dropdownOptions.length > yearJournal) {
            console.log("dropdownOptions = ",dropdownOptions.length)
            console.log("yearJournal = ",yearJournal)
            console.log("Update Journal Data Source ID : ",journalItem);
            const new_cite_source_year = await processDropdowns(page,yearJournal);
            await updateDataToJournal(new_cite_source_year, journalItem);
            return { status: "fulfilled", value: new_cite_source_year };
          } else {
            console.log("------------------------------");
            console.log("skip source_id", journalItem);
            console.log("------------------------------");
          }
        } catch (error) {
          return { status: "rejected", reason: error };
        }
      });

      const batchResults = await Promise.allSettled(promises);
      const fulfilledResults = batchResults.filter(
        (result) => result.status === "fulfilled"
      );
      roundJournal += batchSize;
      const batchData = fulfilledResults.map((result) => result.value);
      journal.push(...batchData);
    }

    return journal;
  } catch (error) {
    console.error("An error occurred while scraping the journal:", error);
    return [];
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
          console.error(
            "An error occurred while scraping the journal item:",
            error
          );
          return { status: "rejected", reason: error };
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
    console.error("An error occurred while scraping the journal:", error);
    return [];
  }
};


//scrapJournalDetail()
const scraperJournalData = async (source_id, yearJournal) => {
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

    journal.cite_source = await processDropdowns(page, yearJournal);

    await browser.close();

    return journal;
  } catch (error) {
    console.error("An error occurred:", error);
    await scrapJournal();
    return null;
  }
};

const dropDownOption = async (page) => {
  const dropdownSelector = 'select[name="year"]';
  await page.waitForTimeout(1200)
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

const processDropdowns = async (page, yearJournal) => {
  const dataCitation = [];
  const dropDownOptions = await dropDownOption(page);
  let loopDropDown;
  if (dropDownOptions) {
    if (yearJournal == 0) {
      loopDropDown = dropDownOptions.length;
    } else {
      loopDropDown = dropDownOptions.length - yearJournal;
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
    console.error("An error occurred:", error);
    await scrapJournal();
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
    console.error("An error occurred:", error);
    await scrapJournal();
    return null;
  }
};

module.exports = {
  scrapJournal,
  scraperJournalData,
  scrapOneJournal,
};
