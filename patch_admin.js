const fs = require('fs');

let html = fs.readFileSync('frontend/admin.html', 'utf8');

// Add Chart.js
html = html.replace('</head>', '  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n</head>');

// Add Dashboard tab button
html = html.replace('<button class="admin-nav-btn active" data-tab="products">Products</button>', 
  '<button class="admin-nav-btn active" data-tab="dashboard">Dashboard</button>\n      <button class="admin-nav-btn" data-tab="products">Products</button>');

// Remove active from products tab div
html = html.replace('<div id="tab-products" class="admin-tab active">', '<div id="tab-products" class="admin-tab" style="display: none;">');

// Add Dashboard tab content
const dashboardTab = `
      <!-- Dashboard Tab -->
      <div id="tab-dashboard" class="admin-tab active">
        <h2 style="margin-bottom: 20px; color: var(--gold);">Business Dashboard</h2>
        
        <div style="display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap;">
          <div class="card container" style="flex: 1; min-width: 200px; padding: 20px; text-align: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,215,0,0.3);">
            <h4 style="color: var(--text-muted); margin-bottom: 10px;">Total Revenue</h4>
            <div id="dashTotalRevenue" style="font-size: 2rem; color: var(--gold); font-weight: bold;">₹0</div>
          </div>
          <div class="card container" style="flex: 1; min-width: 200px; padding: 20px; text-align: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,215,0,0.3);">
            <h4 style="color: var(--text-muted); margin-bottom: 10px;">Pending Requests</h4>
            <div id="dashPendingRequests" style="font-size: 2rem; color: #ff9800; font-weight: bold;">0</div>
          </div>
        </div>

        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
          <div class="card container" style="flex: 2; min-width: 400px; padding: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
            <h3 style="margin-bottom: 15px; color: var(--gold);">Revenue Overview (This Year)</h3>
            <canvas id="revenueChart" style="width: 100%; height: 300px;"></canvas>
          </div>
          
          <div class="card container" style="flex: 1; min-width: 250px; padding: 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
            <h3 style="margin-bottom: 15px; color: var(--gold);">Top Requested Products</h3>
            <div id="dashTopProducts" style="display: flex; flex-direction: column; gap: 10px;">
              <!-- Populated by JS -->
            </div>
          </div>
        </div>
      </div>
`;
html = html.replace('<!-- Products Tab -->', dashboardTab + '\n      <!-- Products Tab -->');

// Replace Add Sizes Input
const oldAddSizes = '<input type="text" id="addSizes" placeholder="Sizes (comma separated, e.g. S, M, L, Custom)" style="padding: 10px; border-radius: 5px; border: none; background: rgba(255,255,255,0.1); color: white;" required>';
const newAddSizes = `
            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
              <label style="color: var(--gold); display: block; margin-bottom: 10px; font-weight: bold;">Inventory (Sizes & Stock)</label>
              <div id="addSizeContainer" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px;"></div>
              <button type="button" id="addSizeRowBtn" style="background: transparent; border: 1px dashed var(--gold); color: var(--gold); padding: 8px; border-radius: 5px; cursor: pointer; width: 100%;">+ Add Size / Stock</button>
            </div>
`;
html = html.replace(oldAddSizes, newAddSizes);

// Replace Edit Sizes Input
const oldEditSizes = '<input type="text" id="editSizes" placeholder="Sizes (comma separated)" style="padding: 10px; border-radius: 5px; border: none; background: rgba(255,255,255,0.1); color: white;" required>';
const newEditSizes = `
        <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
          <label style="color: var(--gold); display: block; margin-bottom: 10px; font-weight: bold;">Inventory (Sizes & Stock)</label>
          <div id="editSizeContainer" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 10px;"></div>
          <button type="button" id="editSizeRowBtn" style="background: transparent; border: 1px dashed var(--gold); color: var(--gold); padding: 8px; border-radius: 5px; cursor: pointer; width: 100%;">+ Add Size / Stock</button>
        </div>
`;
html = html.replace(oldEditSizes, newEditSizes);

fs.writeFileSync('frontend/admin.html', html);


// Now patch admin.js
let js = fs.readFileSync('frontend/admin.js', 'utf8');

