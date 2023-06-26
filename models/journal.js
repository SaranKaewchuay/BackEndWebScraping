const mongoose = require("mongoose");

const JournalSchema = new mongoose.Schema({
    _id: String,
    source_id: String,
    journal_name: String,
    scopus_coverage_years: String,
    publisher: String,
    issn: String,
    eissn: String,
    source_type: String,
    subject_area: Array,
    cite_source: Array
   
})

module.exports = mongoose.model('Journal', JournalSchema)