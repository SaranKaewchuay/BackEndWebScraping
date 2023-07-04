const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { insertDataToJournal } = require("../insertToDb/insertToDb");
const journalData = require("../../journal_data/journal_data");

let roundJournal = 205;
let journal = [];

const scrapJournal = async () => {
  try {
    const batchSize = 5;
    for (let i = roundJournal; i < journalData.length; i += batchSize) {
      const batch = journalData.slice(i, i + batchSize);

      const promises = batch.map(async (journalItem, index) => {
        const currentIndex = i + index + 1;
        console.log(currentIndex, "/", journalData.length, "| Source ID:", journalItem);

        try {
          const data = await scraperJournalData(journalItem);
          console.log("Journal =", data);
          await insertDataToJournal(data);
          console.log("Journal Data | Source ID:", journalItem, "saved successfully to MongoDB.");
          return { status: "fulfilled", value: data };
        } catch (error) {
          console.error("An error occurred while scraping the journal item:", error);
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


//scrapJournalDetail()
const scraperJournalData = async (source_id) => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    const link = `https://www.scopus.com/sourceid/${source_id}`;
    await page.goto(link, { waitUntil: "networkidle2" });
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

    journal.cite_source = await processDropdowns(page);

    await browser.close();

    return journal;
  } catch (error) {
    console.error("An error occurred:", error);
    await scrapJournal();
    return null;
  }
};


const processDropdowns = async (page) => {
  const dataCitation = [];
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

    for (let index = 0; index < dropdownOptions.length; index++) {
      const option = dropdownOptions[index];
      // console.log("year:", option);
      await page.click(
        "#year-button > span.ui-selectmenu-icon.ui-icon.btn-primary.btn-icon.ico-navigate-down.flexDisplay.flexAlignCenter.flexJustifyCenter.flexColumn"
      );
      await page.waitForTimeout(1200);
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
};