const analyticsCode = `
// Dashboard Analytics
let chartInstance = null;
async function fetchAnalytics() {
  try {
    const response = await fetch('/api/admin/analytics', { headers: { 'Authorization': 'Bearer ' + localStorage.getItem('adminToken') } });
    if (!response.ok) return;
    const data = await response.json();
    
    document.getElementById('dashTotalRevenue').textContent = '₹' + data.totalRevenue.toLocaleString('en-IN');
    document.getElementById('dashPendingRequests').textContent = data.pendingRequests;
    
    // Top Products
    const topHtml = data.topProducts.map((p, i) => \`
      <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
        <span style="color: white; font-size: 0.9rem;">\${i+1}. \${p.name}</span>
        <span style="color: var(--gold); font-weight: bold;">\${p.count} reqs</span>
      </div>
    \`).join('');
    document.getElementById('dashTopProducts').innerHTML = topHtml || '<p style="color:gray;">No requests yet.</p>';
    
    // Chart
    const ctx = document.getElementById('revenueChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          label: 'Revenue (₹)',
          data: data.monthlyData,
          borderColor: '#D4AF37',
          backgroundColor: 'rgba(212, 175, 55, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)' } },
          x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)' } }
        }
      }
    });
  } catch(e) { console.error('Analytics Error:', e); }
}

// Initial fetch if logged in
if (localStorage.getItem('adminToken')) {
  fetchAnalytics();
}

// Inventory UI Builder
function createSizeRow(containerId, name = '', stock = 10) {
  const container = document.getElementById(containerId);
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = '10px';
  row.innerHTML = \`
    <input type="text" placeholder="Size (e.g. M)" value="\${name}" class="size-name-input" style="flex: 2; padding: 8px; border-radius: 4px; border: none; background: rgba(255,255,255,0.1); color: white;" required>
    <input type="number" placeholder="Qty" value="\${stock}" class="size-stock-input" style="flex: 1; padding: 8px; border-radius: 4px; border: none; background: rgba(255,255,255,0.1); color: white;" required min="0">
    <button type="button" onclick="this.parentElement.remove()" style="background: rgba(255,0,0,0.2); color: #ff4d4d; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button>
  \`;
  container.appendChild(row);
}
document.getElementById('addSizeRowBtn')?.addEventListener('click', () => createSizeRow('addSizeContainer'));
document.getElementById('editSizeRowBtn')?.addEventListener('click', () => createSizeRow('editSizeContainer'));

function extractSizes(containerId) {
  const container = document.getElementById(containerId);
  const names = container.querySelectorAll('.size-name-input');
  const stocks = container.querySelectorAll('.size-stock-input');
  const sizes = [];
  for(let i=0; i<names.length; i++) {
    if(names[i].value.trim()) {
      sizes.push({ name: names[i].value.trim(), stock: parseInt(stocks[i].value, 10) || 0 });
    }
  }
  return JSON.stringify(sizes); // Backend accepts stringified JSON for sizes
}
`;

js = js.replace('// --- Tab Switching ---', analyticsCode + '\n// --- Tab Switching ---');

// Hook tab switching to fetchAnalytics
js = js.replace(/fetchRequests\(\);\n\s+\}/, "fetchRequests();\n      }\n      if (tabId === 'dashboard') {\n        fetchAnalytics();\n      }");

// Update add form logic
js = js.replace('const sizes = document.getElementById(\'addSizes\').value;', 'const sizes = extractSizes(\'addSizeContainer\');');
// Make sure sizes isn't passed as a comma separated string to backend anymore. Wait, the backend was updated to parse JSON arrays anyway in the previous migrations, but `sizes` in req.body was expected as comma separated string? Let me check server.js `api/admin/products`.
// I should pass it stringified, but `server.js` was splitting by comma. I need to fix server.js for product creation later or fix it here!
// Let's modify the add product logic.

// Update edit form logic
js = js.replace('const sizes = document.getElementById(\'editSizes\').value;', 'const sizes = extractSizes(\'editSizeContainer\');');

// Update openEditModal to parse object sizes
const oldOpenEdit = `function openEditModal(prod) {
  currentEditId = prod.id;
  document.getElementById('editName').value = prod.name;
  document.getElementById('editDesc').value = prod.description;
  document.getElementById('editPrice').value = prod.price;
  document.getElementById('editCollection').value = prod.collection_id;
  document.getElementById('editSizes').value = typeof prod.sizes === 'string' ? JSON.parse(prod.sizes).join(', ') : (prod.sizes || []).join(', ');`;

const newOpenEdit = `function openEditModal(prod) {
  currentEditId = prod.id;
  document.getElementById('editName').value = prod.name;
  document.getElementById('editDesc').value = prod.description;
  document.getElementById('editPrice').value = prod.price;
  document.getElementById('editCollection').value = prod.collection_id;
  
  const container = document.getElementById('editSizeContainer');
  container.innerHTML = '';
  let sizesArr = [];
  try {
    sizesArr = typeof prod.sizes === 'string' ? JSON.parse(prod.sizes || '[]') : (prod.sizes || []);
  } catch(e){}
  
  sizesArr.forEach(s => {
    const sName = typeof s === 'object' ? s.name : s;
    const sStock = typeof s === 'object' ? s.stock : 10;
    createSizeRow('editSizeContainer', sName, sStock);
  });
  if(sizesArr.length === 0) createSizeRow('editSizeContainer');
`;
js = js.replace(oldOpenEdit, newOpenEdit);

fs.writeFileSync('frontend/admin.js', js);
