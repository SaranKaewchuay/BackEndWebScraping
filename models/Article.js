const mongoose = require("mongoose");

const ArticleSchema = new mongoose.Schema({
    article_name: String,
    authors: Array,
    publication_date: String,
    conference: String,
    institution: String,
    journal: String,
    volume: String,
    issue: String,
    pages: String,
    publisher: String,
    description: String,
    total_citations:String,
    url: String,
    author_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'authors'
    }

})
module.exports = mongoose.model('Article', ArticleSchema)