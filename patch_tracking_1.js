const fs = require('fs');

// PATCH SERVER.JS
let server = fs.readFileSync('backend/server.js', 'utf8');
if (!server.includes('/api/admin/requests/:id/shipped')) {
  const endpoints = `
// 19. Admin: Mark Shipped
app.post('/api/admin/requests/:id/shipped', authenticateAdmin, async (req, res) => {
  try {
    const { courier, tracking_id } = req.body;
    if (!courier || !tracking_id) return res.status(400).json({ error: 'Tracking data required' });
    const { data: reqData } = await supabase.from('requests').select('color').eq('id', req.params.id).single();
    let baseColor = (reqData.color || '').split(' | Courier: ')[0];
    const newColor = \`\${baseColor} | Courier: \${courier} | Track: \${tracking_id}\`;
    const { error } = await supabase.from('requests').update({ status: 'shipped', color: newColor }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Shipped' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: Mark Delivered
app.post('/api/admin/requests/:id/delivered', authenticateAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('requests').update({ status: 'delivered' }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Delivered' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
`;
  server = server.replace('// 19. Real Razorpay Create Order', endpoints + '\n// 19. Real Razorpay Create Order');
  fs.writeFileSync('backend/server.js', server);
}

// PATCH ADMIN.HTML
let adminHtml = fs.readFileSync('frontend/admin.html', 'utf8');
if (!adminHtml.includes('trackingModal')) {
  const trackingModalHtml = `
  <!-- Add Tracking Modal -->
  <div id="trackingModal" class="modal-overlay" style="display: none; align-items:center; justify-content:center;">
    <div class="modal-content admin-modal" style="background:#222; max-width:400px; width:90%; border:1px solid var(--gold); border-radius:10px; padding:20px; position:relative;">
      <button type="button" class="close-modal" onclick="document.getElementById('trackingModal').style.display='none'" style="position:absolute; top:15px; right:15px; background:none; border:none; color:white; font-size:1.2rem; cursor:pointer;"><i class="fas fa-times"></i></button>
      <h3 style="color: var(--gold); margin-bottom: 20px; font-family:var(--font-serif); font-size:1.5rem;">Add Tracking Details</h3>
      <form id="trackingForm">
        <input type="hidden" id="trackingReqId">
        <input type="hidden" id="trackingPhone">
        <input type="hidden" id="trackingProd">
        <input type="hidden" id="trackingUser">

        <label style="color: var(--text-muted); display: block; margin-bottom: 5px;">Courier Company Name</label>
        <input type="text" id="trackingCourier" placeholder="e.g. Delhivery, Blue Dart, DTDC" style="width:100%; padding:10px; border-radius:5px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.5); color:white; margin-bottom:15px;" required>

        <label style="color: var(--text-muted); display: block; margin-bottom: 5px;">Tracking ID / AWB Number</label>
        <input type="text" id="trackingIdInput" placeholder="e.g. 1402938472" style="width:100%; padding:10px; border-radius:5px; border:1px solid rgba(255,255,255,0.2); background:rgba(0,0,0,0.5); color:white; margin-bottom:15px;" required>

        <button type="submit" style="width: 100%; margin-top: 10px; padding: 12px; background: var(--gold); border: none; font-weight: bold; font-size:1rem; border-radius: 5px; cursor: pointer; color: black; transition:0.3s;">Save Tracking & Mark Shipped</button>
      </form>
    </div>
  </div>
  `;
  adminHtml = adminHtml.replace('</body>', trackingModalHtml + '\n</body>');
  fs.writeFileSync('frontend/admin.html', adminHtml);
}

console.log("Patched server.js and admin.html");
