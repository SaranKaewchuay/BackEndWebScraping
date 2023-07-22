const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const axios = require("axios");
const { insertDataToDbScholar} = require("../insertToDb/insertToDb");
const userAgent = require("user-agents");
const {   getCountAuthorScholar, getCountArticleScholar } = require("../../qurey/qurey_function");
// process.setMaxListeners(100);
let numArticle = null;
let linkError = [];
let url_not = [];
let url_author;

const requestToWebPage = async (url, page) => {
  const response = await page.goto(url, { waitUntil: "networkidle2" });
  if (response.ok) {
    return page;
  } else {
    return "page not response ok";
  }
};

const getUserScholarId = async (url) => {
  try {
    const regex = /user=([\w-]+)/;
    const match = url.match(regex);
    if (match) {
      return match[1];
    } else {
      return null;
    }
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred:", error);
    return null;
  }
};

const checkElementExists = async (page, selector) => {
  try {
    const element = await page.$(selector);
    return element !== null;
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred:", error);
    return false;
  }
};

const check_url = async (authorObject) => {
  try {
    let url_checked;
    const name = authorObject.name.split(".").pop().trim().split(" ");
    const browser = await puppeteer.launch({ headless:  "new" });
    const page = await browser.newPage();
    await page.setUserAgent(userAgent.random().toString());

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
    await browser.close();

    return url_checked;
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred during check_url:", error);
    return authorObject.url;
  }
};

const getURLScholar = async () => {
  try {
    const response = await axios.get(
      "https://iriedoc.wu.ac.th/data/apiwris/RPS_PERSON.php"
    );
    const data = response.data;

    const scholar = data
      .map((element) => ({
        name:
          element.TITLEENG + " " + element.FNAMEENG + " " + element.LNAMEENG,
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
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred during getURLScholar:", error);
    return [];
  }
};

const getAuthorAllDetail = async (authorObject, number_author, length) => {
  url_author = {
    name: authorObject.name,
    url: authorObject.url,
    index: number_author - 1,
  };
  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setUserAgent(userAgent.random().toString());
    const scholar_id = await getUserScholarId(authorObject.url)

    let url_checked = await check_url(authorObject);
    let authorAllDetail;
    let url_not_ready;

    const response = await page.goto(url_checked, {
      waitUntil: "networkidle2",
    });

    if (response.ok()) {
      await scrapeAdditionalData(page);
      const html = await page.content();
      const selector = "#gsc_a_b > tr";
      const content = await getArticleUrl(html, selector);

      console.log(
        "Author ",
        number_author,
        " / ",
        length,
        ": " + authorObject.name
      );
      console.log("Number of Articles: ", content.length);

      const batchSize = 50;

      const article_detail_promises = [];

      for (let i = 0; i < content.length; i += batchSize) {
        const batch = content.slice(i, i + batchSize);

        const batch_promises = batch.map(async (article_sub_data) => {
          const detail_page_url = article_sub_data.url;
          return fetchArticleDetail(browser, detail_page_url,scholar_id);
        });

        article_detail_promises.push(...batch_promises);
      }

      authorAllDetail = await getAuthorDetail(html, url_checked);
      authorAllDetail.articles = await Promise.all(article_detail_promises);
      authorAllDetail.documents = article_detail_promises.length 

      if (authorAllDetail) {
          insertDataToDbScholar(authorAllDetail);
      }
    } else {
      authorAllDetail = false;
      url_not_ready = {
        name: authorObject.name,
        url: url_checked,
        index: number_author - 1,
      };
      url_not.push(url_not_ready);
      console.log("url_not : ", url_not);
    }

    await browser.close();

    return { all: authorAllDetail, url_not_ready: url_not_ready };
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred during getAuthorAllDetail:", error);
    return { all: false, url_not_ready: null };
  }
};


const getAuthorScholar = async (author_id) => {
  const all_id = author_id.split(",").map((e) => e.trim());

  try {
    const browser = await puppeteer.launch({ headless: false });

    let authorAll = [];
    let url_not_ready = [];
    let url_author;
    const batchSize = 5;

    let sizeLoop = all_id.length < batchSize && all_id.length > 0 ? all_id.length : batchSize;

    const author_promises = [];
    for (let i = 0; i < all_id.length; i += sizeLoop) {
      const batch = all_id.slice(i, i + sizeLoop);
      const batch_promises = batch.map(async (scholar_id) => {
        const page = await browser.newPage();
        await page.setUserAgent(userAgent.random().toString());
        console.log(`Scholar ID: ${scholar_id}`);
        const url = `https://scholar.google.com/citations?user=${scholar_id}&hl=en`;
        url_author = {
          scholar_id : scholar_id,
          url : url
        }
        const response = await page.goto(url, { waitUntil: "networkidle2" });
        if (response.ok()) {
          const html = await page.content();
          return await getAuthorDetail(html, url);
        } else {
          url_not_ready.push({
            scholar_id: scholar_id,
            url: url,
          });
          return null;
        }
      });

      author_promises.push(...batch_promises);
    }

    const authorResults = await Promise.allSettled(author_promises);
    console.log("authorResults = ",authorResults)
    authorResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        authorAll.push(result.value);
      }else{
        console.log("result.value = ",result.value)
      }
    });

    await browser.close();

    return { all: authorAll, url_not_ready: url_not_ready };
  } catch (error) {
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.error("An error occurred during getAuthorAllDetail:", error);
    return { all: false, url_not_ready: null };
  }
};

