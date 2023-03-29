const axios = require("axios");
const cheerio = require("cheerio");
const iconv = require("iconv-lite");
const userAgents = require("user-agents");
const SerpApi = require("google-search-results-nodejs");
const search = new SerpApi.GoogleSearch(
  "bb9dd3ebbad1ab883ed7fe0279b5e08c019d1c165d8801dc68547aed0b5e8904"
);

let numArticle = null;
const articleAll = [];
const authorAll = [];

const getAllAuthorURL = async (url) => {
  const selector = "#gsc_sa_ccl > div.gsc_1usr";
  const html = await sendRequestGetDetail(url);
  const allURL = await getURL(html, selector);
  return allURL;
};


const getURL = async (html, selector) => {
  const $ = cheerio.load(html);
  const content = $(selector);
  const url_data = [];

  content.each(function () {
    const obj = {
      name: $(this).find("div > div > h3 > a").text(),
      url:
        "https://scholar.google.com" + $(this).find("div > a").attr("href"),
    };
    url_data.push(obj);
  });
  return url_data;
};


const getUserScholarId = async (url) => {
  const regex = /user=([\w-]+)/;
  const match = url.match(regex);
  const user_scholar_id = match[1];
  return user_scholar_id;
};

const getCitationByFromApi = async (user_scholar_id) => {
  const params = {
    engine: "google_scholar_author",
    author_id: user_scholar_id,
  };

  return new Promise((resolve, reject) => {
    search.json(params, function (data) {
      resolve(data["cited_by"]);
    }, function (error) {
      reject(error);
    });
  });
};


const getArticleAll = async () => {
  return articleAll;
};

const getArticleOfAuthor = async (URL, author_id) => {
  const selector = "#gsc_a_b > tr";
  const html = await sendRequestGetDetail(URL);
  const content = await getArticleUrl(html, selector);
  const article_detail = [];

  console.log("Number of Articles : ", content.length);
  console.log("Article");
  //content.length
  for (let i = 0; i < 2; i++) {
    console.log(i + 1);
    const e = content[i];
    const detail_page_url = e.url;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const detail_page_html = await sendRequestGetDetail(detail_page_url);
    numArticle += 1;
    const article_data = await getArticleDetail(
      detail_page_html,
      detail_page_url,
      author_id
    );
    articleAll.push(article_data);
    article_detail.push(article_data);
  }
  const articleOfAuthor = await getAuthorDetail(html, author_id, URL);
  authorAll.push(articleOfAuthor);
  articleOfAuthor.articles = article_detail;
  return articleOfAuthor;
};

const getAuthorDetail = async (html, num, url) => {

  const $ = cheerio.load(html);
  const user_scholar_id = await getUserScholarId(url);

  const author_detail = {
    author_id: num,
    author_name: $("#gsc_prf_in").text(),
    department: $("#gsc_prf_i > div:nth-child(2)").text(),
    subject_area: await getSubjectArea(html),
    h_index: $(
      "#gsc_rsb_st > tbody > tr:nth-child(2) > td:nth-child(2)"
    ).text(),
    image: $("#gsc_prf_pup-img").attr("src"),
    citation_by: await getCitationByFromApi(user_scholar_id),
  };

  return author_detail;
};
const getSubjectArea = async (html) => {
  const $ = cheerio.load(html);
  const subjectArea = [];
  const subject = $("#gsc_prf_int > a");

  for (let i = 0; i < subject.length; i++) {
    const obj = $("#gsc_prf_int > a:nth-child(" + (i + 1) + ")").text();
    subjectArea.push(obj);
  }

  return subjectArea;
};



const getArticleUrl = async (html, selector) => {
  const $ = cheerio.load(html);
  const content = $(selector);
  const news_data = [];
  content.each(function () {
    const obj = {
      title: $(this).find("td.gsc_a_t > a").text(),
      url: "https://scholar.google.com" + $(this).find("a").attr("href"),
    };
    news_data.push(obj);
  });
  return news_data;
};

const getAuthor = async (author) => {
  const author_data = author.split(",");
  for (let i = 0; i < author_data.length; i++) {
    author_data[i] = author_data[i].trim();
  }
  return author_data;
};

const getArticleDetail = async (html, url, author_id) => {
  const $ = cheerio.load(html);
  const content = $("#gsc_oci_table > div.gs_scl");

  const field = [];
  let article_data = {};
  (article_data.article_id = numArticle),
    (article_data.article_name = $("#gsc_oci_title > a").text());

  content.each(async function (i) {
    let fieldText = $(this).find(".gsc_oci_field").text().trim().toLowerCase();
    fieldText = fieldText.replace(" ", "_");
    const fieldValue = $(this).find(".gsc_oci_value > div > a").text().trim();
    field.push(fieldText);

    if (fieldText === "total_citations") {
      article_data[fieldText] = fieldValue.replace("Cited by", "").trim();
    } else {
      article_data[fieldText] = $(this).find(".gsc_oci_value").text().trim();
      if (fieldText === "authors") {
        article_data[fieldText] = await getAuthor(article_data[fieldText]);
      }
    }
  });
  (article_data.url = url), (article_data.author_id = author_id);

  return article_data;
};

const sendRequestGetDetail = async (URL) => {
  // const response = await axios.get({URL});
  const randomUserAgent = new userAgents({
    deviceCategory: "desktop",
  }).toString();

  const response = await axios.request({
    method: "GET",
    url: URL,
    responseType: "arraybuffer",
    responseEncoding: "binary",
    headers: {
      "User-Agent": randomUserAgent,
    },
  });
  const html = iconv.decode(response.data, "utf-8");
  
  return html;
};

module.exports = {
  getArticleOfAuthor,
  getAllAuthorURL,
  sendRequestGetDetail,
  getAuthorDetail,
  getArticleDetail,
  getArticleAll,
};
