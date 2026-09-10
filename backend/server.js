require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const multer = require('multer');
const path = require('path');
const supabase = require('./supabase');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'az_luxury_fashion_jwt_production_secret_2026';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Trust Render's proxy so rate limiting uses real client IPs, not the proxy IP
app.set('trust proxy', 1);

// 1. Security Headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// 2. CORS and Body Parsing
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// 3. Brute Force & Rate Limiting Protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 auth requests per real IP per 15 min
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000, // 1000 requests per real user IP per 15 min (not shared across all users)
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/admin/login', authLimiter);

// Prevent proxy, carrier NAT, and CDN caching on dynamic API routes
app.use('/api/', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

// 4. Secure File Upload with Multer in Memory for Cloud Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max file size
  fileFilter: (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedExts.includes(ext) && allowedMimes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Security Error: Only image files (.jpg, .jpeg, .png, .webp) are allowed.'));
  }
});

// Helper: Upload file buffer directly to Supabase Storage bucket 'product-images'
async function uploadToSupabaseStorage(file) {
  const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
  const cleanBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `prod_${Date.now()}_${Math.round(Math.random() * 1e6)}_${cleanBase}${ext}`;
  
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(filename, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    console.error('Supabase Storage Upload Error:', error);
    throw new Error('Image upload failed: ' + error.message);
  }

  const { data: publicData } = supabase.storage
    .from('product-images')
    .getPublicUrl(filename);

  return publicData.publicUrl;
}

// 5. Admin Authentication Middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication token required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access only' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid or expired admin session' });
  }
};

// Admin Login Endpoint
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  const adminToken = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ message: 'Authentication successful', token: adminToken });
});

// Setup Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_mock',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'mock_secret'
});

