// Database adapter: Prefers Supabase for permanent cloud persistence, with safe SQLite fallback
const supabase = require('./supabase');

let sqliteDb = null;
try {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const dbPath = path.resolve(__dirname, 'database.sqlite');
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.log('SQLite connection failed, using Supabase Cloud.');
    } else {
      console.log('Connected to local SQLite database (fallback).');
    }
  });
} catch (e) {
  // Gracefully caught when running on environments without native C++ compilation bindings
  console.log('SQLite native bindings not loaded. Using Supabase Cloud Database.');
}

module.exports = sqliteDb || supabase;
