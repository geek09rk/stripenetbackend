const mongoose = require('mongoose');

const SecretorySchema = new mongoose.Schema({

    'protein': {type:String}, 
    'geneName': {type:String},
    'length': {type:Number},
    
});

const resultsdb = mongoose.connection.useDb("stripenet")
const SecretoryPstr = resultsdb.model('pstr_secretorys', SecretorySchema)
const SecretoryPstr78 = resultsdb.model('pstr78_secretorys', SecretorySchema)
const SecretoryPstr130 = resultsdb.model('pstr130_secretorys', SecretorySchema)

module.exports ={
    'pstr':SecretoryPstr,
    'pstr78':SecretoryPstr78,
    'pstr130':SecretoryPstr130,
}