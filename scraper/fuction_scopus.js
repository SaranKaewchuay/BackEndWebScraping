const axios = require("axios");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const { createJson, createJournal } = require("./createJson");

const scraper = async () => {
  const allURLs = await getURLScopus();
  const allAuthors = [];
  //allAuthors
  for (let i = 0; i < allAuthors; i++) {
    console.log(
      `Scraping Author ${i + 1} of ${allURLs.length}: ${allURLs[i].name}`
    );
    console.log(`URL: ${allURLs[i].url}`);
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    const article = await scrapeArticleData(allURLs[i].url, page);
    const author = await scrapeAuthorData(allURLs[i].url, page);
    author.articles = article;
    allAuthors.push(author);

    await createJson(author);

    await browser.close();
  }
  console.log("Finish Scraping Scopus");

  return allAuthors;
};

const getURL = async () => {
  try {
    const response = await axios.get(
      "https://iriedoc.wu.ac.th/data/apiwris/RPS_PERSON.php"
    );
    return response.data;
  } catch (error) {
    console.log(error);
  }
};

const getURLScopus = async () => {
  const data = await getURL();

  const scopusArray = data
    .map((element) => ({
      name: element.TITLEENG + element.FNAMEENG + " " + element.LNAMEENG,
      url: element.SCOPUSURL,
    }))
    .filter((data) => data.url !== "1" && data.url !== "0");

  return scopusArray;
};

const getArticleUrl = async (html) => {
  const $ = cheerio.load(html);
  const selector =
    "div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > div:nth-child(2) > ul > li";
  const content = $(selector);
  const url_data = [];
  content.each(function () {
    const link = $(this).find("h4 > a").attr("href");
    url_data.push(link);
  });
  return url_data;
};

const scrapAuthorKeyword = async (html) => {
  const $ = cheerio.load(html);
  const content = $(
    "#doc-details-page-container > article > div:nth-child(4) > section > div.margin-size-16-y > div:nth-child(4) > span"
  );
  const author_keyword = [];
  content.each(function () {
    const keyword = $(this).text();
    author_keyword.push(keyword);
  });
  return author_keyword;
};

let sourceID = [];

const getSourceID = async (page) => {
  await page.waitForSelector("#source-preview-flyout");
  await page.click("#source-preview-flyout");
  await page.waitForTimeout(1500);

  const elementExists = (await page.$("#source-preview-details-link")) !== null;

  if (elementExists) {
    const html = await page.content();
    const $ = cheerio.load(html);
    const id = $("#source-preview-details-link").attr("href").split("/")[2];
    if (!sourceID.includes(id)) {
      sourceID.push(id);
      return id;
    } else {
      return null;
    }
  } else {
    console.log("Element not have ViewFullSource");
    return null;
  }
};

const getArticleDetail = async (page, url) => {
  await page.waitForSelector("#show-additional-source-info");
  await page.click("#show-additional-source-info");
  await page.waitForTimeout(1000);
  const html = await page.content();

  const journal = await scrapViewFullSource(page);
  if (journal) {
    await createJournal(journal);
  }

  const $ = cheerio.load(html);

  const article_data = {
    name: $(
      "#doc-details-page-container > article > div:nth-child(2) > section > div.row.margin-size-8-t > div > h2 > span"
    ).text(),
    co_author: await scrapCo_Author(html),
  };

  $(
    "#source-info-aside > div > div > div > dl, #source-info-aside > div > div > div > els-collapsible-panel > section > div > div > dl"
  ).each(function (i, element) {
    const fieldText = $(element)
      .find("dt")
      .text()
      .trim()
      .toLowerCase()
      .replace(" ", "_");
    const fieldValue = $(element).find("dd").text().trim();
    article_data[fieldText] = fieldValue;
  });

  article_data.author_keywords = await scrapAuthorKeyword(html);
  article_data.abstract = $(
    "#doc-details-page-container > article > div:nth-child(4) > section > div > div.margin-size-4-t.margin-size-16-b > p > span"
  ).text();
  article_data.url = url;

  return article_data;
};

const scrapCategoryJournal = async (html) => {
  const $ = cheerio.load(html);
  const content = $("#CSCategoryTBody > tr");
  const subjectAreaArticle = content
    .map(function () {
      return {
        category_name: $(this).find("td > div:nth-child(1)").text().trim(),
        sub_category: $(this)
          .find("tr > td:nth-child(1) > div.treeLineContainer")
          .text()
          .trim(),
        rank: $(this).find("tr > td:nth-child(2)").text().trim(),
        percentile: $(this)
          .find(
            "tr > td:nth-child(3) > div:nth-child(2) > div.pull-left.paddingLeftQuarter"
          )
          .text()
          .trim(),
      };
    })
    .get();
  return subjectAreaArticle;
};

