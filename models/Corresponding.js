const mongoose = require("mongoose");

const CoresspondingSchema = new mongoose.Schema({
  scopusEID : String,
  corresAuthorID : String,
  correspondingData : Array
},{versionKey: false })

module.exports = mongoose.model('Corresponding', CoresspondingSchema)