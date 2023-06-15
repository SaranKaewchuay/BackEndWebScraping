const axios = require("axios");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const fs = require("fs");

const scraper = async () => {
  const allURLs = await getURLScopus();
  const allAuthors = [];
  //allAuthors
  for (let i = 0; i < allAuthors; i++) {
    console.log(`Scraping Author ${i + 1} of ${allURLs.length}: ${allURLs[i].name}`);
    console.log(`URL: ${allURLs[i].url}`);
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    const article = await scrapeArticleData(allURLs[i].url, page);
    const author = await scrapeAuthorData(allURLs[i].url, page);
    author.articles = article;
    allAuthors.push(author);

    if (i === 0) {
      fs.writeFileSync("./JsonFile/Scopus_Author_latest.json", JSON.stringify([author], null, 2));
    } else {
      const rawData = fs.readFileSync('../JsonFile/Scopus_Author_latest.json');
      const data = JSON.parse(rawData);
      data.push(author);
      fs.writeFileSync('./JsonFile/Scopus_Author_latest.json', JSON.stringify(data, null, 2));
    }

    await browser.close();
  }

  console.log("Finish Scraping Scopus");

  return allAuthors;
}


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
  const selector = "div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > div:nth-child(2) > ul > li";
  const content = $(selector);
  const url_data = [];
  content.each(function () {
    const link = $(this).find("h4 > a").attr("href");
    url_data.push(link);
  });
  return url_data;
};

const getArticleDetail = async (page,url) => {
  await page.click("#show-additional-source-info");
  const html = await page.content();
  const viewFullSource = scrapViewFullSource(page)
  const $ = cheerio.load(html);
  let publisher
  if((await viewFullSource).publisher){
    publisher = (await viewFullSource).publisher
  }

  const article_data = {
    name: $("#doc-details-page-container > article > div:nth-child(2) > section > div.row.margin-size-8-t > div > h2 > span").text(),
    co_author: await scrapCo_Author(html),
  };

  $("#source-info-aside > div > div > div > dl, #source-info-aside > div > div > div > els-collapsible-panel > section > div > div > dl").each(function (i, element) {
   
    const fieldText = $(element).find("dt").text().trim().toLowerCase().replace(" ", "_");
    const fieldValue = $(element).find("dd").text().trim();
    if(fieldText == "publisher"){
      if(!publisher){
        publisher = fieldValue;
      }else{
        return true;
      }
    }else{
      article_data[fieldText] = fieldValue;
    }
    
  });
  article_data.publisher = publisher
  article_data.E_ISSN = (await viewFullSource).E_ISSN,
  article_data.subject_area = (await viewFullSource).subject_area,
  article_data.cite_score_2021 = (await viewFullSource).cite_score_2021,
  article_data.sjr_2021 = (await viewFullSource).sjr_2021,
  article_data.snip_2021 = (await viewFullSource).snip_2021,
  article_data.author_keywords = await scrapAuthorKeyword(html),
  article_data.abstract = $("#doc-details-page-container > article > div:nth-child(4) > section > div > div.margin-size-4-t.margin-size-16-b > p > span").text(),
  article_data.url = url


  return article_data;
};
const scrapAuthorKeyword = async (html) => {
  const $ = cheerio.load(html);
  const content = $("#doc-details-page-container > article > div:nth-child(4) > section > div.margin-size-16-y > div:nth-child(4) > span")
  const author_keyword  = [];
  content.each(function () {
    const keyword = $(this).text(); 
    author_keyword .push(keyword);
  });
  return author_keyword 
}

const scrapViewFullSource = async (page) => {
  await page.click("#source-preview-flyout");
  await page.waitForTimeout(1500);
  const selector = "#source-preview-details-link"
  if((await page.$(selector))){
    const link_data = await page.waitForSelector(selector);
    const link = await page.evaluate((element) => element.href, link_data);
    await page.goto(link, { waitUntil: "networkidle2" });
    const html = await page.content();
    const $ = cheerio.load(html);
    const data = {
      publisher: $("#jourlSection > div.col-md-9.col-xs-9.noPadding > div > ul > li:nth-child(2) > span.right").text(),
      E_ISSN: $("#jourlSection > div.col-md-9.col-xs-9.noPadding > div > ul > li:nth-child(3) > span.marginLeft1.right").text(),
      subject_area: await scrapSubjectAreaArticle(html),
      cite_score_2021: $("#rpCard > h2 > span").text(),
      sjr_2021: $("#sjrCard > h2 > span").text(),
      snip_2021 : $("#snipCard > h2 > span").text(),
    }
    return data
  }else{
    const data = {
      publisher: "",
      E_ISSN: "",
      subject_area: "",
      cite_score_2021: "",
      sjr_2021: "",
      snip_2021 : "",
    }
    return data
  }
  
}

