const mongoose = require('mongoose');

const LocalSchema = new mongoose.Schema({

    'protein': {type:String}, 
    'location': {type:String},
    
});

const resultsdb = mongoose.connection.useDb("stripenet")
const LocalWheat = resultsdb.model('wheat_localizations', LocalSchema)
const LocalPstr = resultsdb.model('pstr_localizations', LocalSchema)
const LocalPstr78 = resultsdb.model('pstr78_localizations', LocalSchema)
const LocalPstr130 = resultsdb.model('pstr130_localizations', LocalSchema)

module.exports ={
    'wheat':LocalWheat,
    'pstr':LocalPstr,
    'pstr78':LocalPstr78,
    'pstr130':LocalPstr130,
}