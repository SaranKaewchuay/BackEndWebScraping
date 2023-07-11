const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const portfinder = require('portfinder');
const cron = require('node-cron');
const axios = require('axios');

const authorsRouter = require('./routes/authors');
const articlesRouter = require('./routes/articles');
const scraperRouter = require('./routes/scraper');
const { getCountRecordInJournal } = require("./qurey/qurey_function");

const app = express();
const databaseURI = 'mongodb://adminwuris:wurisadmin@192.168.75.58:27017/';
const dbName = 'wurisdb';

mongoose.connect(databaseURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  dbName: dbName
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error(err));

app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use('/authors', authorsRouter);
app.use('/articles', articlesRouter);
app.use('/scraper', scraperRouter);





portfinder.getPort((err, port) => {
  if (err) {
    console.error(err);
  } else {
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  }
});
