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
const { v4: uuidv4 } = require('uuid'); // Import uuid

// In-memory store for download tasks
// Note: For production, consider a more robust store (e.g., Redis)
// Structure: { taskId: { status: 'pending' | 'ready' | 'error', queryParams: object, totalCount: number, error: null | string, timestamp: number } }
let downloadTasks = {};
const desiredOrder = ['pstrs', 'pstr130s', 'pstr78s'];

const wheatSchema = new mongoose.Schema({
  Host_Protein: { type: String },
  Pathogen_Protein: { type: String },
  species: { type: String },
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
  species: { type: String },
  PfamA: { type: String },
  PfamB: { type: String },
  intdb: { type: String },
  DomainA_name: { type: String },
  DomainA_interpro: { type: String },
  DomainB_name: { type: String },
  DomainB_interpro: { type: String },
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
  let results = await getPPI(body.category, body.host, body.pathogen, body.pathogen2, body.hi, body.hc, body.he, body.pi, body.pc, body.pe, body.intdb, body.domdb, body.genes, body.idType)

  res.json(results)
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



// Domain PPIs (Paginated Results)
router.route('/domain_results/').post(async (req, res) => {
  try {
    const body = req.body;
    let page = parseInt(body.page) || 0;
    const size = parseInt(body.size) || 10;
    const limit = size;
    const skip = page * size;

    const resultsdb = mongoose.connection.useDb("stripenet");

    // Determine target collection and build base filter
    let collectionName = '';
    let filter = {};
    const useTwoSpecies = body.species2 && body.species2 !== 'null' && body.species2.trim() !== '';

    // Add genes filter (common to both cases)
    if (body.genes && body.genes.length > 0) {
      const genesArray = Array.isArray(body.genes) ? body.genes : body.genes.split(',').map(g => g.trim()).filter(Boolean);
      if (genesArray.length > 0) {
        let field = (body.idt === 'host') ? 'Host_Protein' : 'Pathogen_Protein';
        filter[field] = { '$in': genesArray };
      }
    }

    // Add intdb filter (common to both cases)
    const intdbs = Array.isArray(body.intdb) ? body.intdb : [body.intdb].filter(Boolean);
    if (intdbs.length > 0) {
      filter['intdb'] = { '$in': intdbs };
    }

    if (useTwoSpecies) {
      // --- Case 1: Two Species --- 
      if (!body.species || !body.species2) {
        return res.status(400).json({ message: "Both species are required for two-species query." });
      }
      // Construct paired collection name (e.g., alphabetically sorted)
      const sorted = [body.species, body.species2].sort((a, b) => {
        return desiredOrder.indexOf(a) - desiredOrder.indexOf(b);
      });
      collectionName = `domain_${sorted[0]}_${sorted[1]}`;
      // Species filter is implicitly handled by the collection choice
    } else {
      // --- Case 2: Single Species --- 
      if (!body.species) {
        return res.status(400).json({ message: "Primary species is required." });
      }
      collectionName = `domain_${body.species}`;
      // No explicit species filter needed if single-species collections only contain that species
      // If single-species collections *might* contain others, add: filter['species'] = body.species;
    }


    // Get the Mongoose model for the dynamically determined collection
    const TargetCollection = resultsdb.model(collectionName, DomainSchema, collectionName);

    // --- Execute Queries --- 

    // Find results for the current page
    let resultsQuery = TargetCollection.find(filter)
      .limit(limit)
      .skip(skip)

    // Only sort if querying a paired collection (two species)
    if (useTwoSpecies) {
      resultsQuery = resultsQuery.sort({ Host_Protein: 1, Pathogen_Protein: 1 })
      // Optional: Hint for sort if needed on paired collections
      // .hint({ Host_Protein: 1, Pathogen_Protein: 1 })
    }

    const resultsPromise = resultsQuery.lean().exec();

    // Get total count 
    const countPromise = TargetCollection.countDocuments(filter);

    // Use aggregate to get distinct Host_Protein values
    const hostAggregatePromise = TargetCollection.aggregate([
      { $match: filter },
      { $group: { _id: "$Host_Protein" } },
    ]); // Hint with just Host_Protein might be best here

    // Use aggregate to get distinct Pathogen_Protein values
    let pathogenAggregatePromise;
    if (useTwoSpecies) {
      pathogenAggregatePromise = new Promise((resolve) => {
        resolve(0);
      })
    } else {
      pathogenAggregatePromise = TargetCollection.aggregate([
        { $match: filter },
        { $group: { _id: "$Pathogen_Protein" } },
      ]).hint({ intdb: 1, Pathogen_Protein: 1 }); // Hint with just Pathogen_Protein might be best here
    }

    // Use index depending on the filter
    let hint;
    if (body.genes && body.genes.length > 0) {
      if (body.idt === 'host') {
        hint = { Host_Protein: 1, intdb: 1, Pathogen_Protein: 1, species: 1 };
      } else {
        hint = { Pathogen_Protein: 1, intdb: 1, species: 1 };
      }
    } else {
      hint = { intdb: 1, Pathogen_Protein: 1, species: 1 };
    }

    let speciesCountPromise;
    if (useTwoSpecies) {
      speciesCountPromise = TargetCollection.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$species",
            proteins: { $addToSet: "$Pathogen_Protein" }
          }
        },
        {
          $project: {
            _id: 1,
            distinctProteins: { $size: "$proteins" }
          }
        }
      ], {
        hint: hint
      })
    } else {
      speciesCountPromise = new Promise((resolve) => {
        resolve(0);
      })
    }

    // Run all operations concurrently
    const [final, totalCount, host_proteins_agg, pathogen_proteins_agg, speciesCount] = await Promise.all([
      resultsPromise,
      countPromise,
      hostAggregatePromise,
      pathogenAggregatePromise,
      speciesCountPromise
    ]);

    for (doc of final) {
      doc['species'] = body.species;
    }

    const host_protein_count = host_proteins_agg.length;
    const pathogen_protein_count = pathogen_proteins_agg.length;
    const speciesCountArray = Object.fromEntries(speciesCount.map(r => [r._id + 's', r.distinctProteins]));

    res.json({
      'results': final,
      'total': totalCount,
      'hostcount': host_protein_count,
      'pathogencount': pathogen_protein_count,
      'speciesCount': speciesCountArray,
    });
  } catch (error) {
    console.error("Error in /domain_results:", error);
    res.status(500).json({ message: "Error processing domain results", error: error.message });
  }
});


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

