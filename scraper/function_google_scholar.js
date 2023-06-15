const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const axios = require("axios");

let numArticle = null;

const getUserScholarId = async (url) => {
  const regex = /user=([\w-]+)/;
  const match = url.match(regex);
  if (match) {
    return match[1];
  } else {
    return null;
  }
};

async function checkElementExists(page, selector) {
  const element = await page.$(selector);
  return element !== null;
}

const check_url = async (authorObject) => {
  let url_checked;
  const name = authorObject.name.split(".").pop().trim().split(" ");
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const url = `https://scholar.google.com/scholar?hl=th&as_sdt=0%2C5&q=${name[0]}+${name[1]}`;
  await page.goto(url, { waitUntil: "networkidle2" });
  const selector =
    "#gs_res_ccl_mid > div:nth-child(1) > table > tbody > tr > td:nth-child(2) > h4 > a";

  if (await checkElementExists(page, selector)) {
    const $ = cheerio.load(await page.content());
    const link = `https://scholar.google.com${$(selector).attr("href")}`;
    const id_url_current = await getUserScholarId(link);
    const id_url_api = await getUserScholarId(authorObject.url);
    url_checked =
      id_url_api !== id_url_current
        ? `https://scholar.google.com/citations?user=${id_url_current}&hl=en&oi=ao`
        : authorObject.url;
  } else {
    url_checked = authorObject.url;
  }
  console.log("url = ", url_checked);
  await browser.close();

  return url_checked;
};

const getURLScholar = async () => {
  let data = [];
  try {
    const response = await axios.get(
      "https://iriedoc.wu.ac.th/data/apiwris/RPS_PERSON.php"
    );
    data = response.data;
  } catch (error) {
    console.log(error);
  }

  const scholar = data
    .map((element) => ({
      name: element.TITLEENG + element.FNAMEENG + " " + element.LNAMEENG,
      url: element.GGSCHOLAR,
    }))
    .filter((scholar) => scholar.url)
    .map((scholar) => ({
      ...scholar,
      url:
        scholar.url.includes("=th") || scholar.url.includes("=en")
          ? scholar.url.replace("=th", "=en")
          : scholar.url + "&hl=en",
    }));

  return scholar;
};

async function scrapeMultiplePages(urls) {
  const promises = urls.map((url) => scrapePage(url));
  return Promise.all(promises);
}

const getAuthorAllDetail = async (authorObject, author_id) => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  let url_checked = await check_url(authorObject);
  // await page.goto(url_checked , { waitUntil: "networkidle2" });
  let authorAllDetail;
  let url_not_ready;
  try {
    const response = await page.goto(url_checked, {
      waitUntil: "networkidle2",
    });
    if (response.ok()) {
      try {
        while (
          await page.$eval("#gsc_bpf_more", (button) => !button.disabled)
        ) {
          await page.click("#gsc_bpf_more");
          await page.waitForTimeout(1500);
          await page.waitForSelector("#gsc_a_b");
        }
      } catch (error) {
        console.error(`Error: ${error.message}`);
      }

      const html = await page.content();
      const selector = "#gsc_a_b > tr";
      const content = await getArticleUrl(html, selector);
      const article_detail = [];

      //content.length
      console.log("Number of Articles: ", content.length);
      console.log("Scraping Articles: ");
      for (let i = 0; i < content.length; i++) {
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        console.log(i + 1);
        const article_sub_data = content[i];
        const detail_page_url = article_sub_data.url;
        await page.goto(detail_page_url);
        const detail_page_html = await page.content();
        numArticle += 1;
        const article_data = await getArticleDetail(
          detail_page_html,
          detail_page_url,
          author_id
        );
        article_detail.push(article_data);

        await browser.close();
      }
      authorAllDetail = await getAuthorDetail(html, author_id, url_checked);
      authorAllDetail.articles = article_detail;
    } else {
      authorAllDetail = false;
      url_not_ready = {
        name: authorObject.name,
        url: url_checked,
      };
    }
  } catch (error) {
    authorAllDetail = false;
    url_not_ready = {
      name: authorObject.name,
      url: url_checked,
    };
  }

  await browser.close();
  return { all: authorAllDetail, url_not_ready: url_not_ready };
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

