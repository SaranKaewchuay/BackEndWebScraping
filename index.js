const express = require('express');
const axios = require("axios");
const cors = require('cors');
const cron = require('node-cron');
const authorsRouter = require('./routes/authors');
const articlesRouter = require('./routes/articles');
const scraperRouter = require('./routes/scraper');
const articlesScopusRouter = require('./routes/articlesScopus');
const authorsScopusRouter = require('./routes/authorsScopus');
const journalRouter = require('./routes/journalScopus');
const conectionDB = require('./routes/connection');
const baseUrl = require('./routes/baseurl')
const corespondingRouter = require('./routes/corresponding')
const timeCron = require('./routes/setcron')
const baseApi = require('./scraper/baseApi')

const connectToMongoDB = require("./qurey/connectToMongoDB");
(async () => {
  await connectToMongoDB();
})();

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.urlencoded({ extended: true }));
app.use(cors()); // Add this line to enable CORS
app.use('/scholar', authorsRouter);
app.use('/scholar', articlesRouter);
app.use('/scopus', authorsScopusRouter);
app.use('/scopus', articlesScopusRouter);
app.use('/scopus', journalRouter);
app.use('/scopus', corespondingRouter);
app.use('/scraper', scraperRouter);
app.use('/conectionDB', conectionDB);
app.use('/baseurl', baseUrl);
app.use('/timecron', timeCron);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const cronFormat = '32 17 * * *'
cron.schedule(cronFormat, async () => {
  try {
    console.log('Running scraper job... At 17:25');
    const scopus = axios.get(`${baseApi}scraper/scraper-scopus-cron`);
    console.log('Scraper Scopus job response:', scopus.data);

    const scholar = axios.get(`${baseApi}scraper/scholar`);
    console.log('Scraper Scholar job response:', scholar.data);
  } catch (error) {
    console.error("Cron job error:", error);
  }
});