// --- Download Endpoints with STREAMING ---

// 1. Initiate Non-Domain Download
router.route('/download/init').get(async (req, res) => {
  console.log('NON DOMAIN DOWNLOAD')
  const { results: collectionName } = req.query;
  if (!collectionName) {
    return res.status(400).json({ message: "Collection name ('results' parameter) is required." });
  }

  const taskId = uuidv4();
  // Store query params, initialize status
  downloadTasks[taskId] = { status: 'pending', queryParams: { collectionName }, totalCount: 0, error: null, timestamp: Date.now() };

  try {
    const resultsdb = mongoose.connection.useDb("stripe_results");
    const ResultsModel = resultsdb.model(collectionName, wheatSchema, collectionName);

    // Get total count for progress calculation
    const totalCount = await ResultsModel.countDocuments({});

    downloadTasks[taskId].totalCount = totalCount;
    downloadTasks[taskId].status = 'ready';

    // Respond with taskId and totalCount
    res.json({ taskId, totalCount });

  } catch (error) {
    console.error(`Error processing download task ${taskId}:`, error);
    downloadTasks[taskId].status = 'error';
    downloadTasks[taskId].error = error.message || "An unknown error occurred during download.";

    // Respond with error status if init failed
    res.status(500).json({ message: "Failed to initialize download task.", error: downloadTasks[taskId].error });
  }
});