const getArticleScholar = async (scholar_id) => {
  
  try {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setUserAgent(userAgent.random().toString());


    let articleAll;
    let url_not_ready;
    const url = `https://scholar.google.com/citations?user=${scholar_id}&hl=en`;

    const response = await page.goto(url, {
      waitUntil: "networkidle2",
    });

    if (response.ok()) {
      await scrapeAdditionalData(page);
      const html = await page.content();
      const selector = "#gsc_a_b > tr";
      const content = await getArticleUrl(html, selector);

      console.log(" Scrapin Article of scohalr ID : ",scholar_id);
      console.log("Number of Articles: ", content.length);

      const batchSize = 50; // Set the desired batch size

      const article_detail_promises = [];
    // console.log("content = ",content)
      for (let i = 0; i < content.length; i += batchSize) {
        // console.log(" i = ",i)
        const batch = content.slice(i, i + batchSize);

        const batch_promises = batch.map(async (article_sub_data) => {
          const detail_page_url = article_sub_data.url;
          return fetchArticleDetail(browser, detail_page_url,scholar_id);
        });

        article_detail_promises.push(...batch_promises);
      }

      // authorAllDetail = await getAuthorDetail(html, url_checked);
      articleAll = await Promise.all(article_detail_promises);

      console.log("");
      console.log(
        "Sraping Article of ",
        scholar_id,
        " was completed successfully"
      );
      console.log("");
    } else {
      articleAll = false;
      url_not_ready = {
          scholar_id: scholar_id,
          url: url,
      };
      url_not.push(url_not_ready);
    }

    await browser.close();

    return { all: articleAll, url_not_ready: url_not_ready };
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    return { all: false, url_not_ready: null };
  }
};


const scrapeAdditionalData = async (page) => {
  try {
    while (await page.$eval("#gsc_bpf_more", (button) => !button.disabled)) {
      await page.click("#gsc_bpf_more");
      await page.waitForTimeout(2000);
      await page.waitForSelector("#gsc_a_b");
    }
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error(
      `Error occurred during scrapeAdditionalData: ${error.message}`
    );
  }
};


const fetchArticleDetail = async (browser, detail_page_url,scholar_id) => {
  try {
    const page = await browser.newPage();
    await page.setUserAgent(userAgent.random().toString());

    await page.goto(detail_page_url, { waitUntil: "networkidle2" });
    const detail_page_html = await page.content();
    const article_data = await getArticleDetail(
      detail_page_html,
      detail_page_url,
      scholar_id
    );
    await page.close();
    return article_data;
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred during fetchArticleDetail:", error);
    return null;
  }
};

const getArticleUrl = async (html, selector) => {
  try {
    const $ = cheerio.load(html);
    const content = $(selector);
    const news_data = content
      .map(function () {
        return {
          //#gsc_a_b > tr > td.gsc_a_t > a
          title: $(this).find("td.gsc_a_t > a").text(),
          url: "https://scholar.google.com" + $(this).find("a").attr("href"),
        };
      })
      .get();
    return news_data;
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred during getArticleUrl:", error);
    return [];
  }
};

const check_src_image = async (html) => {
  try {
    const $ = cheerio.load(html);
    const image = $("#gsc_prf_pup-img").attr("src");
    const src = image.includes("https://scholar.googleusercontent.com")
      ? image
      : "https://scholar.googleusercontent.com" + image;
    return src;
  } catch (error) {
    // url_author.message_error = 'An error occurred: '+ error
    // !linkError.includes(url_author) ? linkError.push(url_author) : null;
    // console.log("linkError : ",linkError)
    // console.error("An error occurred during check_src_image:", error);
    return null;
  }
};

