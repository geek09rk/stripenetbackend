const mongoose = require('mongoose');

const EffectorSchema = new mongoose.Schema({

    'protein': {type:String}, 
    'effectorType': {type:String},
    
});

const resultsdb = mongoose.connection.useDb("stripenet")
const EffectorPstr = resultsdb.model('pstr_effectors', EffectorSchema)
const EffectorPstr78 = resultsdb.model('pstr78_effectors', EffectorSchema)
const EffectorPstr130 = resultsdb.model('pstr130_effectors', EffectorSchema)

module.exports ={
    'pstr':EffectorPstr,
    'pstr78':EffectorPstr78,
    'pstr130':EffectorPstr130,
}