// 2. Initiate Domain Download
router.route('/domain_download/init').get(async (req, res) => {

  const { species, species2, intdb, genes, idt } = req.query;

  if (!species) {
    return res.status(400).json({ message: "Primary species is required." });
  }

  const taskId = uuidv4();

  // Build filter object (excluding species initially)
  const intdbs = intdb ? (Array.isArray(intdb) ? intdb : intdb.split(',').map(db => db.trim()).filter(Boolean)) : [];
  let filter = {};
  if (intdbs.length > 0) {
    filter['intdb'] = { '$in': intdbs };
  }
  if (genes) {
    const genesArray = Array.isArray(genes) ? genes : genes.split(',').map(g => g.trim()).filter(Boolean);
    if (genesArray.length > 0) {
      const field = (idt === 'host') ? 'Host_Protein' : 'Pathogen_Protein';
      filter[field] = { '$in': genesArray };
    }
  }

  const useTwoSpecies = species2 && species2 !== 'null' && species2.trim() !== '';
  let collectionName = '';

  // Store query params
  downloadTasks[taskId] = {
    status: 'pending',
    queryParams: { species, species2, filter, useTwoSpecies },
    totalCount: 0,
    error: null,
    timestamp: Date.now()
  };

  try {
    const resultsdb = mongoose.connection.useDb("stripenet");
    let totalCount = 0;

    if (!useTwoSpecies) {
      // --- Single Species Case ---
      collectionName = `domain_${species}`;
      const TargetCollection = resultsdb.model(collectionName, DomainSchema, collectionName);
      totalCount = await TargetCollection.countDocuments(filter);
    } else {
      // --- Two Species Case ---
      if (!species2) throw new Error("Both species required");

      const sorted = [species, species2].sort((a, b) => {
        return desiredOrder.indexOf(a) - desiredOrder.indexOf(b);
      });
      collectionName = `domain_${sorted[0]}_${sorted[1]}`;
      const TargetCollection = resultsdb.model(collectionName, DomainSchema, collectionName);
      totalCount = await TargetCollection.countDocuments(filter);
    }

    // Log the final filter object BEFORE saving it to the task
    console.log(`[Task ${taskId}] Filter being stored:`, JSON.stringify(filter));

    // Store necessary parameters for the /data route
    downloadTasks[taskId] = {
      status: 'ready', // Set status *after* successful count
      queryParams: { collectionName, filter }, // Store determined collection name and filter
      totalCount: totalCount,
      error: null,
      timestamp: Date.now()
    };

    downloadTasks[taskId].totalCount = totalCount;
    downloadTasks[taskId].status = 'ready';

    res.json({ taskId, totalCount });

  } catch (error) {
    // Ensure task state reflects error if init fails
    downloadTasks[taskId] = {
      status: 'error',
      queryParams: { collectionName, filter }, // Store potentially partial params
      totalCount: 0,
      error: error.message || "An unknown error occurred during domain download.",
      timestamp: Date.now()
    };
    console.error(`Error processing domain download task ${taskId}:`, error);
    downloadTasks[taskId].status = 'error';
    downloadTasks[taskId].error = error.message || "An unknown error occurred during domain download.";
    res.status(500).json({ message: "Failed to initialize domain download task.", error: downloadTasks[taskId].error });
  }
});

// 3. Get Download Status (Common for both)
router.route('/download/status/:taskId').get((req, res) => {
  const { taskId } = req.params;
  const task = downloadTasks[taskId];

  if (!task) {
    return res.status(404).json({ message: "Task not found." });
  }

  // Return status, error, and total count
  res.json({ status: task.status, error: task.error, totalCount: task.totalCount });
});

