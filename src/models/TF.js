const mongoose = require('mongoose');

const TFSchema = new mongoose.Schema({

    'protein': {type:String}, 
    'tfFam': {type:String},
    
});

const resultsdb = mongoose.connection.useDb("stripenet")
const TFAestivums = resultsdb.model('wheat_tfs', TFSchema)

module.exports ={
    'wheat':TFAestivums,   
}