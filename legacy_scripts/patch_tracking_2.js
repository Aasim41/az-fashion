const fs = require('fs');

// PATCH ADMIN.JS
let adminJs = fs.readFileSync('frontend/admin.js', 'utf8');

adminJs = adminJs.replace(
  "if(r.status === 'paid') statusBadge = '<span style=\"color:#2196f3; font-weight:bold;\">PAID (Order Confirmed)</span>';",
  `if(r.status === 'paid') statusBadge = '<span style="color:#2196f3; font-weight:bold;">PAID (Processing)</span>';
      if(r.status === 'shipped') statusBadge = '<span style="color:#9c27b0; font-weight:bold;">SHIPPED / IN TRANSIT</span>';
      if(r.status === 'delivered') statusBadge = '<span style="color:#4caf50; font-weight:bold;">DELIVERED</span>';`
);

adminJs = adminJs.replace(
  /\} else if \(r\.status === 'available'\) \{\s*actionBtns = notifyBtn;\s*\}/,
  `} else if (r.status === 'available') {
        actionBtns = notifyBtn;
      } else if (r.status === 'paid') {
        actionBtns = \`
          <div style="display: flex; gap: 5px; flex-wrap: wrap;">
            <button class="btn-action" onclick="openTrackingModal(\${r.id}, '\${cleanPhone}', '\${encodeURIComponent(r.product_name || '')}', '\${encodeURIComponent(r.user_name || '')}')" style="background:#2196f3; border:none; color:white;">Add Tracking</button>
          </div>
        \`;
      } else if (r.status === 'shipped') {
        const trackMatch = (r.color || '').match(/\\| Courier: (.*?) \\| Track: (.*)/);
        const courier = trackMatch ? trackMatch[1] : 'Courier';
        const trackId = trackMatch ? trackMatch[2] : 'N/A';
        const msg = encodeURIComponent(\`Hello \${r.user_name || 'Client'},\n\nGreat news from AZ Fashion! ✨\nYour order for "\${r.product_name}" has been DISPATCHED.\n\n🚚 Courier: \${courier}\n📦 Tracking ID: \${trackId}\n\nTrack your package here: https://17track.net/en/track?nums=\${trackId}\n\nEstimated delivery is within 10 days. Thank you for choosing us!\`);
        const waLinkTrack = cleanPhone ? \`https://wa.me/\${cleanPhone}?text=\${msg}\` : '';
        
        actionBtns = \`
          <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 5px;">
            <button class="btn-action" onclick="markDelivered(\${r.id})" style="background:#4caf50; border:none; color:white;">Mark Delivered</button>
          </div>
          <a href="\${waLinkTrack}" target="_blank" class="btn-action" style="background: #25D366; color: white; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 4px; font-size: 0.8rem;" title="Send Tracking via WhatsApp">
            <i class="fab fa-whatsapp"></i> Send Tracking
          </a>
          <div style="font-size: 0.8rem; margin-top:5px; opacity: 0.8;">via \${courier} (#\${trackId})</div>
        \`;
      } else if (r.status === 'delivered') {
        actionBtns = \`<span style="color:#4caf50; font-size: 0.85rem;"><i class="fas fa-check-circle"></i> Completed</span>\`;
      }`
);

