const fs = require('fs');
let serverCode = fs.readFileSync('backend/server.js', 'utf8');

const oldAddSizesLogic = `    let sizesArr = [];
    if (sizes) {
      sizesArr = sizes.split(',').map(s => s.trim()).filter(Boolean);
    }`;
const newAddSizesLogic = `    let sizesArr = [];
    if (sizes) {
      try { sizesArr = JSON.parse(sizes); } 
      catch(e) { sizesArr = sizes.split(',').map(s => ({ name: s.trim(), stock: 10 })); }
    }`;

serverCode = serverCode.replace(oldAddSizesLogic, newAddSizesLogic);
serverCode = serverCode.replace(oldAddSizesLogic, newAddSizesLogic);

fs.writeFileSync('backend/server.js', serverCode);