// 1. Get all collections
app.get('/api/collections', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching collections:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Get products (optionally filtered by collection_id, search, min_price, max_price)
app.get('/api/products', async (req, res) => {
  try {
    const { collection_id, search, min_price, max_price, size } = req.query;
    let query = supabase.from('products').select('*');

    if (collection_id) query = query.eq('collection_id', parseInt(collection_id, 10));
    if (search) query = query.ilike('name', `%${search}%`);
    if (min_price) query = query.gte('price', parseFloat(min_price));
    if (max_price) query = query.lte('price', parseFloat(max_price));

    const { data, error } = await query.order('id', { ascending: true });
    if (error) throw error;

    let parsedRows = (data || []).map(r => {
      let images = [];
      if (r.image_url) {
        try {
          const parsed = JSON.parse(r.image_url);
          if (Array.isArray(parsed)) images = parsed;
          else images = [r.image_url];
        } catch (e) {
          images = [r.image_url];
        }
      }
      return {
        ...r,
        image_url: images[0] || r.image_url || '/images/col_daily.png',
        images: images.length > 0 ? images : [r.image_url || '/images/col_daily.png'],
        sizes: typeof r.sizes === 'string' ? JSON.parse(r.sizes || '[]') : (r.sizes || []),
        colors: typeof r.colors === 'string' ? JSON.parse(r.colors || '[]') : (r.colors || []),
        reviews: typeof r.reviews === 'string' ? JSON.parse(r.reviews || '[]') : (r.reviews || [])
      };
    });

    // Optional post-processing filter for size matching within the JSON array
    if (size && size.trim() !== '') {
      parsedRows = parsedRows.filter(p => p.sizes.some(s => s.name === size && s.stock > 0));
    }

    res.json(parsedRows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Admin: Add Product (Multiple images uploaded directly to Supabase Storage)
app.post('/api/admin/products', authenticateAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const { name, description, price, collection_id, sizes, category } = req.body;
    let imageUrls = [];

    const files = req.files || (req.file ? [req.file] : []);
    for (const file of files) {
      const publicUrl = await uploadToSupabaseStorage(file);
      imageUrls.push(publicUrl);
    }

    const image_url = imageUrls.length > 0 ? JSON.stringify(imageUrls) : '';
    
    let sizesArr = [];
    if (sizes) {
      try { sizesArr = JSON.parse(sizes); } 
      catch(e) { sizesArr = sizes.split(',').map(s => ({ name: s.trim(), stock: 10 })); }
    }

    const insertData = {
      name,
      description: description || '',
      price: parseFloat(price) || 0,
      image_url,
      collection_id: collection_id ? parseInt(collection_id, 10) : null,
      sizes: JSON.stringify(sizesArr),
      colors: JSON.stringify(['Default']),
      reviews: JSON.stringify([])
    };

    const { data, error } = await supabase.from('products').insert(insertData).select().single();
    if (error) throw error;

    res.json({ id: data.id, message: "Product added successfully" });
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Admin: Delete Product
app.delete('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ error: err.message });
  }
});

// 5. Admin: Update Product (Multiple images support with Supabase Storage)
app.put('/api/admin/products/:id', authenticateAdmin, upload.array('images', 10), async (req, res) => {
  try {
    const { name, description, price, collection_id, sizes } = req.body;
    let sizesArr = [];
    if (sizes) {
      try { sizesArr = JSON.parse(sizes); } 
      catch(e) { sizesArr = sizes.split(',').map(s => ({ name: s.trim(), stock: 10 })); }
    }

    let updateData = {
      name,
      description: description || '',
      price: parseFloat(price) || 0,
      collection_id: collection_id ? parseInt(collection_id, 10) : null,
      sizes: JSON.stringify(sizesArr)
    };

    const files = req.files || (req.file ? [req.file] : []);
    if (files.length > 0) {
      let imageUrls = [];
      for (const file of files) {
        const publicUrl = await uploadToSupabaseStorage(file);
        imageUrls.push(publicUrl);
      }
      updateData.image_url = JSON.stringify(imageUrls);
    }

    const { error } = await supabase.from('products').update(updateData).eq('id', req.params.id);
    if (error) throw error;

    res.json({ message: "Product updated successfully" });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: err.message });
  }
});

// 6. Submit an inquiry
app.post('/api/inquiries', async (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

    const { data, error } = await supabase
      .from('inquiries')
      .insert({ name, email, phone: phone || '', message: message || '' })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ id: data.id, message: 'Inquiry submitted successfully' });
  } catch (err) {
    console.error('Error submitting inquiry:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper middleware for Single-Device Restriction (Scenario B)
function authenticateUser(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return next();

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'SESSION_TERMINATED', message: 'Session expired. Please log in again.' });
    }

    try {
      const { data: user, error: dbErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.id)
        .single();

      if (dbErr || !user) {
        return res.status(401).json({ error: 'SESSION_TERMINATED', message: 'User account not found.' });
      }

      // Single-Device Enforcement: Compare token's session with current active DB session
      if (user.session_token && decoded.session_token && user.session_token !== decoded.session_token) {
        return res.status(401).json({
          error: 'SESSION_TERMINATED',
          message: 'Your account was logged into from another device. You have been logged out on this device.'
        });
      }

      req.user = decoded;
      next();
    } catch (e) {
      req.user = decoded;
      next();
    }
  });
}

