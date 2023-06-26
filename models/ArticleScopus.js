const mongoose = require("mongoose");

const ArticleScopusSchema = new mongoose.Schema({
    article_name: String,
    co_author: Array,
    document_type: String,
    source_type: String,
    issn: String,
    original_language: String,
    publisher: String,
    E_ISSN: String,
    subject_area: Array,
    author_keywords: Array,
    abstract: String,
    url: String,
    author_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Author' // Reference to the 'Author' model
    }
})
module.exports = mongoose.model('ArticleScopus', ArticleScopusSchema)