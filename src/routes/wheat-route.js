const express = require('express');
const router = express.Router();
const getPPI = require("../introlog/introlog");
const GO = require("../models/GO");
const KEGG = require("../models/KEGG");
const Interpro = require("../models/Interpro");
const Local = require("../models/Local");
const TF = require("../models/TF");
const Effectors = require("../models/Effectors");
const Secretory = require("../models/Secretory");
const Transmemb = require("../models/Transmemb");
const mongoose = require('mongoose');

const wheatSchema = new mongoose.Schema({
  Host_Protein: { type: String },
  Pathogen_Protein: { type: String },
  ProteinA: { type: String },
  ProteinB: { type: String },
  intdb: { type: String },
  Method: { type: String },
  Type: { type: String },
  Confidence: { type: String },
  PMID: { type: String },
});

const DomainSchema = new mongoose.Schema({
  Host_Protein: { type: String },
  Pathogen_Protein: { type: String },
  ProteinA: { type: String },
  ProteinB: { type: String },
  intdb: { type: String },
  DomianA_name: { type: String },
  DomianA_interpro: { type: String },
  DomianB_name: { type: String },
  DomianB_interpro: { type: String },
  score: { type: Number },
});

function getItems(input) {
  var arr = input, obj = {};
  for (var i = 0; i < arr.length; i++) {
    if (!obj[arr[i].name]) {
      obj[arr[i].name] = 1;
    } else if (obj[arr[i].name]) {
      obj[arr[i].name] += 1;
    }
  }
  return obj;
}


// Fetch interactions
router.route('/ppi').post(async (req, res) => {
  const body = JSON.parse(JSON.stringify(req.body));
  console.log(body.intdb);
  let results = await getPPI(body.category, body.hspecies, body.pspecies, body.hi, body.hc, body.he, body.pi, body.pc, body.pe, body.intdb, body.domdb, body.genes, body.ids)

  res.json(results)
  console.log(results)
});


// Interolog PPIs
router.route('/results/').get(async (req, res) => {
  let { results, page, size } = req.query
  if (!page) {
    page = 1
  }
  if (page) {
    page = parseInt(page) + 1
  }
  if (!size) {
    size = 1000
  }

  const limit = parseInt(size)
  const skip = (page - 1) * size;
  const resultsdb = mongoose.connection.useDb("stripe_results")
  const Results = resultsdb.model(results, wheatSchema)

  let final = await Results.find({}).limit(limit).skip(skip).exec()
  let counts = await Results.count()
  let host_protein = await Results.distinct("Host_Protein")
  let pathogen_protein = await Results.distinct('Pathogen_Protein')

  res.json({ 'results': final, 'total': counts, 'hostcount': host_protein.length, 'pathogencount': pathogen_protein.length })
})


// Download interactions
router.route('/download/').get(async (req, res) => {
  let { results } = req.query

  const resultsdb = mongoose.connection.useDb("stripe_results")
  const Results = resultsdb.model(results, wheatSchema)

  let final = await Results.find({})
  res.json({ 'results': final })
})


// Download domain PPIs
router.route('/domain_download/').get(async (req, res) => {
  let { species, intdb } = req.query

  const table = 'domain_' + intdb.toLowerCase() + '_' + species
  console.log(table)
  const resultsdb = mongoose.connection.useDb("stripenet")
  const Results = resultsdb.model(table, DomainSchema)

  let final = await Results.find({})
  res.json({ 'results': final })
})


