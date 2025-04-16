const mongoose = require('mongoose');

const TransmembSchema = new mongoose.Schema({

    'protein': {type:String}, 
    'geneName': {type:String},
    'length': {type:Number},
    
});

const resultsdb = mongoose.connection.useDb("stripenet")
const TransmembPstr = resultsdb.model('pstr_transmembs', TransmembSchema)
const TransmembPstr78 = resultsdb.model('pstr78_transmembs', TransmembSchema)
const TransmembPstr130 = resultsdb.model('pstr130_transmembs', TransmembSchema)

module.exports ={
    'pstr':TransmembPstr,
    'pstr78':TransmembPstr78,
    'pstr130':TransmembPstr130,
}