// 4. Get Download Data (Common for both) - STREAMING NDJSON
router.route('/download/data/:taskId').get(async (req, res) => {
  const { taskId } = req.params;
  const task = downloadTasks[taskId];
  if (task) delete downloadTasks[taskId];

  if (!task) {
    return res.status(404).json({ message: "Task not found or already completed." });
  }
  if (task.status === 'pending') {
    return res.status(400).json({ message: "Download task is not ready yet." });
  }
  if (task.status === 'error') {
    return res.status(500).json({ message: "Download task failed during initialization.", error: task.error });
  }

  // --- STREAMING NDJSON LOGIC --- 
  try {
    // Determine DB and parameters based on whether filter exists (indicating domain task)
    const isDomainTask = task.queryParams.collectionName.startsWith('domain_');
    const dbName = isDomainTask ? "stripenet" : "stripe_results";
    const resultsdb = mongoose.connection.useDb(dbName);

    console.log(`[Task ${taskId}] Determined DB: ${dbName}`);

    // Extract necessary params for use within the loop if it's a domain task (Not needed anymore)
    // let species = null;
    // let useTwoSpecies = false; 
    // if (isDomainTask) {
    //     species = task.queryParams.species; // Assuming species is stored if needed later
    //     useTwoSpecies = task.queryParams.useTwoSpecies; // Assuming this is stored if needed later
    // }

    // Set headers for streaming NDJSON and suggest filename
    const filename = `download_${taskId}.ndjson`;
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    let cursor;

    // --- Get the appropriate cursor --- 
    console.log(`[Task ${taskId}] Preparing stream. QueryParams:`, task.queryParams);

    if (!isDomainTask) {
      // --- Non-Domain Streaming --- 
      const { collectionName } = task.queryParams;
      console.log(`[Task ${taskId}] Type: Non-Domain. Collection: ${collectionName}`);
      const TargetModel = resultsdb.model(collectionName, wheatSchema, collectionName);
      cursor = TargetModel.find({}).lean().cursor(); // Find all for non-domain
    } else {
      // --- Domain Streaming --- 
      const { collectionName, filter } = task.queryParams; // Get params stored by init
      console.log(`[Task ${taskId}] Type: Domain. Streaming from: ${collectionName}`);
      console.log(`[Task ${taskId}] Filter:`, JSON.stringify(filter));
      const TargetCollection = resultsdb.model(collectionName, DomainSchema, collectionName);
      cursor = TargetCollection.find(filter).lean().cursor(); // Use the filter from queryParams
    }

    // Check cursor validity before starting loop
    if (!cursor) {
      console.log(`[Task ${taskId}] Cursor is null or undefined before loop. Ending stream.`);
      res.write(''); // Send empty response body for NDJSON
      res.end();
      return; // Exit handler
    } else {
      console.log(`[Task ${taskId}] Cursor obtained. Starting stream loop...`);
    }

    // --- Write documents to response stream --- 
    let docCount = 0;
    for await (const doc of cursor) {
      const docToSend = doc; // No need to add species field
      // Write stringified doc + newline
      res.write(JSON.stringify(docToSend) + '\n');
      docCount++;
    }
    console.log(`[Task ${taskId}] Finished streaming loop. Total documents streamed: ${docCount}.`);
    res.end(); // End the response stream when cursor is done

  } catch (error) {
    console.error(`[Task ${taskId}] Error during stream preparation or processing:`, error);
    // Send an error response if headers not already sent
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to start download stream.", error: error.message });
    } else {
      res.end(); // Attempt to close response if stream already started but errored
    }
  }
});

