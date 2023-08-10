const mongoose = require("mongoose");

const CoresspondingSchema = new mongoose.Schema({
  scopusEID : String,
  corresAuthorID : Array,
  correspondingData : Array
},{versionKey: false })

module.exports = mongoose.model('Corresponding', CoresspondingSchema)