// Domain PPIs
router.route('/domain_results/').post(async (req, res) => {

  const body = JSON.parse(JSON.stringify(req.body));

  // let {species,page, size, genes,idt, intdb} = req.query
  let page;
  let size;
  if (!body.page) {
    page = 1
  }
  if (body.page) {
    page = parseInt(body.page) + 1
  }
  if (!body.size) {
    size = 10
  }

  const table = 'domain_' + body.species
  console.log(table)
  const limit = parseInt(body.size)
  const skip = (page - 1) * body.size;
  const resultsdb = mongoose.connection.useDb("stripenet")
  const Results = resultsdb.model(table, DomainSchema)

  let final;
  let counts;
  let host_protein;
  let pathogen_protein;

  console.log(body.intdb)
  console.log(body.genes)
  if (body.genes.length > 0) {
    if (body.idt === 'host') {
      final = await Results.find({ 'Host_Protein': { '$in': body.genes } }).limit(limit).skip(skip).exec()
      counts = await Results.count({ 'Host_Protein': { '$in': body.genes } })
      host_protein = await Results.distinct("Host_Protein")
      pathogen_protein = await Results.distinct('Pathogen_Protein')
    }
    if (body.idt === 'pathogen') {
      console.log("yes")
      final = await Results.find({ 'Pathogen_Protein': { '$in': body.genes } }).limit(limit).skip(skip).exec()
      counts = await Results.count({ 'Pathogen_Protein': { '$in': body.genes } })
      let fd = await Results.find({ 'Pathogen_Protein': { '$in': body.genes } })
      // host_protein =await Results.distinct("Host_Protein")
      // pathogen_protein =await Results.distinct('Pathogen_Protein')
      host_protein = [... new Set(fd.map(data => data.Host_Protein))]
      pathogen_protein = [... new Set(fd.map(data => data.Pathogen_Protein))]
    }
  }

  if (body.genes.length === 0) {
    final = await Results.find({ 'intdb': { '$in': body.intdb } }).limit(limit).skip(skip).exec()
    counts = await Results.count()
    host_protein = await Results.distinct("Host_Protein")
    pathogen_protein = await Results.distinct('Pathogen_Protein')
  }

  res.json({ 'results': final, 'total': counts, 'hostcount': host_protein.length, 'pathogencount': pathogen_protein.length })
})


// Network
router.route('/network/').get(async (req, res) => {
  let { results } = req.query

  const resultsdb = mongoose.connection.useDb("stripe_results")
  const Results = resultsdb.model(results, wheatSchema)

  let final = await Results.find().exec()
  let counts = await Results.count()
  let host_protein = await Results.distinct("Host_Protein")
  let pathogen_protein = await Results.distinct('Pathogen_Protein')

  res.json({ 'results': final, 'total': counts, 'hostcount': host_protein.length, 'pathogencount': pathogen_protein.length })
})


// Gene ontology
router.route('/go/').get(async (req, res) => {

  let { species, page, size } = req.query
  if (!page) {
    page = 1
  }
  if (page) {
    page = parseInt(page) + 1
  }
  if (!size) {
    size = 10
  }

  const limit = parseInt(size)
  const skip = (page - 1) * size;

  let go_results = await GO[species].find().limit(limit).skip(skip).exec()
  let total = await GO[species].count()
  let knum = await GO[species].distinct('term')
  console.log(knum.length)
  
  res.json({ 'data': go_results, 'total': total })
})


// KEGG
router.route('/kegg/').get(async (req, res) => {

  let { species, page, size } = req.query
  if (!page) {
    page = 1
  }
  if (page) {
    page = parseInt(page) + 1
  }
  if (!size) {
    size = 10
  }

  const limit = parseInt(size)
  const skip = (page - 1) * size;

  let kegg_results = await KEGG[species].find().limit(limit).skip(skip).exec()
  let total = await KEGG[species].count()

  res.json({ 'data': kegg_results, 'total': total })
})


// Interpro
router.route('/interpro/').get(async (req, res) => {

  let { species, page, size } = req.query
  if (!page) {
    page = 1
  }
  if (page) {
    page = parseInt(page) + 1
  }
  if (!size) {
    size = 10
  }

  const limit = parseInt(size)
  const skip = (page - 1) * size;

  let interpro_results = await Interpro[species].find().limit(limit).skip(skip).exec()
  let total = await Interpro[species].count()

  res.json({ 'data': interpro_results, 'total': total })
})


