const mongoose = require("mongoose");

const CoresspondingSchema = new mongoose.Schema({
  scopusEID : String,
  corresAuthorID : String,
  correspondingData : Object
},{versionKey: false })

module.exports = mongoose.model('Coressponding', CoresspondingSchema)