// --- Consensus Results --- 
router.route('/consensus/').post(async (req, res) => {
  try {
    const {
      interologCollectionName,
      species,
      species2,
      intdb,
      genes,
      idt,
    } = req.body;

    // --- Input Validation ---
    if (!interologCollectionName) {
      return res.status(400).json({ message: "Interolog collection name is required." });
    }
    if (!species) {
      return res.status(400).json({ message: "Primary domain species is required." });
    }
    const useTwoSpecies = species2 && species2 !== 'null' && species2.trim() !== '';
    if (useTwoSpecies && !species2) { // Ensure species2 is valid if useTwoSpecies is true
      return res.status(400).json({ message: "Secondary species is required for two-species query." });
    }

    // --- DB Connections ---
    const resultsDB = mongoose.connection.useDb("stripe_results");
    const domainDB = mongoose.connection.useDb("stripenet");

    // --- 1. Generate Unique Output Collection Name ---
    const outputCollectionName = `consensus_${Date.now()}_${uuidv4().substring(0, 8)}`;

    // Get native collection reference to bypass Mongoose schema on insert
    const nativeOutputCollection = resultsDB.db.collection(outputCollectionName);

    // --- 2. Get Interolog Model (for streaming) ---
    const InterologModel = resultsDB.model(interologCollectionName, wheatSchema, interologCollectionName);

    // --- 3. Prepare Domain Query Info ---
    let domainCollectionName = '';
    let domainBaseFilter = {};
    const domainIntdbs = Array.isArray(intdb) ? intdb : [intdb].filter(Boolean);
    if (domainIntdbs.length > 0) {
      domainBaseFilter['intdb'] = { '$in': domainIntdbs };
    }
    if (genes) {
      const genesArray = Array.isArray(genes) ? genes : genes.split(',').map(g => g.trim()).filter(Boolean);
      if (genesArray.length > 0) {
        const field = (idt === 'host') ? 'Host_Protein' : 'Pathogen_Protein';
        domainBaseFilter[field] = { '$in': genesArray };
      }
    }

    if (useTwoSpecies) {
      const sorted = [species, species2].sort((a, b) => {
        return desiredOrder.indexOf(a) - desiredOrder.indexOf(b);
      });
      domainCollectionName = `domain_${sorted[0]}_${sorted[1]}`;
    } else {
      domainCollectionName = `domain_${species}`;
    }
    const DomainModel = domainDB.model(domainCollectionName, DomainSchema, domainCollectionName);

    // Define projection for domain-specific fields
    const domainProjection = {
      _id: 0, // Exclude domain doc's _id
      PfamA: 1,
      PfamB: 1,
      DomainA_name: 1,
      DomainA_interpro: 1,
      DomainB_name: 1,
      DomainB_interpro: 1,
      score: 1,
      intdb: 1 // Get the domain's interaction source
      // Add other unique domain fields if necessary
    };

    // --- 4. Stream Interolog, Check Domain, Batch Insert Consensus --- 

    const BATCH_SIZE = 1000; // How many docs to insert at once
    let consensusBuffer = [];
    let totalConsensusCount = 0;

    const interologCursor = InterologModel.find({}).lean().cursor();

    for await (const interologDoc of interologCursor) {
      try {
        const domainCheckFilter = {
          ...domainBaseFilter, // Apply base domain filters (intdb, genes)
          Host_Protein: interologDoc.Host_Protein, // Match specific pair
          Pathogen_Protein: interologDoc.Pathogen_Protein // Match specific pair
        };

        // Find *one* matching domain document and get specific fields
        const matchingDomainDoc = await DomainModel.findOne(domainCheckFilter, domainProjection).lean().exec();

        if (matchingDomainDoc) {
          // Match found, merge Interolog data with selected Domain data
          const mergedDoc = {
            ...interologDoc,     // Start with all interolog fields
            ...matchingDomainDoc // Add/overwrite with projected domain fields
          };

          // Match found, add to buffer
          consensusBuffer.push(mergedDoc);
          totalConsensusCount++;

          // If buffer is full, insert batch
          if (consensusBuffer.length >= BATCH_SIZE) {
            // Use native insertMany to bypass Mongoose schema validation
            await nativeOutputCollection.insertMany(consensusBuffer, { ordered: false }); // ordered:false might improve performance
            consensusBuffer = []; // Clear buffer
            console.log(`Inserted batch of ${BATCH_SIZE} consensus docs into ${outputCollectionName}`);
          }
        }
      } catch (docError) {
        console.error(`Error processing document check for ${interologDoc._id}:`, docError);
        // Decide whether to skip the doc or halt the process
      }
    }

    // Insert any remaining documents in the buffer
    if (consensusBuffer.length > 0) {
      // Use native insertMany for the final batch
      await nativeOutputCollection.insertMany(consensusBuffer, { ordered: false });
      console.log(`Inserted final batch of ${consensusBuffer.length} consensus docs into ${outputCollectionName}`);
    }

    console.log(`Consensus process complete. Total consensus interactions: ${totalConsensusCount} stored in ${outputCollectionName}`);

    // --- 5. Respond with the new collection name --- 
    res.json({ results: outputCollectionName }); // Respond with the name

  } catch (error) {
    console.error("Error in /consensus_results:", error);
    res.status(500).json({ message: "Error processing consensus results", error: error.message });
  }
});

module.exports = router;