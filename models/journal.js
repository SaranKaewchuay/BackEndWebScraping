const mongoose = require("mongoose");

const JournalSchema = new mongoose.Schema({
    source_id: String,
    journal_name: String,
    scopus_coverage_years: String,
    publisher: String,
    issn: String,
    eissn: String,
    source_type: String,
    subject_area: Array,
    changeJournal: Object,
    cite_source: Array
   
   
},{versionKey: false })

module.exports = mongoose.model('Journal', JournalSchema)