// 7. Register Account (Single-Device Token generated)
app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const session_token = crypto.randomBytes(24).toString('hex');

    // Attempt insert with session_token
    let insertObj = {
      email: email.trim().toLowerCase(),
      password_hash: hashedPassword,
      name: name || null,
      phone: phone || null,
      session_token
    };

    let { data, error } = await supabase.from('users').insert(insertObj).select().single();

    // Fallback if session_token column not yet added in Supabase schema
    if (error && error.message && error.message.includes('session_token')) {
      delete insertObj.session_token;
      const retry = await supabase.from('users').insert(insertObj).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      if (error.code === '23505' || error.message.includes('duplicate key') || error.message.includes('unique')) {
        return res.status(400).json({ error: 'An account with this email already exists. Please login.' });
      }
      return res.status(500).json({ error: error.message });
    }

    const token = jwt.sign({ id: data.id, email: data.email, session_token }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      message: 'Account created successfully',
      user: { id: data.id, email: data.email, name: data.name || 'Valued Client', phone: data.phone || '' },
      token
    });
  } catch (err) {
    console.error('Error during register:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 8. Login (Support Email OR Phone Number + Single-Device Invalidation)
app.post('/api/auth/login', async (req, res) => {
  const { email, identifier, password } = req.body;
  const loginKey = (identifier || email || '').trim().toLowerCase();

  if (!loginKey || !password) {
    return res.status(400).json({ error: 'Email or phone number and password are required' });
  }

  try {
    const { data: users, error: findErr } = await supabase
      .from('users')
      .select('*')
      .or(`email.ilike.${loginKey},phone.eq.${loginKey}`);

    if (findErr || !users || users.length === 0) {
      return res.status(401).json({ error: "Account doesn't exist. Please sign up." });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Incorrect password' });

    // Invalidate all previous device sessions by generating a new session_token
    const session_token = crypto.randomBytes(24).toString('hex');
    try {
      await supabase.from('users').update({ session_token }).eq('id', user.id);
    } catch (e) {
      // Gracefully continue if column not yet added
    }

    const token = jwt.sign({ id: user.id, email: user.email, session_token }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, name: user.name, phone: user.phone, address: user.address },
      token
    });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 9. Verify Active Session (Used for live single-device kickout)
app.get('/api/auth/verify-session', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'NO_TOKEN' });

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) return res.status(401).json({ error: 'SESSION_TERMINATED', message: 'Session expired.' });

    try {
      const { data: user, error: dbErr } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.id)
        .single();

      if (dbErr || !user) return res.status(401).json({ error: 'SESSION_TERMINATED', message: 'User not found.' });

      if (user.session_token && decoded.session_token && user.session_token !== decoded.session_token) {
        return res.status(401).json({
          error: 'SESSION_TERMINATED',
          message: 'Your account was logged into from another device. You have been logged out on this device.'
        });
      }

      res.json({ valid: true, user_id: decoded.id });
    } catch (e) {
      res.json({ valid: true, user_id: decoded.id });
    }
  });
});

// 10. Reset Password
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ error: 'Email and new password required' });

  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const { data, error } = await supabase
      .from('users')
      .update({ password_hash: hashedPassword })
      .ilike('email', email.trim())
      .select();

    if (error) throw error;
    if (!data || data.length === 0) return res.status(404).json({ error: 'Email not found' });
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// 11. Update User Address
app.post('/api/user/address', authenticateUser, async (req, res) => {
  try {
    const { user_id, name, address } = req.body;
    const { error } = await supabase
      .from('users')
      .update({ name, address })
      .eq('id', user_id);

    if (error) throw error;
    res.json({ message: 'Address updated' });
  } catch (err) {
    console.error('Error updating address:', err);
    res.status(500).json({ error: err.message });
  }
});

// 12. Delete User Account
app.delete('/api/user/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.from('requests').delete().eq('user_id', id);
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Account deleted' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: err.message });
  }
});

// 13. Submit Request
app.post('/api/requests', authenticateUser, async (req, res) => {
  try {
    const { user_id, product_id, size, color } = req.body;
    if (!user_id || !product_id) return res.status(400).json({ error: 'Missing data' });

    const { data, error } = await supabase
      .from('requests')
      .insert({ user_id, product_id, size, color, status: 'pending' })
      .select()
      .single();

    if (error) throw error;

    

    res.status(201).json({ id: data.id, message: 'Request submitted successfully' });
  } catch (err) {
    console.error('Error creating request:', err);
    res.status(500).json({ error: err.message });
  }
});

// 14. Delete Request
app.delete('/api/requests/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('requests').delete().eq('id', id);
    if (error) throw error;
    res.json({ message: 'Request deleted' });
  } catch (err) {
    console.error('Error deleting request:', err);
    res.status(500).json({ error: err.message });
  }
});