const check_src_image = async (html) => {
  const $ = cheerio.load(html);
  let src;
  let image = $("#gsc_prf_pup-img").attr("src");
  if (image.indexOf("https://scholar.googleusercontent.com") == -1) {
    src = "https://scholar.googleusercontent.com" + image;
  } else {
    src = image;
  }
  return src;
};

const getGraph = async (url) => {
  let graph = [];
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto(`${url}#d=gsc_md_hist`);
  const html = await page.content();
  const $ = cheerio.load(html);
  await browser.close();

  const years = $("#gsc_md_hist_c > div > div.gsc_md_hist_w > div > span")
    .map((_, el) => $(el).text())
    .get()
    .sort((a, b) => b - a);

  const content_graph = $("#gsc_md_hist_c > div > div.gsc_md_hist_w > div > a");
  const citations = content_graph
    .map(function (i, el) {
      const { style } = el.attribs;
      const regex = /z-index:(\d+)/;
      const match = style.match(regex);
      const index = match[1];

      return {
        value: $(el).text(),
        index: index,
      };
    })
    .get();

  for (let i = citations.length - 1; i >= 0; i--) {
    const yearIndex = Number(citations[i].index) - 1;
    const obj = {
      year: years[yearIndex],
      citations: citations[i],
    };
    graph.push(obj);
  }

  graph.sort(
    (a, b) => parseInt(b.citations.index) - parseInt(a.citations.index)
  );
  graph = graph.map((obj) => {
    const { index, ...citations } = obj.citations;
    return { year: obj.year, citations: citations.value };
  });

  return graph;
};

const getSubTable = async (url) => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });
  const html = await page.content();
  const $ = cheerio.load(html);
  await browser.close();

  const table = [
    {
      citations: {
        all: $(
          "#gsc_rsb_st > tbody > tr:nth-child(1) > td:nth-child(2)"
        ).text(),
        since_2018: $(
          "#gsc_rsb_st > tbody > tr:nth-child(1) > td:nth-child(3)"
        ).text(),
      },
    },
    {
      h_index: {
        all: $(
          "#gsc_rsb_st > tbody > tr:nth-child(2) > td:nth-child(2)"
        ).text(),
        since_2018: $(
          "#gsc_rsb_st > tbody > tr:nth-child(2) > td:nth-child(3)"
        ).text(),
      },
    },
    {
      i10_index: {
        all: $(
          "#gsc_rsb_st > tbody > tr:nth-child(3) > td:nth-child(2)"
        ).text(),
        since_2018: $(
          "#gsc_rsb_st > tbody > tr:nth-child(3) > td:nth-child(3)"
        ).text(),
      },
    },
  ];

  return table;
};

const getCitation = async (url) => {
  const citation_by = {};
  citation_by.table = await getSubTable(url);
  citation_by.graph = await getGraph(url);
  return citation_by;
};

const getAuthorDetail = async (html, num, url) => {
  const $ = cheerio.load(html);
  const author_detail = {
    author_id: num,
    author_name: $("#gsc_prf_in").text(),
    department: $("#gsc_prf_i > div:nth-child(2)").text(),
    subject_area: await getSubjectArea(html),
    h_index: $(
      "#gsc_rsb_st > tbody > tr:nth-child(2) > td:nth-child(2)"
    ).text(),
    image: await check_src_image(html),
    citation_by: await getCitation(url),
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

const getArticleDetail = async (html, url, author_id) => {
  const $ = cheerio.load(html);
  const content = $("#gsc_oci_table > div.gs_scl");

  const field = [];
  let article_data = {};
  (article_data.article_id = numArticle),
    // (article_data.article_name = $("#gsc_oci_title > a").text());
    (article_data.article_name = $("#gsc_oci_title").text());

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

const getAuthor = async (author) => {
  const author_data = author.split(",");
  for (let i = 0; i < author_data.length; i++) {
    author_data[i] = author_data[i].trim();
  }
  return author_data;
};

module.exports = {
  getURLScholar,
  getAuthorAllDetail,
  getAuthorDetail,
  getArticleDetail,
  scrapeMultiplePages,
};