const processDropdowns = async (page) => {
  const dataCitation = [];
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

    for (let index = 0; index < dropdownOptions.length; index++) {
      const option = dropdownOptions[index];
      console.log("year:", option);
      await page.click(
        "#year-button > span.ui-selectmenu-icon.ui-icon.btn-primary.btn-icon.ico-navigate-down.flexDisplay.flexAlignCenter.flexJustifyCenter.flexColumn"
      );
      await page.waitForTimeout(1200);
      await page.click(`#ui-id-${index + 1}`);
      await page.waitForTimeout(2600);
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

const scrapViewFullSource = async (page) => {
  const source_id = await getSourceID(page);
  if (source_id) {
    const selector = "#source-preview-details-link";
    if (await page.$(selector)) {
      const link_data = await page.waitForSelector(selector);
      const link = await page.evaluate((element) => element.href, link_data);
      await page.goto(link, { waitUntil: "networkidle2" });
      const html = await page.content();
      const $ = cheerio.load(html);
      const content = $(
        "#jourlSection > div.col-md-9.col-xs-9.noPadding > div > ul > li"
      );
      const field = [];
      let journal = {};

      journal.source_id = source_id;  
      journal.journal_name = $("#jourlSection > div.col-md-9.col-xs-9.noPadding > div > h2").text(),
      content.map(async function (i) {
        let fieldText = $(this)
          .find("span.left")
          .text()
          .trim()
          .toLowerCase()
          .replace(":", "");
        fieldText = fieldText.replace(" ", "_");
        const fieldValue = $(this).find("span.right").text().trim();
        field.push(fieldText);
        if (fieldText === "subject_area") {
          journal[fieldText] = await scrapSubjectAreaJournal(html);
        } else {
          journal[fieldText] = fieldValue;
        }
      });

      journal.cite_source = await processDropdowns(page);

      return journal;
    } else {
      return null;
    }
  } else {
    return null;
  }
};

const scrapSubjectAreaJournal = async (html) => {
  const $ = cheerio.load(html);
  const content = $("#csSubjContainer > span");
  const subjectAreaJournal = [];
  content.each(function () {
    subjectAreaJournal.push($(this).text());
  });
  return subjectAreaJournal;
};

const scrapCo_Author = async (html) => {
  const $ = cheerio.load(html);
  const content = $(
    "#doc-details-page-container > article > div:nth-child(2) > section > div:nth-child(2) > div > ul > li"
  );
  const co_author_data = [];
  content.each(function () {
    let co_author_name = $(this).find("button > span").text();
    if ($(this).find("a").length > 0) {
      co_author_name = co_author_name + " " + "📧";
    }
    co_author_data.push(co_author_name);
  });
  return co_author_data;
};

const scrapeArticleData = async (url, page) => {
  await page.goto(url, { waitUntil: "networkidle2" });
  await page.waitForSelector("#preprints");
  await page.click("#preprints");
  await page.waitForTimeout(1500);
  await page.waitForSelector("#documents");
  await page.click("#documents");
  await page.waitForTimeout(1600);
  let html = await page.content();
  let link_Article = await getArticleUrl(html);

  const selector =
    "div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > els-paginator > nav > ul > li:last-child > button";

  if (await page.$(selector)) {
    while (await page.$eval(selector, (button) => !button.disabled)) {
      await page.click(selector);
      await page.waitForTimeout(1500);
      const html = await page.content();
      const link = await getArticleUrl(html);
      link_Article = [...link_Article, ...link];
    }
  }

  const article_detail = [];
  console.log("Number of Articles: ", link_Article.length);
  console.log("Scraping Articles: ");
  // link_Article.length
  for (let i = 0; i < link_Article.length; i++) {
    console.log("Article = ", i + 1);
    const article_url = link_Article[i];
    await page.goto(article_url, { waitUntil: "networkidle2" });
    const article_data = await getArticleDetail(page, article_url);
    article_detail.push(article_data);
  }
  return article_detail;
};

const scrapeAuthorData = async (url, page) => {
  await page.goto(url, { waitUntil: "networkidle2" });
  const html = await page.content();
  const $ = cheerio.load(html);
  const author = {
    name: $("#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > div > h1 > strong").text(),
    citation:  $("#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(1) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc").text(),
    citations_by: $("#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(1) > div > div > div:nth-child(2) > span > p > span > em > strong").text(),
    documents: $("#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(2) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc").text(),
    h_index: $("#scopus-author-profile-page-control-microui__general-information-content > div.Col-module__hwM1N.offset-lg-2 > section > div > div:nth-child(3) > div > div > div:nth-child(1) > span.Typography-module__lVnit.Typography-module__ix7bs.Typography-module__Nfgvc").text(),
    subject_area: await scrapSubjectArea(page),
    citations_graph: await scrapCitation(url, page),
    documents_graph: await scrapDocument(url, page),
    url: url,
  };

  return author;
};

const scrapCitation = async (url, page) => {
  const scopusID = await getScopusID(url);
  const url_citaion = `https://www.scopus.com/hirsch/author.uri?accessor=authorProfile&auidList=${scopusID}&origin=AuthorProfile`;
  await page.goto(url_citaion, { waitUntil: "networkidle2" });
  await page.click("#analyzeCitations-miniGraph > button");
  const html = await page.content();
  const $ = cheerio.load(html);
  const content = $("#analyzeCitations-table > tbody > tr");
  const citation = [];
  content.each(function () {
    const year = $(this).find("td:nth-child(1)").text();
    const documents = $(this).find("td.alignRight > a > span").text();
    if (documents) {
      const citations = {
        year: year,
        documents: documents,
      };
      citation.push(citations);
    }
  });

  return citation;
};

const scrapDocument = async (url, page) => {
  const scopusID = await getScopusID(url)
  const url_citaion = `https://www.scopus.com/hirsch/author.uri?accessor=authorProfile&auidList=${scopusID}&origin=AuthorProfile`
  await page.goto(url_citaion, { waitUntil: "networkidle2" });
  await page.click("#analyzeYear-miniChart > header > h2 > button");
  const html = await page.content();
  const $ = cheerio.load(html);
  const content = $("#analyzeYear-table > tbody > tr")
  const document = [];
  content.each(function () {
    const year = $(this).find("td:nth-child(1)").text();
    const documents = $(this).find("td.alignRight > a > span").text();
    if (documents) {
      const citations = {
        year: year,
        documents: documents
      };
      document.push(citations);
    }
  });

  return document
}

const getScopusID = async (url) => {
  const match = url.match(/authorId=\d+/)[0];
  const scopusID = match.match(/=(\d+)/)[1];
  return scopusID;
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
    console.log(error);
  }
};

module.exports = {
  scraper,
};
