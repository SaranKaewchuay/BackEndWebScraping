const mongoose = require("mongoose");
const AuthorSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    authorName: String,
    department: String,
    subjectArea: Array,
    h_index: String,
    image: String,
})
module.exports = mongoose.model('Author',AuthorSchema)