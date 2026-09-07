const fs = require('fs');

let code = fs.readFileSync('server.js', 'utf8');

// 1. Add Nodemailer
code = code.replace(/const path = require\('path'\);/, "const path = require('path');\nconst nodemailer = require('nodemailer');");

// Add Mailer setup
const mailerCode = `
// Nodemailer Setup
let transporter;
async function setupMailer() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    console.log('Real Email Transporter configured.');
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass }
      });
      console.log('Mock Email Transporter configured (Ethereal).');
    } catch (e) {
      console.error('Failed to setup mock mailer', e);
    }
  }
}
setupMailer();

async function sendEmail(to, subject, html) {
  if (!transporter) return;
  try {
    const info = await transporter.sendMail({
      from: '"AZ Fashion" <noreply@azfashion.com>',
      to,
      subject,
      html
    });
    console.log('Email sent: %s', info.messageId);
    if (!process.env.EMAIL_USER) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
  } catch (err) {
    console.error('Email Error:', err);
  }
}
`;

code = code.replace(/const app = express\(\);/, mailerCode + '\nconst app = express();');

// 2. Update GET /api/products for filters
const oldGetProducts = `// 2. Get products (optionally filtered by collection_id)
app.get('/api/products', async (req, res) => {
  try {
    const collectionId = req.query.collection_id;
    let query = supabase.from('products').select('*');

    if (collectionId) {
      query = query.eq('collection_id', parseInt(collectionId, 10));
    }

    const { data, error } = await query.order('id', { ascending: true });
    if (error) throw error;

    const parsedRows = (data || []).map(r => {
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

    res.json(parsedRows);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: err.message });
  }
});`;

const newGetProducts = `// 2. Get products (optionally filtered by collection_id, search, min_price, max_price)
app.get('/api/products', async (req, res) => {
  try {
    const { collection_id, search, min_price, max_price, size } = req.query;
    let query = supabase.from('products').select('*');

    if (collection_id) query = query.eq('collection_id', parseInt(collection_id, 10));
    if (search) query = query.ilike('name', \`%\${search}%\`);
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
});`;
code = code.replace(oldGetProducts, newGetProducts);

// 3. Update POST /api/requests to send email
const oldPostReq = `    const { data, error } = await supabase
      .from('requests')
      .insert({ user_id, product_id, size, color, status: 'pending' })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ id: data.id, message: 'Request submitted successfully' });`;
const newPostReq = `    const { data, error } = await supabase
      .from('requests')
      .insert({ user_id, product_id, size, color, status: 'pending' })
      .select()
      .single();

    if (error) throw error;

    // Send Email
    try {
      const { data: u } = await supabase.from('users').select('email').eq('id', user_id).single();
      const { data: p } = await supabase.from('products').select('name').eq('id', product_id).single();
      if (u && p) {
        sendEmail(u.email, 'Request Received - AZ Fashion', \`
          <h1>Thank you for your request!</h1>
          <p>We have received your request for <strong>\${p.name}</strong> (Size: \${size}).</p>
          <p>Our team is reviewing the availability. We will notify you once approved so you can proceed with payment.</p>
        \`);
      }
    } catch(e) {}

    res.status(201).json({ id: data.id, message: 'Request submitted successfully' });`;
code = code.replace(oldPostReq, newPostReq);

// 4. Update POST /api/requests/:id/approve to send email
const oldApprove = `    const { error } = await supabase.from('requests').update({ status: 'available' }).eq('id', requestId);
    if (error) throw error;
    res.json({ message: 'Request approved and is now available for payment' });`;
const newApprove = `    const { data: reqData, error } = await supabase.from('requests').update({ status: 'available' }).eq('id', requestId).select().single();
    if (error) throw error;
    
    try {
      const { data: u } = await supabase.from('users').select('email').eq('id', reqData.user_id).single();
      const { data: p } = await supabase.from('products').select('name').eq('id', reqData.product_id).single();
      if (u && p) {
        sendEmail(u.email, 'Request Approved! - AZ Fashion', \`
          <h1>Great news!</h1>
          <p>Your request for <strong>\${p.name}</strong> (Size: \${reqData.size}) has been approved!</p>
          <p>Please log in to your account and complete your payment to confirm your order.</p>
        \`);
      }
    } catch(e) {}

    res.json({ message: 'Request approved and is now available for payment' });`;
code = code.replace(oldApprove, newApprove);

// 5. Update Razorpay verify to deduct inventory AND send email
const oldVerify = `    if (razorpay_signature === expectedSign) {
      if (req_ids) {
        const ids = req_ids.split(',').map(id => parseInt(id, 10)).filter(Boolean);
        if (ids.length > 0) {
          await supabase.from('requests').update({ status: 'paid' }).in('id', ids);
        }
      }
      res.json({ message: "Payment verified successfully" });`;
const newVerify = `    if (razorpay_signature === expectedSign) {
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
                  
                  // Send Email
                  const { data: u } = await supabase.from('users').select('email').eq('id', r.user_id).single();
                  if (u) {
                    sendEmail(u.email, 'Payment Receipt - AZ Fashion', \`
                      <h1>Payment Successful</h1>
                      <p>Thank you for your purchase of <strong>\${p.name}</strong> (Size: \${r.size}).</p>
                      <p>Your order is now being processed.</p>
                    \`);
                  }
                }
              } catch(e) { console.error('Inventory/Email error on payment', e); }
            }
          }
        }
      }
      res.json({ message: "Payment verified successfully" });`;
code = code.replace(oldVerify, newVerify);

// 6. Add Analytics endpoint
const analyticsEndpoint = `
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
`;

code = code.replace(/\/\/ Centralized error handling/, analyticsEndpoint + '\n// Centralized error handling');

fs.writeFileSync('server.js', code);
