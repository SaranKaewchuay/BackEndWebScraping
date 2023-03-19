const express = require('express')
const mongoose = require('mongoose');

const authors = require('./routes/authors');
const articles = require('./routes/articles');
const scraper = require('./routes/scraper');


const PORT = process.env.PORT || 8080;
const app = express();

mongoose.Promise = global.Promise
mongoose.connect("mongodb+srv://root:1234@db01.uyg1g.mongodb.net/test", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "ScraperDB"
})
    .then(() => console.log('connection successful'))
    .catch((err) => console.error(err))

// app.use(bodyParser.json())
app.use(express.urlencoded({ extended: true }));

app.use('/authors', authors);
app.use('/articles', articles);
app.use('/scraper', scraper);


app.listen(PORT, () => {
    console.log('Start server at port', PORT);
});
