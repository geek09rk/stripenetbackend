const mongoose = require('mongoose');

const InterproSchema = new mongoose.Schema({

    'protein': {type:String},
    'length':{type:Number}, 
    'interpro_id': {type:String},
    'sourcedb': {type:String},
    'domain': {type:String},
    'domain_description': {type:String},
    'score': {type:Number},
    
});

const resultsdb = mongoose.connection.useDb("stripenet")
const InterproWheat = resultsdb.model('wheat_interpros', InterproSchema)
const InterproPstr = resultsdb.model('pstr_interpros', InterproSchema)
const InterproPstr78 = resultsdb.model('pstr78_interpros', InterproSchema)
const InterproPstr130 = resultsdb.model('pstr130_interpros', InterproSchema)

module.exports ={
    'wheat':InterproWheat,
    'pstr':InterproPstr,
    'pstr78':InterproPstr78,
    'pstr130':InterproPstr130,
}