// 15. Get User Requests
app.get('/api/requests', authenticateUser, async (req, res) => {
  try {
    const { user_id } = req.query;
    const { data: requests, error } = await supabase
      .from('requests')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch product details for these requests
    const productIds = [...new Set((requests || []).map(r => r.product_id).filter(Boolean))];
    let productsMap = {};
    if (productIds.length > 0) {
      const { data: prods } = await supabase
        .from('products')
        .select('id, name, price, image_url')
        .in('id', productIds);
      if (prods) {
        prods.forEach(p => { productsMap[p.id] = p; });
      }
    }

    const parsedRows = (requests || []).map(r => {
      const p = productsMap[r.product_id] || {};
      let primaryImage = p.image_url;
      try {
        if (primaryImage && primaryImage.startsWith('[')) {
          const arr = JSON.parse(primaryImage);
          if (Array.isArray(arr) && arr.length > 0) primaryImage = arr[0];
        }
      } catch (e) {}
      return {
        ...r,
        product_name: p.name || 'Product',
        price: p.price || 0,
        image_url: primaryImage || '/images/col_daily.png'
      };
    });

    res.json(parsedRows);
  } catch (err) {
    console.error('Error fetching user requests:', err);
    res.status(500).json({ error: err.message });
  }
});

// 16. Admin: Get All Requests
app.get('/api/admin/requests', authenticateAdmin, async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const productIds = [...new Set((requests || []).map(r => r.product_id).filter(Boolean))];
    const userIds = [...new Set((requests || []).map(r => r.user_id).filter(Boolean))];

    let productsMap = {};
    let usersMap = {};

    if (productIds.length > 0) {
      const { data: prods } = await supabase.from('products').select('id, name, price, image_url').in('id', productIds);
      if (prods) prods.forEach(p => { productsMap[p.id] = p; });
    }
    if (userIds.length > 0) {
      const { data: us } = await supabase.from('users').select('id, name, email, phone').in('id', userIds);
      if (us) us.forEach(u => { usersMap[u.id] = u; });
    }

    const parsedRows = (requests || []).map(r => {
      const p = productsMap[r.product_id] || {};
      const u = usersMap[r.user_id] || {};
      let primaryImage = p.image_url;
      try {
        if (primaryImage && primaryImage.startsWith('[')) {
          const arr = JSON.parse(primaryImage);
          if (Array.isArray(arr) && arr.length > 0) primaryImage = arr[0];
        }
      } catch (e) {}
      return {
        ...r,
        product_name: p.name || 'Product',
        price: p.price || 0,
        image_url: primaryImage || '/images/col_daily.png',
        user_name: u.name || 'Client',
        user_email: u.email || '',
        user_phone: u.phone || ''
      };
    });

    res.json(parsedRows);
  } catch (err) {
    console.error('Error fetching admin requests:', err);
    res.status(500).json({ error: err.message });
  }
});

// 17. Admin: Approve Request
app.post('/api/requests/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const requestId = req.params.id;
    const { data: reqData, error } = await supabase.from('requests').update({ status: 'available' }).eq('id', requestId).select().single();
    if (error) throw error;
    
    

    res.json({ message: 'Request approved and is now available for payment' });
  } catch (err) {
    console.error('Error approving request:', err);
    res.status(500).json({ error: err.message });
  }
});

// 18. Admin: Decline Request
app.post('/api/requests/:id/decline', authenticateAdmin, async (req, res) => {
  try {
    const requestId = req.params.id;
    const { error } = await supabase.from('requests').update({ status: 'declined' }).eq('id', requestId);
    if (error) throw error;
    res.json({ message: 'Request declined' });
  } catch (err) {
    console.error('Error declining request:', err);
    res.status(500).json({ error: err.message });
  }
});