const scrapSubjectAreaArticle = async (html) => {
  const $ = cheerio.load(html);
  const content = $("#csSubjContainer > span")
  const subjectAreaArticle  = [];
  content.each(function () {
    subjectAreaArticle.push($(this).text());
  });
  return subjectAreaArticle
}


const scrapCo_Author = async(html)=>{
  const $ = cheerio.load(html);
  const content = $("#doc-details-page-container > article > div:nth-child(2) > section > div:nth-child(2) > div > ul > li")
  const co_author_data = [];
  content.each(function () {
    const co_author_name = $(this).find("button > span").text(); 
    co_author_data.push(co_author_name);
  });
  return co_author_data
}


const scrapeArticleData = async (url,page) => {
  await page.goto(url, { waitUntil: "networkidle2" });
  await page.click("#preprints");
  await page.waitForTimeout(1500);
  await page.click("#documents");
  await page.waitForTimeout(1600);
  let html = await page.content();
  let link_Article = await getArticleUrl(html);
 
  const selector = 'div.Columns-module__FxWfo > div:nth-child(2) > div > els-results-layout > els-paginator > nav > ul > li:last-child > button';

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
    console.log(i + 1);
    const article_url = link_Article[i];
    await page.goto(article_url, { waitUntil: "networkidle2" });
    const article_data = await getArticleDetail(page,article_url);
    article_detail.push(article_data);
  }

  return article_detail;
};


const scrapeAuthorData = async (url,page) => {
  await page.goto(url, { waitUntil: "networkidle2" });
  const html = await page.content();
  const $ = cheerio.load(html);
  const author = {
    name: $("div.Col-module__hwM1N.offset-lg-2 > div > h1 > strong").text(),
    citations_by: $("section > div > div:nth-child(1) > div > div > div:nth-child(1) > span").text(),
    documents: $("section > div > div:nth-child(2) > div > div > div:nth-child(1) > span").text(),
    h_index: $("section > div > div:nth-child(3) > div > div > div:nth-child(1) > span").text(),
    subject_area: await scrapSubjectArea(page),
    citations: await scrapCitation(url,page),
    url: url,
  };

  return author;
}

const scrapCitation = async (url,page) => {
  const scopusID = await getScopusID(url)
  const url_citaion = `https://www.scopus.com/hirsch/author.uri?accessor=authorProfile&auidList=${scopusID}&origin=AuthorProfile`
  await page.goto(url_citaion, { waitUntil: "networkidle2" });
  await page.click("#analyzeCitations-miniGraph > button")
  const html = await page.content();
  const $ = cheerio.load(html);
  const content = $("#analyzeCitations-table > tbody > tr")
  const citation = [];
  content.each(function () {
    const year = $(this).find("td:nth-child(1)").text();
    const documents = $(this).find("td.alignRight > a > span").text();
    if (documents) {
      const citations = {
        year: year,
        documents: documents
      };
      citation.push(citations);
    }
  });
  
  return citation
}

const getScopusID = async (url) => {
  const match = url.match(/authorId=\d+/)[0];
  const scopusID = match.match(/=(\d+)/)[1];
  return scopusID
}


const scrapSubjectArea = async (page) => {
  try {
    await page.click("#AuthorHeader__showAllAuthorInfo");
    const html = await page.content()
    const $ = cheerio.load(html);
    const clickViewMore = $( "div > div > div > div > div > div > div:nth-child(4) > div > span").text()
    const bulletChar = "•";
    const bulletCount = (clickViewMore.match(new RegExp(bulletChar, "g")) || []).length;
    const subjectArea = [];

    for (let i = 0; i < bulletCount + 1; i++) {
      const sub = clickViewMore.split(bulletChar)[i].trim();
      subjectArea[i] = sub;
    }
    return subjectArea
  } catch (error) {
    console.log(error)
  }
}

module.exports = {
  scraper,
};
