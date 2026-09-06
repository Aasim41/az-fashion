const fs = require('fs');
['main.js', 'admin.js'].forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/http:\/\/localhost:3000/g, '');
  fs.writeFileSync(file, content);
});
console.log('Replaced localhost:3000');
