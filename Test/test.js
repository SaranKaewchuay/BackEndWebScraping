
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");

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
      url_author.message_error = 'An error occurred: '+ error
      !linkError.includes(url_author) ? linkError.push(url_author) : null;
      console.log("linkError : ",linkError)
      console.error('An error occurred:', error);
      return null;
    }
  };

  
const checkElementExists = async (page, selector) => {
    try {
      const element = await page.$(selector);
      return element !== null;
    } catch (error) {
      url_author.message_error = 'An error occurred: '+ error
      !linkError.includes(url_author) ? linkError.push(url_author) : null;
      console.log("linkError : ",linkError)
      console.error('An error occurred:', error);
      return false;
    }
  };

const check_url = async () => {
    const authorObject = {
        name: "Mr. Patibut Preeyawongsakul",
        url : "https://scholar.google.co.th/citations?user=RTGgUycAAAAJ&hl=en&oi=ao"
    }
    try {
      let url_checked;
      const name = authorObject.name.split(".").pop().trim().split(" ");
      const browser = await puppeteer.launch({ headless: "new" });
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
      await browser.close();
   console.log("url_checked t = ",url_checked)
      return url_checked;
    } catch (error) {
    //    url_author.message_error = 'An error occurred: '+ error
    //   !linkError.includes(url_author) ? linkError.push(url_author) : null;
    //   console.log("linkError : ",linkError)
      console.error("An error occurred during check_url:", error);
      return authorObject.url; 
    }
  };
  check_url()
// const getArticleUrl = async () => {
//     const selector = "#gsc_a_b > tr";
//     const url = "https://scholar.google.co.th/citations?user=RTGgUycAAAAJ&hl=en&oi=ao"
//     //check url ใน api
//     try {
//         const browser = await puppeteer.launch({ headless: "new" });
//         const page = await browser.newPage();
//         await page.goto(url, { waitUntil: "networkidle2" });
//         const html = await page.content()
//       const $ = cheerio.load(html);
//       const content = $(selector);
//       const news_data = content.map(function () {
//         return {   //#gsc_a_b > tr > td.gsc_a_t > a
//           title: $(this).find("td.gsc_a_t > a").text(),
//           url: "https://scholar.google.com" + $(this).find("a").attr("href"),
//         };
//       }).get();
//       console.log("data = ",news_data)
//       return news_data;
//     } catch (error) {
//       url_author.message_error = 'An error occurred: '+ error
//       !linkError.includes(url_author) ? linkError.push(url_author) : null;
//       console.log("linkError : ",linkError)
//       console.error("An error occurred during getArticleUrl:", error);
//       return [];
//     }
//   };

//   getArticleUrl()