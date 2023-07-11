const scrapeArticle = async (url,index) => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    const scopus_id = await getScopusID(url.url);
    console.log(
      `Scraping Author ${index + 1} of ${allURLs.length}: ${
        url.name
      }`
    );
    console.log(`URL: ${url.url}`);

    await page.goto(url.url, { waitUntil: "networkidle2" });
    const html = await page.content();
    const numDocInPage = await getDocumentInpage(html);
    const numArticleInDb = await getNumDocumentArticle(scopus_id);
    const numNotWuDoc = await getNumNotWu(scopus_id);
    const numAll = numArticleInDb + numNotWuDoc;
    console.log("numNotWuDoc =", numNotWuDoc);
    console.log("numAll =", numAll);
    console.log("numDocinPage =", numDocInPage);
    console.log("numArticleInDb =", numArticleInDb);

    if (numArticleInDb === 0) {
      console.log("-------------------------");
      console.log("Do this loop First Scrap");
      console.log("-------------------------");
      const article = await scrapeArticleData(url.url, page, 0);
      allArticle.push(article.article);
      const numDocNotWalailak = {
        scopus_id: scopus_id,
        numDocNotWalailak: numDocInPage - article.article.length,
        link_not_wu: article.linkNotWu,
      };
      createJson(numDocNotWalailak);
      return { status: "fulfilled",article: article.article};
    } else if (numDocInPage !== numAll) {
      console.log("---------------------------------------");
      console.log("Do this loop Scrap Add New Article");
      console.log("---------------------------------------");
      const numNewDoc = numDocInPage - numAll;
      const article = await scrapeArticleData(url.url, page, numNewDoc);
      allArticle.push(article.article);
      updateJson(numNewDoc - article.article.length, scopus_id); // จน.ที่ไม่ได้อยู่เพิ่ม
      return { status: "fulfilled",article: article.article};
    } else {
      console.log("-------------");
      console.log("Skip Loop");
      console.log("-------------");
      return { status: "fulfilled",article: []};
    }
  } catch (error) {
    await scraperArticleScopus();
    console.error("Error occurred while scraping:", error);
  } finally {
    await browser.close();
  }
};


const scraperArticleScopus = async () => {
  try {
    allURLs = await getURLScopus();

    while (roundScraping < allURLs.length) {

      const batchURLs = allURLs.slice(roundScraping, roundScraping + batchSize);
      const batchPromises = batchURLs.map((url,index) => scrapeArticle(url,roundScraping + index));
      const results = await Promise.allSettled(batchPromises);
      console.log("results = ",results)
      if(results.length === batchSize){  
        for (const result of results) {
          if (result.status === "fulfilled") {
            const data = result.value.article;
            await insertArticleDataToDbScopus(data, result.value.article.eid);
          }
          else if (result.status === "rejected") {
            console.error("Error occurred while scraping:", result.reason);
          }
        }
        roundScraping += batchSize;
      }else{
        await scraperAuthorScopus();
      }
    }

    console.log("Finish Scraping Scopus");
    return allArticle;
  } catch (error) {
    console.error("An error occurred:",error);
    await scraperArticleScopus();
    return [];
  }
};