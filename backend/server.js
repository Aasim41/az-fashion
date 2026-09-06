require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../frontend/public/images/'))
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, 'prod_' + uniqueSuffix + path.extname(file.originalname))
  }
});
const upload = multer({ storage: storage });

// Removed Nodemailer Configuration

// --- Setup Razorpay ---
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'mock_secret'
});

// Get all collections
app.get('/api/collections', (req, res) => {
  db.all('SELECT * FROM collections', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get products (optionally filtered by collection_id)
app.get('/api/products', (req, res) => {
  const collectionId = req.query.collection_id;
  let query = 'SELECT * FROM products';
  let params = [];

  if (collectionId) {
    query += ' WHERE collection_id = ?';
    params.push(collectionId);
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // Parse JSON fields
    const parsedRows = rows.map(r => ({
      ...r,
      sizes: r.sizes ? JSON.parse(r.sizes) : [],
      colors: r.colors ? JSON.parse(r.colors) : [],
      reviews: r.reviews ? JSON.parse(r.reviews) : []
    }));
    res.json(parsedRows);
  });
});

  // Admin: Add Product
  app.post('/api/admin/products', upload.single('image'), (req, res) => {
    const { name, description, price, collection_id, sizes, category } = req.body;
    const image_url = req.file ? '/images/' + req.file.filename : '';
    
    // Parse sizes (expected comma separated)
    let sizesArr = [];
    if (sizes) {
      sizesArr = sizes.split(',').map(s => s.trim());
    }

    db.run(
      'INSERT INTO products (name, description, price, image_url, collection_id, sizes, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description, parseFloat(price), image_url, collection_id || null, JSON.stringify(sizesArr), category || ''],
      function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: "Product added successfully" });
      }
    );
  });

  // Admin: Delete Product
  app.delete('/api/admin/products/:id', (req, res) => {
    db.run('DELETE FROM products WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Product deleted successfully" });
    });
  });

  // Admin: Update Product
  app.put('/api/admin/products/:id', upload.single('image'), (req, res) => {
    const { name, description, price, collection_id, sizes } = req.body;
    let sizesArr = [];
    if (sizes) {
      sizesArr = sizes.split(',').map(s => s.trim());
    }

    if (req.file) {
      const image_url = '/images/' + req.file.filename;
      db.run(
        'UPDATE products SET name = ?, description = ?, price = ?, image_url = ?, collection_id = ?, sizes = ? WHERE id = ?',
        [name, description, parseFloat(price), image_url, collection_id || null, JSON.stringify(sizesArr), req.params.id],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "Product updated successfully" });
        }
      );
    } else {
      db.run(
        'UPDATE products SET name = ?, description = ?, price = ?, collection_id = ?, sizes = ? WHERE id = ?',
        [name, description, parseFloat(price), collection_id || null, JSON.stringify(sizesArr), req.params.id],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "Product updated successfully" });
        }
      );
    }
  });

// Submit an inquiry
app.post('/api/inquiries', (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  db.run('INSERT INTO inquiries (name, email, phone, message) VALUES (?, ?, ?, ?)', [name, email, phone, message], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Inquiry submitted successfully' });
  });
});

// --- NEW E-COMMERCE APIS ---

// 1. Register Account
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    db.run('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)', [email, hashedPassword, name || null], function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      const token = jwt.sign({ id: this.lastID, email }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
      res.status(201).json({ message: 'Account created successfully', user: { id: this.lastID, email }, token });
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: "Account doesn't exist. Please sign up." });
    
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Incorrect password' });
    
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
    res.json({ message: 'Login successful', user: { id: user.id, email: user.email, name: user.name, address: user.address }, token });
  });
});

// 2.5 Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ error: 'Email and new password required' });

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    db.run('UPDATE users SET password_hash = ? WHERE email = ?', [hashedPassword, email], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Email not found' });
      res.json({ message: 'Password reset successfully' });
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. Update User Address
app.post('/api/user/address', (req, res) => {
  const { user_id, name, address } = req.body;
  db.run('UPDATE users SET name = ?, address = ? WHERE id = ?', [name, address, user_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Address updated' });
  });
});

// 3.5 Delete User Account
app.delete('/api/user/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM users WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run('DELETE FROM requests WHERE user_id = ?', [id]); // cleanup requests
    res.json({ message: 'Account deleted' });
  });
});

