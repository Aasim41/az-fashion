const fs = require('fs');

let adminJs = fs.readFileSync('frontend/admin.js', 'utf8');

if (!adminJs.includes('window.openTrackingModal =')) {
  const trackingCode = `
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
  
  adminJs += '\n' + trackingCode;
  fs.writeFileSync('frontend/admin.js', adminJs);
  console.log("Fixed tracking code missing in admin.js");
}
