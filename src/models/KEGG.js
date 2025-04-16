const mongoose = require('mongoose');

const KEGGSchema = new mongoose.Schema({

    'protein': {type:String},
    'pathway':{type:String}, 
    'description': {type:String},
    
});

const resultsdb = mongoose.connection.useDb("stripenet")
const KEGGWheat = resultsdb.model('wheat_keggs', KEGGSchema)

module.exports ={
    'wheat': KEGGWheat,
}