// 4. Submit Request
app.post('/api/requests', (req, res) => {
  const { user_id, product_id, size, color } = req.body;
  if (!user_id || !product_id) return res.status(400).json({ error: 'Missing data' });

  db.run('INSERT INTO requests (user_id, product_id, size, color) VALUES (?, ?, ?, ?)', [user_id, product_id, size, color], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Request submitted successfully' });
  });
});

// 4.5 Delete Request
app.delete('/api/requests/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM requests WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Request deleted' });
  });
});

// 5. Get User Requests
app.get('/api/requests', (req, res) => {
  const { user_id } = req.query;
  const query = `
    SELECT r.*, p.name as product_name, p.price, p.image_url 
    FROM requests r 
    JOIN products p ON r.product_id = p.id 
    WHERE r.user_id = ? 
    ORDER BY r.created_at DESC
  `;
  db.all(query, [user_id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

  // 6. Admin: Get All Requests
  app.get('/api/admin/requests', (req, res) => {
    const query = `
      SELECT r.*, p.name as product_name, p.price, p.image_url, u.name as user_name, u.email as user_email
      FROM requests r 
      JOIN products p ON r.product_id = p.id 
      JOIN users u ON r.user_id = u.id
      ORDER BY r.created_at DESC
    `;
    db.all(query, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  // 6.1 Admin: Approve Request
  app.post('/api/requests/:id/approve', (req, res) => {
    const requestId = req.params.id;
    db.run('UPDATE requests SET status = ? WHERE id = ?', ['available', requestId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Request approved and is now available for payment' });
    });
  });
  
  // 6.2 Admin: Decline Request
  app.post('/api/requests/:id/decline', (req, res) => {
    const requestId = req.params.id;
    db.run('UPDATE requests SET status = ? WHERE id = ?', ['declined', requestId], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Request declined' });
    });
  });

// 7. Real Razorpay Create Order
app.post('/api/razorpay/create-order', async (req, res) => {
  const { amount } = req.body; // amount in INR
  if (!amount) return res.status(400).json({ error: 'Amount required' });
  
  try {
    const options = {
      amount: amount * 100, // amount in smallest currency unit (paise)
      currency: "INR",
      receipt: "receipt_" + crypto.randomBytes(4).toString('hex')
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Razorpay Verify Payment
app.post('/api/razorpay/verify', (req, res) => {
  const { test_mode, req_ids, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (test_mode) {
    if (req_ids) {
      const ids = req_ids.split(',').map(id => parseInt(id, 10));
      ids.forEach(id => {
        db.run('UPDATE requests SET status = ? WHERE id = ?', ['paid', id]);
      });
    }
    return res.json({ message: "Test Payment verified successfully" });
  }

  const sign = razorpay_order_id + "|" + razorpay_payment_id;
  const expectedSign = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'mock_secret')
    .update(sign.toString())
    .digest("hex");

  if (razorpay_signature === expectedSign) {
    res.json({ message: "Payment verified successfully" });
  } else {
    res.status(400).json({ error: "Invalid signature" });
  }
});

// 9. Add Review
app.post('/api/products/:id/reviews', (req, res) => {
  const { id } = req.params;
  const { user, rating, comment } = req.body;
  
  if (!user || !rating || !comment) {
    return res.status(400).json({ error: "All fields are required" });
  }

  db.get('SELECT reviews FROM products WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: "Product not found" });

    let reviews = [];
    try { reviews = JSON.parse(row.reviews); } catch(e){}
    
    reviews.unshift({ user, rating: parseInt(rating), comment });

    db.run('UPDATE products SET reviews = ? WHERE id = ?', [JSON.stringify(reviews), id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Review added successfully", reviews });
    });
  });
});

// --- Production Deployment: Serve Frontend ---
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use(express.static(path.join(__dirname, '../frontend/public')));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
