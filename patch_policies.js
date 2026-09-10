const fs = require('fs');

// --- 1. PATCH SERVER.JS (24-Hour Expiry Logic) ---
let server = fs.readFileSync('backend/server.js', 'utf8');

// Patch Appove to include timestamp
const approveRegex = /app\.post\('\/api\/requests\/:id\/approve'[\s\S]*?res\.json\(\{ message: 'Request approved and is now available for payment' \}\);\s*\} catch \(err\) \{/g;
const approveReplacement = `app.post('/api/requests/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const requestId = req.params.id;
    const { data: reqData, error: fetchErr } = await supabase.from('requests').select('color').eq('id', requestId).single();
    if (fetchErr) throw fetchErr;
    
    let baseColor = (reqData.color || '').split(' | Approved:')[0];
    const newColor = \`\${baseColor} | Approved:\${Date.now()}\`;

    const { error } = await supabase.from('requests').update({ status: 'available', color: newColor }).eq('id', requestId);
    if (error) throw error;
    res.json({ message: 'Request approved and is now available for payment' });
  } catch (err) {`;
if(server.match(approveRegex)) {
  server = server.replace(approveRegex, approveReplacement);
}

// Function to inject expiry logic into GET requests
const expiryLogic = `
    // AUTO-EXPIRY LOGIC (24 Hours)
    const now = Date.now();
    const expiryTime = 24 * 60 * 60 * 1000;
    
    for (let r of data) {
      if (r.status === 'available') {
        let approvalTime = new Date(r.created_at).getTime();
        if (r.color && r.color.includes(' | Approved:')) {
          approvalTime = parseInt(r.color.split(' | Approved:')[1], 10);
        }
        if (now - approvalTime > expiryTime) {
          r.status = 'declined'; // visually update for client instantly
          // Background async DB update
          supabase.from('requests').update({ status: 'declined' }).eq('id', r.id).then();
        }
      }
    }
`;

// Patch User GET /api/requests
const userGetRegex = /app\.get\('\/api\/requests'[\s\S]*?const \{ data, error \} = await supabase\.from\('requests'\)\.select\('\*'\)\.eq\('user_id', userId\)\.order\('created_at', \{ ascending: false \}\);\s*if \(error\) throw error;/;
if(server.match(userGetRegex)) {
  const userGetReplacement = `app.get('/api/requests', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase.from('requests').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
${expiryLogic}
`;
  server = server.replace(userGetRegex, userGetReplacement);
}

// Patch Admin GET /api/admin/requests
const adminGetRegex = /app\.get\('\/api\/admin\/requests'[\s\S]*?const \{ data, error \} = await supabase\.from\('requests'\)\.select\('\*'\)\.order\('created_at', \{ ascending: false \}\);\s*if \(error\) throw error;/;
if(server.match(adminGetRegex)) {
  const adminGetReplacement = `app.get('/api/admin/requests', authenticateAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('requests').select('*').order('created_at', { ascending: false });
    if (error) throw error;
${expiryLogic}
`;
  server = server.replace(adminGetRegex, adminGetReplacement);
}

// Patch Razorpay Create Order for expiry protection
const rzpRegex = /const \{ data: reqs, error \} = await supabase\.from\('requests'\)\.select\('\*'\)\.in\('id', requestIds\);/;
if(server.match(rzpRegex)) {
  const rzpReplacement = `const { data: reqs, error } = await supabase.from('requests').select('*').in('id', requestIds);
    if (error) throw error;
    
    const now = Date.now();
    for (let r of reqs) {
      if (r.status === 'available') {
        let approvalTime = new Date(r.created_at).getTime();
        if (r.color && r.color.includes(' | Approved:')) {
          approvalTime = parseInt(r.color.split(' | Approved:')[1], 10);
        }
        if (now - approvalTime > 24 * 60 * 60 * 1000) {
          return res.status(400).json({ error: \`Reservation for \${r.product_name} has expired (24h limit). Please submit a new request.\` });
        }
      }
    }`;
  server = server.replace(rzpRegex, rzpReplacement);
}

fs.writeFileSync('backend/server.js', server);

// --- 2. PATCH INDEX.HTML (Footer Policies) ---
let indexHtml = fs.readFileSync('frontend/index.html', 'utf8');

const footerColTarget = `<div class="footer-col" style="visibility: hidden;">
              <!-- Placeholder for spacing -->
            </div>`;
const footerColReplacement = `<div class="footer-col">
              <h4>Policies & Legal</h4>
              <a href="javascript:void(0)" onclick="openPolicy('shipping')" class="magnetic">Shipping & Delivery</a>
              <a href="javascript:void(0)" onclick="openPolicy('returns')" class="magnetic">Returns & Refunds</a>
              <a href="javascript:void(0)" onclick="openPolicy('privacy')" class="magnetic">Privacy Policy & Terms</a>
              <a href="javascript:void(0)" onclick="openPolicy('contact')" class="magnetic">Contact Us</a>
            </div>`;
indexHtml = indexHtml.replace(footerColTarget, footerColReplacement);

if(!indexHtml.includes('policyModal')) {
  const policyModalHtml = `
  <!-- Policy Modal -->
  <div id="policyModal" class="modal-overlay" style="display:none; align-items:center; justify-content:center; z-index: 10000;">
    <div class="modal-content" style="background:#111; max-width:600px; width:90%; border:1px solid var(--gold); border-radius:10px; padding:30px; position:relative; max-height: 80vh; overflow-y: auto;">
      <button type="button" class="close-modal" onclick="document.getElementById('policyModal').style.display='none'" style="position:absolute; top:15px; right:15px; background:none; border:none; color:white; font-size:1.2rem; cursor:pointer;"><i class="fas fa-times"></i></button>
      <h3 id="policyTitle" style="color: var(--gold); margin-bottom: 20px; font-family:var(--font-serif); font-size:1.8rem; border-bottom: 1px solid rgba(255,215,0,0.2); padding-bottom:10px;">Policy</h3>
      <div id="policyContent" style="color: rgba(255,255,255,0.8); font-size: 0.95rem; line-height: 1.6;"></div>
    </div>
  </div>
  
  <script>
    function openPolicy(type) {
      const title = document.getElementById('policyTitle');
      const content = document.getElementById('policyContent');
      
      if(type === 'shipping') {
        title.innerText = 'Shipping & Delivery Policy';
        content.innerHTML = '<p>At AZ Fashion, we curate and prepare each exclusive piece with care.</p><ul><li><strong>Estimated Delivery:</strong> All orders are dispatched and delivered within <strong>10 working days</strong> from the date of payment confirmation.</li><li><strong>Order Tracking:</strong> Once your order is dispatched, you will receive a WhatsApp notification with the Courier Name and Tracking ID (AWB). You can also track your order live from your Account Dashboard.</li><li><strong>Shipping Charges:</strong> We currently offer complimentary free shipping on all pre-paid orders within India.</li></ul>';
      } else if(type === 'returns') {
        title.innerText = 'Return & Refund Policy';
        content.innerHTML = '<p>As a boutique service offering exclusive pieces, we follow a strict quality-check protocol.</p><ul><li><strong>Damage or Defect:</strong> If you receive a damaged or defective item, you must report it within 48 hours of delivery using the "Report Issue" button in your Order History.</li><li><strong>Video Proof Required:</strong> A complete, uncut <strong>parcel opening video</strong> is mandatory to process any damage or missing item claims.</li><li><strong>Refunds/Exchanges:</strong> Approved claims will be eligible for a replacement or a full refund to your original payment method (Razorpay) within 5-7 business days. We do not accept returns for sizing issues if the correct size was dispatched.</li></ul>';
      } else if(type === 'privacy') {
        title.innerText = 'Privacy Policy & Terms';
        content.innerHTML = '<p><strong>Privacy Policy:</strong> AZ Fashion respects your privacy. We collect only necessary information (Name, Phone, Email, Address) strictly for processing and delivering your orders. We do not sell or share your data. All payments are securely processed via Razorpay, and we do not store your card details.</p><p><strong>Terms of Service:</strong> By reserving a product, you have 24 hours to complete your payment. If payment is not received within 24 hours, the reservation will automatically expire to allow other customers access to the inventory.</p>';
      } else if(type === 'contact') {
        title.innerText = 'Contact Us';
        content.innerHTML = '<p>We are always here to assist you.</p><ul><li><strong>WhatsApp / Phone:</strong> +91 82106 34488</li><li><strong>Operating Hours:</strong> 10:00 AM - 7:00 PM (Mon-Sat)</li><li><strong>Registered Business:</strong> AZ Fashion Boutique</li></ul><p><em>Feel free to reach out to us via the WhatsApp Chat button below for instant support!</em></p>';
      }
      
      document.getElementById('policyModal').style.display = 'flex';
    }
  </script>
  `;
  indexHtml = indexHtml.replace('</body>', policyModalHtml + '\n</body>');
  fs.writeFileSync('frontend/index.html', indexHtml);
}

// --- 3. PATCH MAIN.JS (Update "Declined/Expired" text) ---
let mainJs = fs.readFileSync('frontend/main.js', 'utf8');

const declineUiRegex = /if \(r\.status === 'declined'\) \{[\s\S]*?We sincerely apologize, but this exclusive piece is currently out of stock\.[\s\S]*?\<\/div\>\`;\s*\}/;
const declineUiReplacement = `if (r.status === 'declined') {
            statusText = \`<span style="color: #f44336; font-weight: 600;">EXPIRED / DECLINED</span>\`;
            extraInfo = \`<div style="margin-top: 10px; font-size: 0.85rem; color: #ff9800; line-height: 1.4;">
              This reservation has expired (24h limit) or been declined. Join our <a href="https://chat.whatsapp.com/IivXOd4K7kx1tK72XAdbZa" target="_blank" style="color: #4caf50; text-decoration: underline; font-weight: bold;">WhatsApp Community</a> to stay updated on restocks!
            </div>\`;
          }`;
if(mainJs.match(declineUiRegex)) {
  mainJs = mainJs.replace(declineUiRegex, declineUiReplacement);
  fs.writeFileSync('frontend/main.js', mainJs);
}

console.log("Patched server.js, index.html, main.js for policies and auto-expiry");
