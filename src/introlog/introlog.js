const { spawn } = require('child_process');

const path = require('path');
const getPPI = (method, hspecies, pspecies,identity, coverage, evalue, pi, pc, pe, intdb,domdb, genes, idt)=>{
let output;
let getS;

// console.log("hpinterolog.py", "--method", method, "--blastdb", "wheatblast", "--ppidb", "ppidb", "--host_table", hspecies, "--pathogen_table", pspecies, "--host_identity", parseInt(identity), "--host_coverage", parseInt(coverage) ,"--host_evalue", parseFloat(evalue), "--pathogen_identity", parseInt(pi) ,"--pathogen_coverage", parseInt(pc) ,"--pathogen_evalue", parseFloat(pe) ,"--ppitables", intdb, '--id', idt, '--genes', genes)

if (genes.length >0){
    // getS = spawn('/opt/miniconda3/envs/ml-gpu/bin/python3', ["/opt/web/wheatbackend/src/introlog/hpinterolog.py", "--method", method, "--blastdb", "wheatblast", "--ppidb", "ppidb", "--host_table", hspecies, "--pathogen_table", pspecies, "--host_identity", parseInt(identity), "--host_coverage", parseInt(coverage) ,"--host_evalue", parseFloat(evalue), "--pathogen_identity", parseInt(pi) ,"--pathogen_coverage", parseInt(pc) ,"--pathogen_evalue", parseFloat(pe) ,"--ppitables", intdb, '--domdb', domdb, '--id', idt, '--genes', genes]);
    getS = spawn('/usr/bin/python3', ["/var/www/html/stripenet/stripenetbackend/src/introlog/hpinterolog.py", "--method", method, "--blastdb", "wheatblast", "--ppidb", "ppidb", "--host_table", hspecies, "--pathogen_table", pspecies, "--host_identity", parseInt(identity), "--host_coverage", parseInt(coverage) ,"--host_evalue", parseFloat(evalue), "--pathogen_identity", parseInt(pi) ,"--pathogen_coverage", parseInt(pc) ,"--pathogen_evalue", parseFloat(pe) ,"--ppitables", intdb, '--domdb', domdb, '--id', idt, '--genes', genes]);

// /opt/miniconda3/envs/mlgpu/bin/
// /opt/web/kbunt/wheatbackend

}
else{
    // getS = spawn('/opt/miniconda3/envs/ml-gpu/bin/python3', ["/opt/web/wheatbackend/src/introlog/hpinterolog.py", "--method", method, "--blastdb", "wheatblast", "--ppidb", "ppidb", "--host_table", hspecies, "--pathogen_table", pspecies, "--host_identity", parseInt(identity), "--host_coverage", parseInt(coverage) ,"--host_evalue", parseFloat(evalue), "--pathogen_identity", parseInt(pi) ,"--pathogen_coverage", parseInt(pc) ,"--pathogen_evalue", parseFloat(pe) ,"--ppitables", intdb,  '--domdb', domdb,]);
    getS = spawn('/usr/bin/python3', ["/var/www/html/stripenet/stripenetbackend/src/introlog/hpinterolog.py", "--method", method, "--blastdb", "wheatblast", "--ppidb", "ppidb", "--host_table", hspecies, "--pathogen_table", pspecies, "--host_identity", parseInt(identity), "--host_coverage", parseInt(coverage) ,"--host_evalue", parseFloat(evalue), "--pathogen_identity", parseInt(pi) ,"--pathogen_coverage", parseInt(pc) ,"--pathogen_evalue", parseFloat(pe) ,"--ppitables", intdb,  '--domdb', domdb,]);
}

// /opt/miniconda3/envs/mlgpu/bin/
// /opt/web/kbunt/wheatbackend

getS.stdout.on('data', (data) => {

    output = data.toString();

    console.log('output was generated: ' + output);
});

getS.stdin.setEncoding = 'utf-8';

getS.stderr.on('data', (data) => {
    
    console.log('error:' + data);
});
return new Promise((res, rej) => {

    getS.stdout.on('end', async function (code) {

    const rid = output.replace(/\n$/, "")
    console.log(rid)
    res(rid)
    })
 });

}

module.exports = getPPI
