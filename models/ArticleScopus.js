const mongoose = require("mongoose");

const ArticleScopusSchema = new mongoose.Schema({
    eid: String,
    article_name: String,
    source_id:String,
    co_author: Array,
    corresponding: String,
    document_type: String,
    source_type: String,
    issn: String,
    original_language: String,
    publisher: String,
    author_keywords: Array,
    abstract: String,
    url: String,
    author_scopus_id: String
},{versionKey: false })
module.exports = mongoose.model('ArticleScopus', ArticleScopusSchema)