// Localization
router.route('/local/').get(async (req, res) => {

  let { species, page, size } = req.query
  if (!page) {
    page = 1
  }
  if (page) {
    page = parseInt(page) + 1
  }
  if (!size) {
    size = 10
  }

  const limit = parseInt(size)
  const skip = (page - 1) * size;

  let local_results = await Local[species].find().limit(limit).skip(skip).exec()
  let total = await Local[species].count()

  res.json({ 'data': local_results, 'total': total })
})


// Effectors
router.route('/effectors/').get(async (req, res) => {

  let { species, page, size } = req.query
  if (!page) {
    page = 1
  }
  if (page) {
    page = parseInt(page) + 1
  }
  if (!size) {
    size = 10
  }

  const limit = parseInt(size)
  const skip = (page - 1) * size;

  let effectors_results = await Effectors[species].find().limit(limit).skip(skip).exec()
  let total = await Effectors[species].count()

  res.json({ 'data': effectors_results, 'total': total })
})


// Secretory
router.route('/secretory/').get(async (req, res) => {

  let { species, page, size } = req.query
  if (!page) {
    page = 1
  }
  if (page) {
    page = parseInt(page) + 1
  }
  if (!size) {
    size = 10
  }

  const limit = parseInt(size)
  const skip = (page - 1) * size;

  let secretory_results = await Secretory[species].find().limit(limit).skip(skip).exec()
  let total = await Secretory[species].count()

  res.json({ 'data': secretory_results, 'total': total })
})


// Transmembrane proteins
router.route('/transmemb/').get(async (req, res) => {

  let { species, page, size } = req.query
  if (!page) {
    page = 1
  }
  if (page) {
    page = parseInt(page) + 1
  }
  if (!size) {
    size = 10
  }

  const limit = parseInt(size)
  const skip = (page - 1) * size;

  let transmemb_results = await Transmemb[species].find().limit(limit).skip(skip).exec()
  let total = await Transmemb[species].count()

  res.json({ 'data': transmemb_results, 'total': total })
})


// Transcription factors
router.route('/tf/').get(async (req, res) => {

  let { species, page, size } = req.query
  if (!page) {
    page = 1
  }
  if (page) {
    page = parseInt(page) + 1
  }
  if (!size) {
    size = 10
  }

  const limit = parseInt(size)
  const skip = (page - 1) * size;

  let tf_results = await TF[species].find().limit(limit).skip(skip).exec()
  let total = await TF[species].count()

  res.json({ 'data': tf_results, 'total': total })
})


// Annotations (from predicted PPIs)
router.route('/annotation/').get(async (req, res) => {

  try {
    console.log(req.query);

    // let species = 'human'
    let { species, gene } = req.query
    let go_results = await GO[species].find({ 'gene': gene })
    let kegg_results = await KEGG[species].find({ 'gene': gene })
    let interpro_results = await Interpro[species].find({ 'gene': gene })
    let local_results = await Local[species].find({ 'gene': gene })
    let drugs_results = await Drugs[species].find({ 'protein_id': gene })

    console.log(go_results)

    // Filter out duplicate JSON objects
    hgo_results = filterDuplicates(go_results);
    hkegg_results = filterDuplicates(kegg_results);
    hinterpro_results = filterDuplicates(interpro_results);
    hlocal_results = filterDuplicates(local_results);
    hdrugs_results = filterDuplicates(drugs_results);

    res.json({
      'hgo': hgo_results,
      'hkegg': hkegg_results,
      'hinter': hinterpro_results,
      'hlocal': hlocal_results,
      'hdrugs': hdrugs_results,
    });
  } catch (error) {
    // Handle errors
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
})


function areObjectsEqual(obj1, obj2) {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) {
      return false;
    }
  }

  return true;
}


function filterDuplicates(results) {
  const uniqueResults = [];

  for (const result of results) {
    let isDuplicate = false;
    for (const uniqueResult of uniqueResults) {
      if (areObjectsEqual(result, uniqueResult)) {
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) {
      uniqueResults.push(result);
    }
  }

  return uniqueResults;
}

module.exports = router;