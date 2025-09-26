const { spawn } = require('child_process');

const path = require('path');
const getPPI = (method, host, pathogen, pathogen2, identity, coverage, evalue, pi, pc, pe, intdb, domdb, genes, idType) => {
    let output;
    let getS;

    // console.log("hpinterolog.py", "--method", method, "--blastdb", "wheatblast", "--ppidb", "ppidb", "--host_table", hspecies, "--pathogen_table", pspecies, "--host_identity", parseInt(identity), "--host_coverage", parseInt(coverage) ,"--host_evalue", parseFloat(evalue), "--pathogen_identity", parseInt(pi) ,"--pathogen_coverage", parseInt(pc) ,"--pathogen_evalue", parseFloat(pe) ,"--ppitables", intdb, '--id', idt, '--genes', genes)

    if (genes.length > 0) {
        getS = spawn('/opt/stripenet/stripenetbackend/env/bin/python', ["/opt/stripenet/stripenetbackend/src/introlog/hpinterolog.py", "--method", method, "--blastdb", "wheatblast", "--ppidb", "ppidb", "--host_table", host, "--pathogen_table", pathogen, "--pathogen_table2", pathogen2, "--host_identity", parseInt(identity), "--host_coverage", parseInt(coverage), "--host_evalue", parseFloat(evalue), "--pathogen_identity", parseInt(pi), "--pathogen_coverage", parseInt(pc), "--pathogen_evalue", parseFloat(pe), "--ppitables", intdb, '--domdb', domdb, '--id', idType, '--genes', genes]);
    }
    else {
        getS = spawn('/opt/stripenet/stripenetbackend/env/bin/python', ["/opt/stripenet/stripenetbackend/src/introlog/hpinterolog.py", "--method", method, "--blastdb", "wheatblast", "--ppidb", "ppidb", "--host_table", host, "--pathogen_table", pathogen, "--pathogen_table2", pathogen2, "--host_identity", parseInt(identity), "--host_coverage", parseInt(coverage), "--host_evalue", parseFloat(evalue), "--pathogen_identity", parseInt(pi), "--pathogen_coverage", parseInt(pc), "--pathogen_evalue", parseFloat(pe), "--ppitables", intdb, '--domdb', domdb, '--id', idType]);
    }

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