const getGraph = async (url) => {
  try {
    let graph = [];
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.setUserAgent(userAgent.random().toString());

    try {
      await page.goto(`${url}#d=gsc_md_hist`);
      const html = await page.content();
      const $ = cheerio.load(html);
      await browser.close();

      const years = $("#gsc_md_hist_c > div > div.gsc_md_hist_w > div > span")
        .map((_, el) => $(el).text())
        .get()
        .sort((a, b) => b - a);

      const content_graph = $(
        "#gsc_md_hist_c > div > div.gsc_md_hist_w > div > a"
      );
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
    } catch (error) {
      url_author.message_error = "An error occurred: " + error;
      !linkError.includes(url_author) ? linkError.push(url_author) : null;
      console.log("linkError : ", linkError);
      console.error("An error occurred during page.goto:", error);
      await browser.close();
      return null;
    }
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred during getGraph:", error);
    return null;
  }
};

const getSubTable = async (url) => {
  try {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setUserAgent(userAgent.random().toString());

    try {
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
    } catch (error) {
      url_author.message_error = "An error occurred: " + error;
      !linkError.includes(url_author) ? linkError.push(url_author) : null;
      console.log("linkError : ", linkError);
      console.error("An error occurred during page.goto:", error);
      await browser.close();
      return null;
    }
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred during getSubTable:", error);
    return null;
  }
};

const getCitation = async (url) => {
  try {
    const citation_by = {};
    citation_by.table = await getSubTable(url);
    citation_by.graph = await getGraph(url);
    return citation_by;
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred during getCitation:", error);
    return null;
  }
};

const getAuthorDetail = async (html, url) => {
  try {
    const scholar_id = await getUserScholarId(url)
    const $ = cheerio.load(html);
    const author_detail = {
      scholar_id : scholar_id,
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
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred during getAuthorDetail:", error);
    return null;
  }
};

const getSubjectArea = async (html) => {
  try {
    const $ = cheerio.load(html);
    const subject = $("#gsc_prf_int > a");
    const subjectArea = subject.map((i, el) => $(el).text()).get();
    return subjectArea;
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred during getSubjectArea:", error);
    return null;
  }
};
const getArticleId = async(urlString) => {
  const regex = /citation_for_view=.*?:([^&]+)/;
  const match = urlString.match(regex);

  if (match && match[1]) {
    const desiredString = match[1];
    return desiredString
  } else {
    console.log("Desired string not found.");
}
}

const getArticleDetail = async (html, url,scholar_id) => {
  try {
    const $ = cheerio.load(html);
    const content = $("#gsc_oci_table > div.gs_scl");

    const field = [];
    let article_data = {};
    article_data.article_id = await getArticleId(url)
    article_data.article_name = $("#gsc_oci_title").text();

    content.map(async function (i) {
      try {
        let fieldText = $(this)
          .find(".gsc_oci_field")
          .text()
          .trim()
          .toLowerCase();
        fieldText = fieldText.replace(" ", "_");
        const fieldValue = $(this)
          .find(".gsc_oci_value > div > a")
          .text()
          .trim();
        field.push(fieldText);

        if (fieldText === "total_citations") {
          article_data[fieldText] = fieldValue.replace("Cited by", "").trim();
        } else {
          article_data[fieldText] = $(this)
            .find(".gsc_oci_value")
            .text()
            .trim();
          if (fieldText === "authors") {
            article_data[fieldText] = await getAuthor(article_data[fieldText]);
          }
        }
      } catch (error) {
        url_author.message_error = "An error occurred: " + error;
        !linkError.includes(url_author) ? linkError.push(url_author) : null;
        console.log("linkError : ", linkError);
        console.error(
          `An error occurred during article detail mapping: ${error}`
        );
        return null;
      }
    });

    article_data.scholar_id = scholar_id;
    article_data.url = url;

    return article_data;
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred during getArticleDetail:", error);
    return null;
  }
};

const getAuthor = async (author) => {
  try {
    const author_data = author.split(",").map((item) => item.trim());
    return author_data;
  } catch (error) {
    url_author.message_error = "An error occurred: " + error;
    !linkError.includes(url_author) ? linkError.push(url_author) : null;
    console.log("linkError : ", linkError);
    console.error("An error occurred during getAuthor:", error);
    return null;
  }
};

module.exports = {
  getURLScholar,
  getAuthorAllDetail,
  getAuthorDetail,
  getArticleDetail,
  getAuthorScholar,
  getArticleScholar
};
