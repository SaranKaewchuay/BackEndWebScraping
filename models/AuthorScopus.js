const mongoose = require("mongoose");

const AuthorScopusSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    author_name: String,
    citations: String,
    citations_by: String,
    documents: String,
    h_index: String,
    subject_area: Array,
    citations_graph: Array,
    documents_graph: Array,
    url: String
}, {
    _id: false
})
module.exports = mongoose.model('AuthorScopus', AuthorScopusSchema)