const mongoose = require("mongoose");

const ArticleScopusSchema = new mongoose.Schema({
    eid: String,
    article_name: String,
    source_id:String,
    first_author: String,
    co_author: Array,
    co_author_department: Array,
    volume: String,
    issue: String,
    pages: String,
    document_type: String,
    source_type: String,
    issn: String,
    original_language: String,
    publisher: String,
    abstract: String,
    url: String,
    author_scopus_id: String
},{versionKey: false })
module.exports = mongoose.model('ArticleScopus', ArticleScopusSchema)