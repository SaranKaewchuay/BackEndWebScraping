const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { insertDataToJournal } = require("../insertToDb/insertToDb");
const { updateDataToJournal } = require("../insertToDb/insertToDb");
const {
  getCountRecordInJournal,
} = require("../../qurey/qurey_function");
const {
  hasSourceID,
  getAllSourceIDJournal,
  getAllSourceIdOfArticle,
  getCiteSourceYearLastestInDb,
  pushLogScraping,
} = require("../../qurey/qurey_function");

const waitForElement = async (selector, maxAttempts = 10, delay = 200) => {
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      await page.waitForSelector(selector, { timeout: 1000 });
      break;
    } catch (error) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

let roundJournal = 0;
let journal = [];
let updateCiteScoreYear = [];
let checkUpdate;
let checkNotUpdate;
let firstScraping;
let linkError = [];
let journalData = [];

const isDuplicateSourceID = (sourceID) => {
  return journal.some((entry) => entry.source_id === sourceID);
};

const scrapJournal = async (sourceID) => {
  try {
    let hasSource = false;
    const batchSize = 5;
    console.log("\n **** Start Scraping Journal Data From Scopus ****\n");
    if (typeof sourceID !== "undefined") {
      journalData = sourceID;
    } else if ((await getCountRecordInJournal()) === 0 || journal.length > 0) {
      console.log("journal.length = ", journal.length);
      if (journalData.length <= 0) {
        journalData = await getAllSourceIdOfArticle();
      }
    } else {
      hasSource = true;
      if (journalData.length <= 0) {
        journalData = await getAllSourceIDJournal();
      }
    }
    console.log("Length Source ID : ", journalData.length);
    console.log("Source ID : ", journalData);

    //journalData.length
    for (let i = roundJournal; i < journalData.length; i += batchSize) {
      const batch = journalData.slice(i, i + batchSize);
      roundJournal = i;
      console.log("\nRound Scraping : ", roundJournal, "\n");
      const promises = batch.map(async (journalItem, index) => {
        checkUpdate = false;
        checkNotUpdate = false;
        let browser;

        try {
          browser = await puppeteer.launch({ headless: "new" });
          const page = await browser.newPage();
          const currentIndex = i + index + 1;
          console.log(
            currentIndex,
            "/",
            journalData.length,
            "| Source ID:",
            journalItem
          );
          const link = `https://www.scopus.com/sourceid/${journalItem}`;
          const response = await page.goto(link, { waitUntil: "networkidle2" });
          await page.waitForTimeout(1600);
          await waitForElement(
            "#csCalculation > div:nth-child(2) > div:nth-child(2) > div > span.fupValue > a > span"
          );
          await waitForElement(
            "#CSCategoryTBody > tr:nth-child(1) > td:nth-child(1) > div.treeLineContainer > span"
          );
          if (response.ok()) {
            const hasSourceId = await hasSourceID(journalItem);
            let yearLastestInDb = 0;
            let yearLastestInWebPage = 0;
            let numNewJournal = 0;

            if (hasSource) {
              const yearDb = Number(await getCiteSourceYearLastestInDb(journalItem));
              if (yearDb !== null) {
                await waitForElement("#year-button > span.ui-selectmenu-text");
                yearLastestInWebPage =
                  await scraperCiteScoreYearLastestInWebPage(page);
                yearLastestInDb = yearDb;
                numNewJournal = yearLastestInWebPage - yearLastestInDb;
              }
            }

            if (!hasSourceId) {
              firstScraping = true;
              console.log("\n------------------------------------------");
              console.log("First Scraping Source ID : ", journalItem);
              console.log("------------------------------------------");
              console.log("yearLastestInWebPage = ", yearLastestInWebPage);
              console.log("yearLastestInDb = ", yearLastestInDb, "\n");

              let data = await scraperJournalData(
                journalItem,
                numNewJournal,
                page
              );

              if (data !== null) {
                if (!isDuplicateSourceID(data.source_id)) {
                  journal.push(data);
                }
              }

              return {
                status: "fulfilled",
                value: data,
                source_id: journalItem,
                firstScraping: firstScraping,
              };
            } else if (yearLastestInWebPage > yearLastestInDb) {
              checkUpdate = true;
              console.log("\n------------------------------");
              console.log("Update Journal Data Source ID : ", journalItem);
              console.log("-------------------------------");
              console.log("yearLastestInWebPage = ", yearLastestInWebPage);
              console.log("yearLastestInDb = ", yearLastestInDb, "\n");
              const new_cite_source_year = await processDropdowns(
                page,
                numNewJournal
              );
              if (new_cite_source_year) {
                updateCiteScoreYear.push(new_cite_source_year);
              }
              console.log("New Cite Source Year Data Of Source ID | ",journalItem," : ", new_cite_source_year);
              return {
                status: "fulfilled",
                value: new_cite_source_year,
                source_id: journalItem,
                checkUpdate: checkUpdate,
              };
            } else {
              checkNotUpdate = true;
              console.log(
                "\n----------------------------------------------------------"
              );
              console.log(
                "Cite Score Year of Source ID : ",
                journalItem,
                "is not update"
              );
              console.log(
                "----------------------------------------------------------"
              );
              console.log("yearLastestInWebPage = ", yearLastestInWebPage);
              console.log("yearLastestInDb = ", yearLastestInDb, "\n");
              return {
                status: "fulfilled",
                value: [],
                checkNotUpdate: checkNotUpdate,
              };
            }
          } else {
            linkError.push(link);
            return;
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
      const mappedResults = batchResults.map((result) => {
        return (
          result.value.value !== null && result.value.status !== "rejected"
        );
      });

      console.log("mappedResults = ", mappedResults);
      const hasFalse = mappedResults.includes(false);
      const finalResult = !hasFalse;
      if (finalResult) {
        if (
          batchResults.length === batchSize ||
          batchResults.length === batch.length
        ) {
          for (const result of batchResults) {
            if (result.status === "fulfilled") {
              const data = result.value;
              if (data.value.length !== 0 || data.checkUpdate) {
                if (data.firstScraping) {
                  await insertDataToJournal(data.value, data.source_id);
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
              return;
            }
          }
        } else {
          console.log("!== batchsize");
          await scrapJournal();
          return;
        }
      } else {
        console.log("some field in journal have null");
        await scrapJournal();
        return;
      }

      roundJournal += batchSize;
    }
    if (updateCiteScoreYear.length > 0) {
      journal = updateCiteScoreYear;
    }
    let error = linkError;
    let numScraping = journal.length;
    roundJournal = 0;
    journal = [];
    linkError = [];
    journalData = [];
    console.log("\n **** Finish Scraping Journal Data From Scopus **** \n");

    const logScraping = {
      message: "Scraping Journal Data For Scopus Completed Successfully.",
      numJournalScraping: numScraping,
    }
    pushLogScraping(logScraping, "journal")

    console.log("\n------------------------------------------------------------------------")
    console.log("Finsh Scraping journal Data : ", logScraping)
    console.log("------------------------------------------------------------------------\n")

    return logScraping
  } catch (error) {
    console.error("\nError occurred while scraping\n : ", error);
    await scrapJournal();
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
    console.error(
      "Error occurred in scraperCiteScoreYearLastestInWebPage:",
      error
    );
    throw error;
  }
};

const scrapOneJournal = async (source_id) => {
  try {
    const batchSize = 5;
    let roundJournal = 0;
    const journal_data = [];
    const journal_All = source_id.split(",").map((e) => e.trim());
    const totalJournals = journal_All.length;

    while (roundJournal < totalJournals) {
      const batch = journal_All.slice(roundJournal, roundJournal + batchSize);

      const promises = batch.map(async (journalItem) => {
        console.log(
          `Scraping Journal (${roundJournal + 1
          }/${totalJournals}): Source ID ${journalItem}`
        );

        try {
          const browser = await puppeteer.launch({ headless: false });
          const page = await browser.newPage();
          const link = `https://www.scopus.com/sourceid/${journalItem}`;
          await page.goto(link, { waitUntil: "networkidle2" });
          // await page.waitForTimeout(1600);
          await waitForElement(
            "#csCalculation > div:nth-child(2) > div:nth-child(2) > div > span.fupValue > a > span"
          );
          const data = await scraperJournalData(journalItem, 0, page);
          console.log(`Finish Scraping Journal ID: ${journalItem}`);
          await browser.close();
          return { status: "fulfilled", value: data };
        } catch (error) {
          console.error(
            "Error occurred while scraping Journal ID:",
            journalItem
          );
          return { status: "rejected" };
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
    console.error("Error occurred while scraping:", error);
    return [];
  }
};

const scraperChangeNameJournal = async (html) => {
  try {
    const $ = cheerio.load(html);
    let sourceLink;
    let fieldText;
    const content = $(
      "#jourlSection > div.col-md-9.col-xs-9.noPadding > div > div.metaText.SRL"
    );
    let arrayJournal = [];
    const contentLength = content.length;
    if (contentLength > 0) {
      content.each(function () {
        fieldText = $(this).find("span").text();
        sourceLink = $(this).find("a").attr("href");
        journalName = $(this).find("a").text();

        if (sourceLink && fieldText && journalName) {
          let changeJournal = {
            journal_name: journalName,
            source_id: sourceLink.split("./")[1],
            field: fieldText.split(":")[0].trim(),
          };
          arrayJournal.push(changeJournal);
        } else {
          return null;
        }
      });
    }
    return arrayJournal;
  } catch (error) {
    console.error("Error while scraping:", error);
    return null;
  }
};

const isEmptyOrLengthZero = (value) => {
  return (
    value === "" ||
    value === null ||
    (Array.isArray(value) && value.length === 0)
  );
};

const scraperJournalData = async (source_id, numNewJournal, page) => {
  try {
    let html = await page.content();
    const buttonElement = await page.$("#csSubjContainer > button");
    if (buttonElement) {
      await page.click("#csSubjContainer > button");
      await page.waitForTimeout(1300);
      html = await page.content();
    }
    const $ = cheerio.load(html);

    let journal = {
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
    let changeJournal = await scraperChangeNameJournal(html);
    if (changeJournal.length > 0) {
      journal.changeJournal = changeJournal;
    }
    journal.cite_source = await processDropdowns(page, numNewJournal);

    for (const field in journal) {
      if (journal.hasOwnProperty(field) && field !== "cite_source") {
        if (isEmptyOrLengthZero(journal[field])) {
          journal = null;
          break;
        }
      }
    }

    return journal;
  } catch (error) {
    console.error("\nError occurred while scraping\n : ", error);
    return null;
  }
};

const dropDownOption = async (page) => {
  const dropdownSelector = 'select[name="year"]';
  if (await page.$(dropdownSelector)) {
    await page.waitForSelector(dropdownSelector);
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
      if (index != 0) {
        const option = dropDownOptions[index];
        await page.waitForSelector("#year");
        await page.click(
          "#year-button > span.ui-selectmenu-icon.ui-icon.btn-primary.btn-icon.ico-navigate-down.flexDisplay.flexAlignCenter.flexJustifyCenter.flexColumn"
        );
        await page.waitForTimeout(1700);
        await page.click(`#ui-id-${index + 1}`);
        await page.waitForTimeout(2000);
      }
      const html = await page.content();
      const $ = cheerio.load(html);

      const year = $("#year-button > span.ui-selectmenu-text").text();
      const citeScore = $("#rpResult").text();
      const calculatedDate = $("#lastUpdatedTimeStamp")
        .text()
        .substring("Calculated on ".length)
        .replace(",", "");
      const cite = { year, citeScore, calculatedDate }
      const category = await scrapCategoryJournal(html);

      const data = { cite, category };
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
    const calculated = $("#lastUpdatedTimeStamp")
      .text()
      .substring("Calculated on ".length)
      .replace(",", "");
    const data = { year, calculated, citation, category };
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
  scrapOneJournal
};