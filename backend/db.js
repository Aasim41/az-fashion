const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    
    db.serialize(() => {
      // Collections Table
      db.run(`CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT
      )`);

      // Products Table (updated with sizes, colors, reviews)
      db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        price TEXT,
        image_url TEXT,
        sizes TEXT,
        colors TEXT,
        reviews TEXT,
        FOREIGN KEY(collection_id) REFERENCES collections(id)
      )`);

      // Users Table (New for Auth and Profile)
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password_hash TEXT,
        name TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Requests Table (New for Availability Flow)
      db.run(`CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        size TEXT,
        color TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(product_id) REFERENCES products(id)
      )`);

      // Inquiries Table
      db.run(`CREATE TABLE IF NOT EXISTS inquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Seed data if empty
      db.get('SELECT COUNT(*) as count FROM collections', (err, row) => {
        if (!err && row.count === 0) {
          const insertCollection = db.prepare('INSERT INTO collections (name, description, image_url) VALUES (?, ?, ?)');
          insertCollection.run('Daily Wear', 'Comfortable, breathable ethnic wear that does not compromise on style.', '/images/col_daily.png');
          insertCollection.run('Party Wear', 'The ultimate expression of Indian heritage and festive luxury.', '/images/col_party.png');
          insertCollection.run('Lucknow Chikankari', 'Exquisite hand-embroidered masterpieces from the heart of Lucknow.', '/images/col_chikankari.png');
          insertCollection.run('Pakistani Suits', 'Elegant cuts and intricate embellishments inspired by classic Pakistani fashion.', '/images/col_pakistani.png');
          insertCollection.finalize();
          console.log('Seeded collections table.');
        }
      });
      
      db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
        if (!err && row.count === 0) {
          const insertProduct = db.prepare('INSERT INTO products (collection_id, name, description, price, image_url, sizes, colors, reviews) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
          
          const defaultSizes = JSON.stringify(['XS', 'S', 'M', 'L', 'XL', 'XXL']);
          const defaultColors = JSON.stringify(['Red', 'Blue', 'Green', 'Gold', 'Black']);
          const defaultReviews = JSON.stringify([
            { user: 'Aisha K.', rating: 5, comment: 'Absolutely gorgeous piece! The fabric quality is amazing.' },
            { user: 'Priya M.', rating: 4, comment: 'Beautiful design, fits perfectly.' }
          ]);

          // Daily Wear (1)
          insertProduct.run(1, 'Indigo Block Print Kurta', 'Breathable cotton kurta with traditional hand block prints.', '8500', '/images/col_daily.png', defaultSizes, defaultColors, defaultReviews);
          insertProduct.run(1, 'Linen Straight Suit', 'Minimalist linen suit set perfect for work or casual outings.', '12000', '/images/col_daily.png', defaultSizes, defaultColors, defaultReviews);
          // Party Wear (2)
          insertProduct.run(2, 'Crimson Party Saree', 'Heavy borders and intricate stonework for grand occasions.', '75000', '/images/col_party.png', '[]', defaultColors, defaultReviews);
          insertProduct.run(2, 'Emerald Velvet Suit', 'Regal velvet suit with heavy zardozi embroidery.', '85000', '/images/col_party.png', defaultSizes, defaultColors, defaultReviews);
          // Lucknow Chikankari (3)
          insertProduct.run(3, 'White Chikankari Anarkali', 'Classic white anarkali with all-over chikankari threadwork.', '25000', '/images/col_chikankari.png', defaultSizes, defaultColors, defaultReviews);
          insertProduct.run(3, 'Pastel Blue Chikankari Kurti', 'Soft georgette kurti with delicate floral chikankari.', '15000', '/images/col_chikankari.png', defaultSizes, defaultColors, defaultReviews);
          // Pakistani Suits (4)
          insertProduct.run(4, 'Lawn Embroidered Suit', 'Premium lawn fabric with heavy thread embroidery and chiffon dupatta.', '18000', '/images/col_pakistani.png', defaultSizes, defaultColors, defaultReviews);
          insertProduct.run(4, 'Bridal Net Suit', 'Heavily embellished net suit with zardosi and sequins.', '55000', '/images/col_pakistani.png', defaultSizes, defaultColors, defaultReviews);
          
          insertProduct.finalize();
          console.log('Seeded products table.');
        }
      });
    });
  }
});

module.exports = db;