if (!adminJs.includes('openTrackingModal')) {
  adminJs += `
window.openTrackingModal = (id, phone, prodName, userName) => {
  document.getElementById('trackingReqId').value = id;
  document.getElementById('trackingPhone').value = phone || '';
  document.getElementById('trackingProd').value = prodName || '';
  document.getElementById('trackingUser').value = userName || '';
  document.getElementById('trackingCourier').value = '';
  document.getElementById('trackingIdInput').value = '';
  document.getElementById('trackingModal').style.display = 'flex';
};

document.getElementById('trackingForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('trackingReqId').value;
  const courier = document.getElementById('trackingCourier').value.trim();
  const tracking_id = document.getElementById('trackingIdInput').value.trim();
  const phone = document.getElementById('trackingPhone').value;
  const prod = document.getElementById('trackingProd').value;
  const user = document.getElementById('trackingUser').value;

  fetch('/api/admin/requests/' + id + '/shipped', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ courier, tracking_id })
  }).then(async r => {
    if (handleAuthError(r)) return;
    const res = await r.json();
    if(res.error) return alert(res.error);
    document.getElementById('trackingModal').style.display = 'none';
    loadRequests();
    
    if(phone && confirm("Tracking saved! Send WhatsApp update to client now?")) {
      const decodedProd = decodeURIComponent(prod || 'your item');
      const decodedUser = decodeURIComponent(user || 'Valued Client');
      const msg = encodeURIComponent(\`Hello \${decodedUser},\n\nGreat news from AZ Fashion! ✨\nYour order for "\${decodedProd}" has been DISPATCHED.\n\n🚚 Courier: \${courier}\n📦 Tracking ID: \${tracking_id}\n\nTrack your package here: https://17track.net/en/track?nums=\${tracking_id}\n\nEstimated delivery is within 10 days. Thank you for choosing us!\`);
      window.open(\`https://wa.me/\${phone}?text=\${msg}\`, '_blank');
    }
  }).catch(err => {
    console.error(err); alert('Failed to save tracking');
  });
});

window.markDelivered = (id) => {
  if(!confirm("Confirm this order has been delivered successfully?")) return;
  fetch('/api/admin/requests/' + id + '/delivered', {
    method: 'POST',
    headers: getAuthHeaders()
  }).then(async r => {
    if (handleAuthError(r)) return;
    loadRequests();
  });
};
`;
}
fs.writeFileSync('frontend/admin.js', adminJs);


// PATCH MAIN.JS
let mainJs = fs.readFileSync('frontend/main.js', 'utf8');

const targetStr = `const paidReqs = reqs.filter(r => r.status === 'paid');
        if (paidReqs.length === 0) {
          ordersList.innerHTML = '<p style="font-size: 0.9rem; opacity: 0.8;">No orders found. Explore our collections to place an order!</p>';
        } else {
          paidReqs.forEach(r => {
            ordersList.innerHTML += \`
              <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                <div>
                  <h4 style="color: var(--gold); margin-bottom: 5px;">\${r.product_name}</h4>
                  <p style="font-size: 0.85rem; opacity: 0.8;">Size: \${r.size} | Color: \${r.color}</p>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                  <div style="color: #4caf50; font-weight: bold; font-size: 0.9rem; margin-bottom: 5px;">
                    PAID
                  </div>
                  <a href="https://wa.me/+918210634488?text=Hi,%20I%20have%20received%20my%20order%20for%20\${encodeURIComponent(r.product_name)}%20but%20there%20is%20an%20issue/damage.%20[Please%20attach%20video%20proof%20here]" target="_blank" style="font-size: 0.8rem; color: #ff9800; text-decoration: underline;">Report Issue / Damage</a>
                </div>
              </div>
            \`;
          });
        }`;

