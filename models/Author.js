const mongoose = require("mongoose");
const AuthorSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    scholar_id : String,
    author_name: String,
    department: String,
    subject_area: Array,
    documents: String,
    image: String,
    citation_by: {
        table: [{
            citations: {
                all: Number,
                since_2018: Number,
            
            },
            h_index: {
                all: Number,
                since_2018: Number,
              
            },
            i10_index: {
                all: Number,
                since_2018: Number,
              
            }
        }],
        graph: [{
            year: Number,
            citations: Number
        }]
    }
},{
    _id:false,
    versionKey: false 
})
module.exports = mongoose.model('Author',AuthorSchema)