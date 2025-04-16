const mongoose = require('mongoose');

const GOSchema = new mongoose.Schema({

    'protein': {type:String},
    'term':{type:String}, 
    'description': {type:String},
    'definition': {type:String},
    'evidence':{type:String}, 
    'ontology':{type:String},
    
});

const resultsdb = mongoose.connection.useDb("stripenet")
const GOwheat = resultsdb.model('wheat_gos', GOSchema)
const GOpstr = resultsdb.model('pstr_gos', GOSchema)
const GOpstr78 = resultsdb.model('pstr78_gos', GOSchema)
const GOpstr130 = resultsdb.model('pstr130_gos', GOSchema)

module.exports ={
    'wheat':GOwheat,
    'pstr':GOpstr,
    'pstr78':GOpstr78,
    'pstr130':GOpstr130,
}
