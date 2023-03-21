const mongoose = require("mongoose");

const ArticleSchema = new mongoose.Schema({
    articleName: String,
    author: Array,
    releaseDate: String,
    academicJournal: String,
    volume: String,
    no: String,
    page: String,
    publisher: String,
    description: String,
    index: String,
    url: String,
    author_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'authors'
    }

})
module.exports = mongoose.model('Article', ArticleSchema)