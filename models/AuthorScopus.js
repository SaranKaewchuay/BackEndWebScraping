const mongoose = require("mongoose");

const AuthorScopusSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    author_scopus_id: String,
    author_name: String,
    citations: String,
    citations_by: String,
    documents: String,
    wu_documents: String,
    h_index: String,
    subject_area: Array,
    citations_graph: Array,
    documents_graph: Array,
    url: String
}, {
    _id: false
},{versionKey: false })
module.exports = mongoose.model('AuthorScopus', AuthorScopusSchema)