// 19. Real Razorpay Create Order
app.post('/api/razorpay/create-order', async (req, res) => {
  const { amount } = req.body;
  if (!amount) return res.status(400).json({ error: 'Amount required' });
  
  try {
    const options = {
      amount: Math.round(parseFloat(amount) * 100),
      currency: "INR",
      receipt: "receipt_" + crypto.randomBytes(4).toString('hex')
    };
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 20. Razorpay Verify Payment
app.post('/api/razorpay/verify', async (req, res) => {
  try {
    const { test_mode, req_ids, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (test_mode) {
      if (req_ids) {
        const ids = req_ids.split(',').map(id => parseInt(id, 10)).filter(Boolean);
        if (ids.length > 0) {
          await supabase.from('requests').update({ status: 'paid' }).in('id', ids);
        }
      }
      return res.json({ message: "Test Payment verified successfully" });
    }

    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || 'mock_secret')
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      if (req_ids) {
        const ids = req_ids.split(',').map(id => parseInt(id, 10)).filter(Boolean);
        if (ids.length > 0) {
          const { data: updatedReqs } = await supabase.from('requests').update({ status: 'paid' }).in('id', ids).select();
          
          if (updatedReqs) {
            for (const r of updatedReqs) {
              try {
                // Deduct Inventory
                const { data: p } = await supabase.from('products').select('sizes, name').eq('id', r.product_id).single();
                if (p) {
                  let sizesArr = [];
                  if (typeof p.sizes === 'string') sizesArr = JSON.parse(p.sizes || '[]');
                  else sizesArr = p.sizes || [];
                  
                  let modified = false;
                  sizesArr = sizesArr.map(s => {
                    if (s.name === r.size) {
                      modified = true;
                      return { ...s, stock: Math.max(0, s.stock - 1) };
                    }
                    return s;
                  });
                  if (modified) await supabase.from('products').update({ sizes: JSON.stringify(sizesArr) }).eq('id', r.product_id);
                }
              } catch(e) { console.error('Inventory error on payment', e); }
            }
          }
        }
      }
      res.json({ message: "Payment verified successfully" });
    } else {
      res.status(400).json({ error: "Invalid signature" });
    }
  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: err.message });
  }
});

// 21. Add Review
app.post('/api/products/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const { user, rating, comment } = req.body;
    
    if (!user || !rating || !comment) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const { data: prod, error } = await supabase.from('products').select('reviews').eq('id', id).single();
    if (error || !prod) return res.status(404).json({ error: "Product not found" });

    let reviews = [];
    try {
      reviews = typeof prod.reviews === 'string' ? JSON.parse(prod.reviews) : (prod.reviews || []);
    } catch (e) {}

    reviews.unshift({ user, rating: parseInt(rating, 10), comment });

    await supabase.from('products').update({ reviews: JSON.stringify(reviews) }).eq('id', id);
    res.json({ message: "Review added successfully", reviews });
  } catch (err) {
    console.error('Error adding review:', err);
    res.status(500).json({ error: err.message });
  }
});


// 22. Admin: Analytics Dashboard
app.get('/api/admin/analytics', authenticateAdmin, async (req, res) => {
  try {
    const { data: requests, error: rErr } = await supabase.from('requests').select('*');
    if (rErr) throw rErr;
    
    let totalRevenue = 0;
    let pendingRequests = 0;
    let productCounts = {};
    let monthlyData = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    
    const { data: prods } = await supabase.from('products').select('id, price, name');
    const prodsMap = {};
    if (prods) {
      prods.forEach(p => { prodsMap[p.id] = p; });
    }

    (requests || []).forEach(r => {
      if (r.status === 'pending') pendingRequests++;
      
      const p = prodsMap[r.product_id];
      if (p) {
        if (!productCounts[p.id]) productCounts[p.id] = { id: p.id, name: p.name, count: 0 };
        productCounts[p.id].count++;
        
        if (r.status === 'paid') {
          totalRevenue += p.price || 0;
          const month = new Date(r.created_at).getMonth(); // 0-11
          monthlyData[month] += p.price || 0;
        }
      }
    });

    const topProducts = Object.values(productCounts).sort((a,b) => b.count - a.count).slice(0, 5);

    res.json({
      totalRevenue,
      pendingRequests,
      monthlyData,
      topProducts
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Centralized error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum allowed size is 10MB.' });
    }
    return res.status(400).json({ error: `File upload error: ${err.message}` });
  } else if (err) {
    return res.status(400).json({ error: err.message || 'An unexpected error occurred' });
  }
  next();
});

// --- Production Deployment: Serve Frontend ---
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Direct route for admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/admin.html'));
});

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
