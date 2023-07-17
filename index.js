const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const portfinder = require('portfinder');
const authorsRouter = require('./routes/authors');
const articlesRouter = require('./routes/articles');
const scraperRouter = require('./routes/scraper');
const app = express();
const connectToMongoDB = require("./qurey/connectToMongoDB");

(async () => {
  await connectToMongoDB();
})();

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