const replacement = `const validReqs = reqs.filter(r => ['paid', 'shipped', 'delivered'].includes(r.status));
        if (validReqs.length === 0) {
          ordersList.innerHTML = '<p style="font-size: 0.9rem; opacity: 0.8;">No orders found. Explore our collections to place an order!</p>';
        } else {
          validReqs.forEach(r => {
            const orderDate = new Date(r.created_at);
            const deliveryDate = new Date(orderDate);
            deliveryDate.setDate(deliveryDate.getDate() + 10);
            const deliveryStr = deliveryDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

            const trackMatch = (r.color || '').match(/\\| Courier: (.*?) \\| Track: (.*)/);
            const courier = trackMatch ? trackMatch[1] : null;
            const trackId = trackMatch ? trackMatch[2] : null;
            
            const displayColor = (r.color || '').split(' | Courier: ')[0];

            let statusStep = 1;
            if (r.status === 'shipped') statusStep = 2;
            if (r.status === 'delivered') statusStep = 3;

            const trackingHtml = statusStep >= 2 && trackId ? \`
              <div style="margin-top: 15px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="font-size: 0.85rem; color: var(--gold); margin-bottom: 5px;">🚚 \${courier}</div>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                  <div style="font-family: monospace; font-size: 1rem; color: white;">ID: \${trackId}</div>
                  <div style="display: flex; gap: 10px;">
                    <button onclick="navigator.clipboard.writeText('\${trackId}'); alert('Tracking ID copied!');" style="background: transparent; border: 1px solid rgba(255,255,255,0.3); color: white; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; transition: 0.3s;">Copy ID</button>
                    <a href="https://17track.net/en/track?nums=\${trackId}" target="_blank" style="background: var(--gold); color: black; text-decoration: none; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; transition: 0.3s;">Track Package</a>
                  </div>
                </div>
              </div>
            \` : '';

            ordersList.innerHTML += \`
              <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 12px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.05);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 15px;">
                  <div>
                    <h4 style="color: white; margin-bottom: 5px; font-size: 1.1rem;">\${r.product_name}</h4>
                    <p style="font-size: 0.85rem; color: rgba(255,255,255,0.7); margin: 0;">Size/Qty: \${r.size} | Color: \${displayColor}</p>
                    <p style="font-size: 0.85rem; color: rgba(255,255,255,0.5); margin: 2px 0 0 0;">Ordered: \${orderDate.toLocaleDateString()}</p>
                  </div>
                  <div style="text-align: right;">
                    <div style="color: var(--gold); font-size: 0.85rem; font-weight: bold; margin-bottom: 2px;">Estimated Delivery</div>
                    <div style="color: white; font-size: 0.95rem;">By \${deliveryStr} (10 Days)</div>
                  </div>
                </div>

                <div style="display: flex; justify-content: space-between; position: relative; margin-top: 25px; margin-bottom: \${trackingHtml ? '5px' : '20px'};">
                  <div style="position: absolute; top: 12px; left: 10%; right: 10%; height: 2px; background: rgba(255,255,255,0.1); z-index: 0;">
                    <div style="height: 100%; background: #4caf50; width: \${statusStep === 1 ? '0%' : statusStep === 2 ? '50%' : '100%'}; transition: width 0.5s;"></div>
                  </div>
                  
                  <div style="position: relative; z-index: 1; text-align: center; width: 33%;">
                    <div style="width: 26px; height: 26px; border-radius: 50%; background: \${statusStep >= 1 ? '#4caf50' : '#333'}; color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px auto; font-size: 0.8rem;"><i class="fas fa-check"></i></div>
                    <div style="font-size: 0.75rem; color: \${statusStep >= 1 ? 'white' : 'rgba(255,255,255,0.5)'}; font-weight: bold;">Confirmed</div>
                  </div>
                  <div style="position: relative; z-index: 1; text-align: center; width: 33%;">
                    <div style="width: 26px; height: 26px; border-radius: 50%; background: \${statusStep >= 2 ? '#4caf50' : '#333'}; color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px auto; font-size: 0.8rem;"><i class="fas \${statusStep >= 2 ? 'fa-check' : 'fa-truck'}"></i></div>
                    <div style="font-size: 0.75rem; color: \${statusStep >= 2 ? 'white' : 'rgba(255,255,255,0.5)'}; font-weight: bold;">Dispatched</div>
                  </div>
                  <div style="position: relative; z-index: 1; text-align: center; width: 33%;">
                    <div style="width: 26px; height: 26px; border-radius: 50%; background: \${statusStep >= 3 ? '#4caf50' : '#333'}; color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px auto; font-size: 0.8rem;"><i class="fas \${statusStep >= 3 ? 'fa-check' : 'fa-home'}"></i></div>
                    <div style="font-size: 0.75rem; color: \${statusStep >= 3 ? 'white' : 'rgba(255,255,255,0.5)'}; font-weight: bold;">Delivered</div>
                  </div>
                </div>

                \${trackingHtml}

                <div style="margin-top: 15px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; text-align: right;">
                  <a href="https://wa.me/+918210634488?text=Hi,%20I%20have%20an%20issue%20with%20my%20order%20for%20\${encodeURIComponent(r.product_name)}." target="_blank" style="font-size: 0.85rem; color: rgba(255,255,255,0.6); text-decoration: underline;">Need Help / Report Damage?</a>
                </div>
              </div>
            \`;
          });
        }`;

mainJs = mainJs.replace(targetStr, replacement);
fs.writeFileSync('frontend/main.js', mainJs);

console.log("Patched JS files");
