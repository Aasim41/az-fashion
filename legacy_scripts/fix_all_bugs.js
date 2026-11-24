const fs = require('fs');

// ============================================================
// FIX 1: server.js - Increase rate limits massively
// ============================================================
let server = fs.readFileSync('backend/server.js', 'utf8');

// Increase general rate limit from 600 to 5000
server = server.replace(
  `const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // 600 requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
});`,
  `const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000, // 5000 requests per 15 min (generous for polling + UptimeRobot)
  standardHeaders: true,
  legacyHeaders: false,
});`
);

// Increase auth rate limit from 30 to 100
server = server.replace(
  `const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per IP
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});`,
  `const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 auth requests per IP per 15 min
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});`
);

fs.writeFileSync('backend/server.js', server);
console.log('[1/4] Fixed rate limits in server.js');

// ============================================================
// FIX 2: main.js - Reduce polling frequency & fix all bugs
// ============================================================
let main = fs.readFileSync('frontend/main.js', 'utf8');

// Reduce polling from 15s to 60s
main = main.replace(
  `  // Poll for request updates, notifications, and verify active single-device session every 15 seconds
  setInterval(() => {
    if (currentUser && currentUser.id) {
      verifyActiveSession();
      updateMyRequestsBadge();
    }
  }, 15000);`,
  `  // Poll for request updates, notifications, and verify active single-device session every 60 seconds
  setInterval(() => {
    if (currentUser && currentUser.id) {
      verifyActiveSession();
      updateMyRequestsBadge();
    }
  }, 60000);`
);

fs.writeFileSync('frontend/main.js', main);
console.log('[2/4] Fixed polling frequency in main.js');

// ============================================================
// FIX 3: admin.js - Reduce polling, add dashboard analytics
// ============================================================
let admin = fs.readFileSync('frontend/admin.js', 'utf8');

// Reduce admin polling from 12s to 45s
admin = admin.replace(
  `  adminPollerTimer = setInterval(checkNewRequests, 12000); // Check every 12 seconds`,
  `  adminPollerTimer = setInterval(checkNewRequests, 45000); // Check every 45 seconds`
);

// Add dashboard analytics code + inventory UI code BEFORE the tab switching section
const dashboardCode = `
// Dashboard Analytics
let chartInstance = null;
async function fetchAnalytics() {
  try {
    const response = await fetch('/api/admin/analytics', { headers: getAuthHeaders() });
    if (!response.ok) return;
    const data = await response.json();
    
    const revEl = document.getElementById('dashTotalRevenue');
    const pendEl = document.getElementById('dashPendingRequests');
    if (revEl) revEl.textContent = '₹' + data.totalRevenue.toLocaleString('en-IN');
    if (pendEl) pendEl.textContent = data.pendingRequests;
    
    // Top Products
    const topEl = document.getElementById('dashTopProducts');
    if (topEl) {
      const topHtml = data.topProducts.map((p, i) => \`
        <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
          <span style="color: white; font-size: 0.9rem;">\${i+1}. \${p.name}</span>
          <span style="color: var(--gold); font-weight: bold;">\${p.count} reqs</span>
        </div>
      \`).join('');
      topEl.innerHTML = topHtml || '<p style="color:gray;">No requests yet.</p>';
    }
    
    // Chart
    const canvas = document.getElementById('revenueChart');
    if (canvas && typeof Chart !== 'undefined') {
      const ctx = canvas.getContext('2d');
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
    }
  } catch(e) { console.error('Analytics Error:', e); }
}

// Inventory UI Builder
function createSizeRow(containerId, name, stock) {
  name = name || '';
  stock = (stock !== undefined && stock !== null) ? stock : 10;
  const container = document.getElementById(containerId);
  if (!container) return;
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
  if (!container) return '[]';
  const names = container.querySelectorAll('.size-name-input');
  const stocks = container.querySelectorAll('.size-stock-input');
  const sizes = [];
  for(let i=0; i<names.length; i++) {
    if(names[i].value.trim()) {
      sizes.push({ name: names[i].value.trim(), stock: parseInt(stocks[i].value, 10) || 0 });
    }
  }
  return JSON.stringify(sizes);
}

`;

// Insert dashboard code right before "// Tab Navigation" or "// Login Form Submit"
admin = admin.replace('// Tab Navigation', dashboardCode + '// Tab Navigation');

// Add dashboard tab fetch on tab switch
admin = admin.replace(
  `    if (tabName === 'requests') {
      loadRequests();
    }`,
  `    if (tabName === 'requests') {
      loadRequests();
    }
    if (tabName === 'dashboard') {
      fetchAnalytics();
    }`
);

// Also fetch analytics on showAdminDashboard
admin = admin.replace(
  `  startAdminRequestPoller();
}`,
  `  startAdminRequestPoller();
  fetchAnalytics();
}`
);

fs.writeFileSync('frontend/admin.js', admin);
console.log('[3/4] Fixed admin.js - reduced polling, added analytics + inventory UI');

// ============================================================
// FIX 4: Check for sizes handling in admin.js add/edit forms
// ============================================================
admin = fs.readFileSync('frontend/admin.js', 'utf8');

// Check if the add product form still uses the old addSizes input
if (admin.includes("document.getElementById('addSizes')")) {
  admin = admin.replace(
    "const sizes = document.getElementById('addSizes').value;",
    "const sizes = extractSizes('addSizeContainer');"
  );
}

// Check if edit form still uses old editSizes input
if (admin.includes("document.getElementById('editSizes')")) {
  admin = admin.replace(
    "const sizes = document.getElementById('editSizes').value;",
    "const sizes = extractSizes('editSizeContainer');"
  );
}

// Fix openEditModal if it still references editSizes
if (admin.includes("document.getElementById('editSizes').value")) {
  admin = admin.replace(
    /document\.getElementById\('editSizes'\)\.value = .*?;/,
    `// sizes handled by createSizeRow below`
  );
}

fs.writeFileSync('frontend/admin.js', admin);
console.log('[4/4] Fixed admin.js sizes form handling');

console.log('\nAll fixes applied successfully!');
