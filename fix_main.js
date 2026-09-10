const fs = require('fs');

let code = fs.readFileSync('frontend/main.js', 'utf8');

// The file is currently mangled around the notification polling area.
// I will just git checkout the file to restore it, and then apply my regex patch cleanly.

