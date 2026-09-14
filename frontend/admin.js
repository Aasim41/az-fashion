console.log("Admin Dashboard Loaded - Version 4");
function getAuthHeaders() {
  const token = sessionStorage.getItem('az_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function handleAuthError(res) {
  if (res.status === 401 || res.status === 403) {
    if (typeof window.logoutAdmin === 'function') window.logoutAdmin();
    alert('Admin session expired or unauthorized. Please log in.');
    return true;
  }
  return false;
}

// Gentle luxury chime via Web Audio API (no external file required)
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch(e) {}
}

window.requestAdminNotificationPermission = () => {
  if (!("Notification" in window)) {
    return alert("Your browser does not support desktop notifications.");
  }
  Notification.requestPermission().then(perm => {
    updateNotifButtonState();
    if (perm === 'granted') {
      try {
        new Notification("AZ Fashion Admin", {
          body: "Web Notifications active! You will receive instant alerts for new customer requests.",
          icon: '/images/col_daily.png'
        });
      } catch(e) {}
    }
  });
};

function updateNotifButtonState() {
  const btn = document.getElementById('adminNotifBtn');
  if (!btn) return;
  if (!("Notification" in window)) {
    btn.style.display = 'none';
    return;
  }
  if (Notification.permission === 'granted') {
    btn.innerHTML = '<i class="fas fa-bell" style="color: #4caf50;"></i> <span style="color: #4caf50;">Alerts: Active</span>';
    btn.title = 'Web Notifications are active';
  } else if (Notification.permission === 'denied') {
    btn.innerHTML = '<i class="fas fa-bell-slash" style="color: #f44336;"></i> <span style="color: #f44336;">Alerts: Blocked</span>';
    btn.title = 'Notifications are blocked in your browser settings';
  } else {
    btn.innerHTML = '<i class="fas fa-bell" style="color: var(--gold);"></i> <span>Enable Alerts</span>';
    btn.title = 'Click to enable real-time notifications';
  }
}

let knownRequestIds = null;
let adminPollerTimer = null;

function startAdminRequestPoller() {
  if (adminPollerTimer) clearInterval(adminPollerTimer);
  checkNewRequests();
  adminPollerTimer = setInterval(checkNewRequests, 45000); // Check every 45 seconds
}

function checkNewRequests() {
  if (!sessionStorage.getItem('az_admin_token')) return;

  fetch('/api/admin/requests', {
    headers: getAuthHeaders()
  }).then(async r => {
    if (r.status === 401 || r.status === 403) {
      if (typeof window.logoutAdmin === 'function') window.logoutAdmin();
      return;
    }
    const reqs = await r.json();
    if (!Array.isArray(reqs)) return;

    const pendingReqs = reqs.filter(r => r.status === 'pending');
    
    // Update badge count on sidebar
    const badge = document.getElementById('adminRequestsBadge');
    if (badge) {
      if (pendingReqs.length > 0) {
        badge.innerText = pendingReqs.length;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    if (knownRequestIds === null) {
      // First run: track existing pending requests so we don't alert old ones
      knownRequestIds = new Set(pendingReqs.map(r => r.id));
      return;
    }

    // Identify brand new pending requests
    const newReqs = pendingReqs.filter(r => !knownRequestIds.has(r.id));
    if (newReqs.length > 0) {
      newReqs.forEach(req => {
        knownRequestIds.add(req.id);
        triggerAdminNotification(req);
      });

      // Refresh table if tab-requests is currently displayed
      const reqTab = document.getElementById('tab-requests');
      if (reqTab && reqTab.style.display !== 'none') {
        loadRequests();
      }
    }
  }).catch(() => {});
}

function triggerAdminNotification(req) {
  // 1. Play sound
  playNotificationSound();

  // 2. Native OS / Browser Web Notification API
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      let iconImg = req.image_url || '/images/col_daily.png';
      if (iconImg.startsWith('[')) {
        try { iconImg = JSON.parse(iconImg)[0] || iconImg; } catch(e) {}
      }
      const notif = new Notification("AZ Fashion - New Client Request! ✨", {
        body: `${req.user_name || 'Client'} requested "${req.product_name}" (Size: ${req.size || 'N/A'}, ₹${req.price})`,
        icon: iconImg,
        badge: iconImg,
        tag: 'req-' + req.id
      });
      notif.onclick = () => {
        window.focus();
        document.querySelector('.admin-nav-btn[data-tab="requests"]')?.click();
      };
    } catch(e) {}
  }

  // 3. In-Dashboard floating toast banner
  const banner = document.getElementById('adminNotifyBanner');
  const title = document.getElementById('adminNotifyTitle');
  const body = document.getElementById('adminNotifyBody');
  const viewBtn = document.getElementById('adminNotifyViewBtn');

  if (banner && title && body && viewBtn) {
    title.innerText = `✨ New Request from ${req.user_name || 'Client'}`;
    body.innerHTML = `<strong>${req.product_name}</strong> &bull; Size: ${req.size || 'N/A'} &bull; <span style="color:var(--gold)">₹${req.price}</span>`;
    viewBtn.onclick = () => {
      banner.style.display = 'none';
      document.querySelector('.admin-nav-btn[data-tab="requests"]')?.click();
    };
    banner.style.display = 'block';

    setTimeout(() => {
      if (banner && banner.style.display !== 'none') {
        banner.style.opacity = '0';
        setTimeout(() => {
          banner.style.display = 'none';
          banner.style.opacity = '1';
        }, 400);
      }
    }, 15000);
  }
}

function showAdminDashboard() {
  document.getElementById('adminLogin').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'flex';
  loadCollections();
  updateNotifButtonState();

  // Ask for Web Notification permission immediately upon entering dashboard
  if ("Notification" in window && Notification.permission === "default") {
    try {
      Notification.requestPermission().then(updateNotifButtonState).catch(() => {});
    } catch(e) {}
  }

  startAdminRequestPoller();
  fetchAnalytics();
}

window.logoutAdmin = () => {
  if (adminPollerTimer) clearInterval(adminPollerTimer);
  sessionStorage.removeItem('az_admin_token');
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('adminLogin').style.display = 'flex';
};

// Check if admin is already logged in
if (sessionStorage.getItem('az_admin_token')) {
  showAdminDashboard();
}

// Ask for notification permission on initial page load / gesture as well
if ("Notification" in window && Notification.permission === "default") {
  try {
    Notification.requestPermission().then(updateNotifButtonState).catch(() => {});
  } catch(e) {}
  const askGesture = () => {
    if (Notification.permission === "default") {
      Notification.requestPermission().then(updateNotifButtonState).catch(() => {});
    }
    document.removeEventListener('click', askGesture);
  };
  document.addEventListener('click', askGesture, { once: true });
}

// Login Form Submit
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = document.getElementById('adminPass').value;

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });
    const data = await response.json();

    if (!response.ok) {
      return alert(data.error || 'Invalid admin credentials');
    }

    sessionStorage.setItem('az_admin_token', data.token);
    document.getElementById('adminPass').value = '';
    showAdminDashboard();
  } catch (err) {
    console.error(err);
    alert('Failed to connect to backend server');
  }
});


// Dashboard Analytics

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
      const topHtml = data.topProducts.map((p, i) => `
        <div style="display: flex; justify-content: space-between; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px;">
          <span style="color: white; font-size: 0.9rem;">${i+1}. ${p.name}</span>
          <span style="color: var(--gold); font-weight: bold;">${p.count} reqs</span>
        </div>
      `).join('');
      topEl.innerHTML = topHtml || '<p style="color:gray;">No requests yet.</p>';
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
  row.innerHTML = `
    <input type="text" placeholder="Size (e.g. M)" value="${name}" class="size-name-input" style="flex: 2; padding: 8px; border-radius: 4px; border: none; background: rgba(255,255,255,0.1); color: white;" required>
    <input type="number" placeholder="Qty" value="${stock}" class="size-stock-input" style="flex: 1; padding: 8px; border-radius: 4px; border: none; background: rgba(255,255,255,0.1); color: white;" required min="0">
    <button type="button" onclick="this.parentElement.remove()" style="background: rgba(255,0,0,0.2); color: #ff4d4d; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;"><i class="fas fa-trash"></i></button>
  `;
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

// Tab Navigation
document.querySelectorAll('.admin-nav-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
    
    btn.classList.add('active');
    if (btn.dataset.tab === 'reviews') loadReviews();
    const tabName = btn.getAttribute('data-tab');
    document.getElementById('tab-' + tabName).style.display = 'block';
    if (tabName === 'requests') {
      loadRequests();
    }
    if (tabName === 'dashboard') {
      fetchAnalytics();
    }
  });
});

let allCollections = [];

function loadCollections() {
  fetch('/api/collections')
    .then(r => r.json())
    .then(cols => {
      allCollections = cols;
      const addSelect = document.getElementById('addCollection');
      const editSelect = document.getElementById('editCollection');
      
      let opts = '<option value="" disabled selected>Select Collection Category</option>';
      cols.forEach(c => {
        opts += `<option value="${c.id}">${c.name}</option>`;
      });
      if (addSelect) addSelect.innerHTML = opts;
      if (editSelect) editSelect.innerHTML = opts;
      
      // Load products and requests
      loadProducts();
      loadRequests();
    })
    .catch(err => console.error('Error loading collections:', err));
}

// Load Products
function loadProducts() {
  fetch('/api/products')
    .then(r => r.json())
    .then(products => {
      const tbody = document.getElementById('adminProductsTable');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (!Array.isArray(products)) return;
      products.forEach(p => {
        const catName = allCollections.find(c => c.id === p.collection_id)?.name || 'N/A';
        const safeP = encodeURIComponent(JSON.stringify(p));
        
        tbody.innerHTML += `
          <tr>
            <td><img src="${p.image_url}" alt="product"></td>
            <td>${p.name}</td>
            <td>₹${p.price}</td>
            <td>${catName}</td>
            <td>
              <button class="btn-action" onclick="openEditProduct('${safeP}')">Edit</button>
              <button class="btn-action btn-danger" onclick="deleteProduct(${p.id})">Delete</button>
            </td>
          </tr>
        `;
      });
    })
    .catch(err => console.error('Error loading products:', err));
}

// Image preview helper
function handleMultiFilePreview(inputEl, previewContainerId) {
  const container = document.getElementById(previewContainerId);
  if (!container) return;
  container.innerHTML = '';
  if (inputEl.files) {
    Array.from(inputEl.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.style.width = '60px';
        img.style.height = '60px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '6px';
        img.style.border = '1px solid var(--gold)';
        container.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }
}

document.getElementById('addImages')?.addEventListener('change', function() {
  handleMultiFilePreview(this, 'addImagePreview');
});

document.getElementById('editImages')?.addEventListener('change', function() {
  handleMultiFilePreview(this, 'editImagePreview');
});

// Add Product (Multiple images support)

function createColorVariantRow(containerId) {
  const container = document.getElementById(containerId);
  const row = document.createElement('div');
  row.className = 'color-variant-row';
  row.style.cssText = 'display: flex; flex-direction: column; gap: 10px; background: rgba(255,255,255,0.02); padding: 10px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.1); position: relative;';
  
  row.innerHTML = `
    <button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: #ff5252; cursor: pointer; font-weight: bold;">X</button>
    <div>
      <label style="color: var(--text-muted); display: block; margin-bottom: 5px; font-size: 0.9rem;">Color Name (e.g. Red)</label>
      <input type="text" class="var-name" placeholder="Color Name" style="width: 100%; padding: 8px; border-radius: 5px; border: none; background: rgba(0,0,0,0.5); color: white;" required>
    </div>
    <div>
      <label style="color: var(--text-muted); display: block; margin-bottom: 5px; font-size: 0.9rem;">Images for this Color</label>
      <input type="file" class="var-files" accept="image/*" multiple style="color: white; font-size: 0.85rem;" required>
    </div>
  `;
  container.appendChild(row);
}

document.getElementById('addColorVariantBtn')?.addEventListener('click', () => {
  createColorVariantRow('addColorVariantContainer');
});

document.getElementById('editColorVariantBtn')?.addEventListener('click', () => {
  createColorVariantRow('editColorVariantContainer');
});

document.getElementById('addProductForm').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const formData = new FormData();
  formData.append('name', document.getElementById('addName').value);
  formData.append('description', document.getElementById('addDesc').value);
  formData.append('price', document.getElementById('addPrice').value);
  formData.append('collection_id', document.getElementById('addCollection').value);
  formData.append('sizes', extractSizes('addSizeContainer'));
  
  
  const variants = document.querySelectorAll('#addColorVariantContainer .color-variant-row');
  if (variants.length === 0) return alert("Please add at least one color variant and its images.");
  
  let colorsArr = [];
  let fileCount = 0;
  
  variants.forEach(row => {
    const name = row.querySelector('.var-name').value.trim();
    const files = row.querySelector('.var-files').files;
    if (files.length > 0) {
      colorsArr.push({ name: name || 'Default', index: fileCount, count: files.length });
      for(let i = 0; i < files.length; i++) {
        formData.append('images', files[i]);
        fileCount++;
      }
    }
  });
  
  if (fileCount === 0) return alert("Please select images for your variants.");
  formData.append('colors', JSON.stringify(colorsArr));


  fetch('/api/admin/products', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData
  }).then(async r => {
    if (handleAuthError(r)) return;
    const res = await r.json();
    if(res.error) return alert(res.error);
    alert('Product uploaded successfully!');
    document.getElementById('addProductForm').reset();
    const addVariantCont = document.getElementById('addColorVariantContainer');
    if (addVariantCont) addVariantCont.innerHTML = '';
    loadProducts();
  }).catch(err => {
    console.error(err);
    alert('Upload failed. Please check image format and size (max 5MB each).');
  });
});

// Edit Product Open Modal
window.openEditProduct = (encodedProduct) => {
  const p = JSON.parse(decodeURIComponent(encodedProduct));
  document.getElementById('editId').value = p.id;
  document.getElementById('editName').value = p.name;
  document.getElementById('editDesc').value = p.description;
  document.getElementById('editPrice').value = p.price;
  document.getElementById('editCollection').value = p.collection_id || '';
  
  const variantCont = document.getElementById('editColorVariantContainer');
  if (variantCont) variantCont.innerHTML = '';

  const sizeCont = document.getElementById('editSizeContainer');
  if (sizeCont) sizeCont.innerHTML = '';
  let sizesArr = [];
  try { sizesArr = JSON.parse(p.sizes || '[]'); } catch(e) {}
  if (!Array.isArray(sizesArr)) sizesArr = [{ name: 'Default', stock: 10 }];
  sizesArr.forEach(s => {
    if (typeof s === 'object') createSizeRow('editSizeContainer', s.name, s.stock);
    else createSizeRow('editSizeContainer', s, 10);
  });
  
  document.getElementById('editProductModal').style.display = 'flex';
};

// Edit Product Submit (Multiple images support)
document.getElementById('editProductForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  
  const formData = new FormData();
  formData.append('name', document.getElementById('editName').value);
  formData.append('description', document.getElementById('editDesc').value);
  formData.append('price', document.getElementById('editPrice').value);
  formData.append('collection_id', document.getElementById('editCollection').value);
  formData.append('sizes', extractSizes('editSizeContainer'));
  
  
  const variants = document.querySelectorAll('#editColorVariantContainer .color-variant-row');
  if (variants.length > 0) {
    let colorsArr = [];
    let fileCount = 0;
    let validFiles = false;
    
    variants.forEach(row => {
      const name = row.querySelector('.var-name').value.trim();
      const files = row.querySelector('.var-files').files;
      if (files.length > 0) {
        validFiles = true;
        colorsArr.push({ name: name || 'Default', index: fileCount, count: files.length });
        for(let i = 0; i < files.length; i++) {
          formData.append('images', files[i]);
          fileCount++;
        }
      }
    });
    
    if (validFiles) {
      formData.append('colors', JSON.stringify(colorsArr));
    }
  }


  fetch('/api/admin/products/' + id, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: formData
  }).then(async r => {
    if (handleAuthError(r)) return;
    const res = await r.json();
    if(res.error) return alert(res.error);
    alert('Product updated successfully!');
    document.getElementById('editProductModal').style.display = 'none';
    loadProducts();
  }).catch(err => {
    console.error(err);
    alert('Update failed');
  });
});

// Delete Product
window.deleteProduct = (id) => {
  if(!confirm("Are you sure you want to delete this product?")) return;
  fetch('/api/admin/products/' + id, {
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(async r => {
    if (handleAuthError(r)) return;
    const res = await r.json();
    if(res.error) return alert(res.error);
    loadProducts();
  }).catch(err => {
    console.error(err);
    alert('Delete failed');
  });
};

// Load Requests (with Product Images, Badges, and Client Contact)
function loadRequests() {
  fetch('/api/admin/requests', {
    headers: getAuthHeaders()
  }).then(async r => {
    if (handleAuthError(r)) return;
    const reqs = await r.json();
    const tbody = document.getElementById('adminRequestsTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!Array.isArray(reqs)) return;

    // Update Notification Badge on Tab
    const pendingCount = reqs.filter(req => req.status === 'pending').length;
    const badge = document.getElementById('adminRequestsBadge');
    if (badge) {
      if (pendingCount > 0) {
        badge.innerText = pendingCount;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    reqs.forEach(r => {
      let statusBadge = r.status;
      if(r.status === 'pending') statusBadge = '<span style="color:#ff9800; font-weight:bold;">PENDING</span>';
      if(r.status === 'available') statusBadge = '<span style="color:#4caf50; font-weight:bold;">AVAILABLE (Awaiting Pay)</span>';
      if(r.status === 'paid') statusBadge = '<span style="color:#2196f3; font-weight:bold;">PAID (Processing)</span>';
      if(r.status === 'shipped') statusBadge = '<span style="color:#9c27b0; font-weight:bold;">SHIPPED / IN TRANSIT</span>';
      if(r.status === 'delivered') statusBadge = '<span style="color:#4caf50; font-weight:bold;">DELIVERED</span>';
      if(r.status === 'declined') statusBadge = '<span style="color:#f44336; font-weight:bold;">EXPIRED / DECLINED</span>';

      let cleanPhone = (r.user_phone || '').replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

      let waMsg = encodeURIComponent(`Hello ${r.user_name || 'Valued Client'},\n\nGreetings from AZ Fashion! ✨\nYour request for exclusive piece "${r.product_name}" (Size: ${r.size}) has been APPROVED and is reserved for you.\n⚠️ Note: This reservation is valid for 24 hours only.\n\nPlease visit our boutique website to complete your order:\n${window.location.origin}\n\nThank you!`);
      let waLink = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waMsg}` : '';

      let notifyBtn = '';
      if (waLink) {
        notifyBtn = `
          <a href="${waLink}" target="_blank" class="btn-action" style="background: #25D366; color: white; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 4px; font-size: 0.8rem; margin-top: 5px;" title="Send WhatsApp alert to client">
            <i class="fab fa-whatsapp"></i> WhatsApp Notify
          </a>
        `;
      }

      let actionBtns = '';
      if(r.status === 'pending') {
        actionBtns = `
          <div style="display: flex; gap: 5px; flex-wrap: wrap;">
            <button class="btn-action" onclick="approveRequest(${r.id}, '${cleanPhone}', '${encodeURIComponent(r.product_name || '')}', '${encodeURIComponent(r.user_name || '')}')">Approve</button>
            <button class="btn-action btn-danger" onclick="declineRequest(${r.id})">Decline</button>
          </div>
          ${notifyBtn}
        `;
      } else if (r.status === 'available') {
        actionBtns = notifyBtn;
      } else if (r.status === 'paid') {
        actionBtns = `
          <div style="display: flex; gap: 5px; flex-wrap: wrap;">
            <button class="btn-action" onclick="openTrackingModal(${r.id}, '${cleanPhone}', '${encodeURIComponent(r.product_name || '')}', '${encodeURIComponent(r.user_name || '')}')" style="background:#2196f3; border:none; color:white;">Add Tracking</button>
          </div>
        `;
      } else if (r.status === 'shipped') {
        const trackMatch = (r.color || '').match(/\| Courier: (.*?) \| Track: (.*)/);
        const courier = trackMatch ? trackMatch[1] : 'Courier';
        const trackId = trackMatch ? trackMatch[2] : 'N/A';
        const msg = encodeURIComponent(`Hello ${r.user_name || 'Client'},

Great news from AZ Fashion! ✨
Your order for "${r.product_name}" has been DISPATCHED.

🚚 Courier: ${courier}
📦 Tracking ID: ${trackId}

Track your package here: https://17track.net/en/track?nums=${trackId}

Estimated delivery is within 10 days. Thank you for choosing us!`);
        const waLinkTrack = cleanPhone ? `https://wa.me/${cleanPhone}?text=${msg}` : '';
        
        actionBtns = `
          <div style="display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 5px;">
            <button class="btn-action" onclick="markDelivered(${r.id})" style="background:#4caf50; border:none; color:white;">Mark Delivered</button>
          </div>
          <a href="${waLinkTrack}" target="_blank" class="btn-action" style="background: #25D366; color: white; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 4px; font-size: 0.8rem;" title="Send Tracking via WhatsApp">
            <i class="fab fa-whatsapp"></i> Send Tracking
          </a>
          <div style="font-size: 0.8rem; margin-top:5px; opacity: 0.8;">via ${courier} (#${trackId})</div>
        `;
      } else if (r.status === 'delivered') {
        actionBtns = `<span style="color:#4caf50; font-size: 0.85rem;"><i class="fas fa-check-circle"></i> Completed</span>`;
      }

      let imgSrc = r.image_url || '/images/col_daily.png';
      try {
        if (imgSrc.startsWith('[')) {
          const arr = JSON.parse(imgSrc);
          if (Array.isArray(arr) && arr.length > 0) imgSrc = arr[0];
        }
      } catch(e) {}

      tbody.innerHTML += `
        <tr>
          <td><img src="${imgSrc}" alt="Product" style="width: 55px; height: 70px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);"></td>
          <td>${new Date(r.created_at).toLocaleDateString()}</td>
          <td>
            <strong>${r.user_name || 'Client'}</strong>
            <br><small style="opacity:0.7">${r.user_email || ''}</small>
            ${r.user_phone ? `<br><small style="color:var(--gold);"><i class="fas fa-phone"></i> ${r.user_phone}</small>` : ''}
          </td>
          <td>${r.product_name} <br><small style="color:var(--gold);">₹${r.price}</small></td>
          <td>${r.size || 'N/A'}</td>
          <td>${statusBadge}</td>
          <td>${actionBtns}</td>
        </tr>
      `;
    });
  }).catch(err => console.error('Error loading requests:', err));
}

// Approve Request
window.approveRequest = (id, phone, prodName, userName) => {
  if(!confirm("Approve this request? The user will be able to checkout.")) return;
  fetch('/api/requests/' + id + '/approve', {
    method: 'POST',
    headers: getAuthHeaders()
  }).then(async r => {
    if (handleAuthError(r)) return;
    const res = await r.json();
    if(res.error) return alert(res.error);
    loadRequests();

    if (phone) {
      setTimeout(() => {
        if (confirm("Request approved! Would you like to send a WhatsApp notification to the client now?")) {
          const decodedProd = decodeURIComponent(prodName || 'your requested item');
          const decodedUser = decodeURIComponent(userName || 'Valued Client');
          const msg = encodeURIComponent(`Hello ${decodedUser},\n\nGreetings from AZ Fashion! ✨\nYour request for exclusive piece "${decodedProd}" has been APPROVED and is reserved for you.\n\nPlease visit our boutique website to complete your order:\n${window.location.origin}\n\nThank you!`);
          window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
        }
      }, 300);
    }
  }).catch(err => {
    console.error(err);
    alert('Approval failed');
  });
};

// Decline Request
window.declineRequest = (id) => {
  if(!confirm("Decline this request?")) return;
  fetch('/api/requests/' + id + '/decline', {
    method: 'POST',
    headers: getAuthHeaders()
  }).then(async r => {
    if (handleAuthError(r)) return;
    const res = await r.json();
    if(res.error) return alert(res.error);
    loadRequests();
  }).catch(err => {
    console.error(err);
    alert('Decline failed');
  });
};


// ========== REVIEWS MANAGEMENT ==========
function loadReviews() {
  fetch('/api/products')
    .then(r => r.json())
    .then(products => {
      const container = document.getElementById('adminReviewsList');
      if (!container) return;
      container.innerHTML = '';
      
      if (!Array.isArray(products)) return;
      
      // Filter products that have reviews
      const productsWithReviews = products.filter(p => {
        let reviews = [];
        try { reviews = typeof p.reviews === 'string' ? JSON.parse(p.reviews) : (p.reviews || []); } catch(e) {}
        return reviews.length > 0;
      });
      
      if (productsWithReviews.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color: rgba(255,255,255,0.5);"><i class="fas fa-star" style="font-size: 2rem; margin-bottom: 10px; display:block; opacity:0.3;"></i>No reviews yet</div>';
        return;
      }
      
      productsWithReviews.forEach(p => {
        let reviews = [];
        try { reviews = typeof p.reviews === 'string' ? JSON.parse(p.reviews) : (p.reviews || []); } catch(e) {}
        
        const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '0';
        
        let imgSrc = p.image_url || '/images/col_daily.png';
        try {
          if (imgSrc.startsWith('[')) {
            const arr = JSON.parse(imgSrc);
            if (Array.isArray(arr) && arr.length > 0) imgSrc = arr[0];
          }
        } catch(e) {}
        
        const stars = '★'.repeat(Math.round(avgRating)) + '☆'.repeat(5 - Math.round(avgRating));
        
        container.innerHTML += `
          <div onclick="openReviewsDetail(${p.id})" style="display: flex; align-items: center; gap: 15px; padding: 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; cursor: pointer; transition: all 0.3s ease; hover: transform: translateY(-2px);" onmouseover="this.style.borderColor='var(--gold)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.transform='none';">
            <img src="${imgSrc}" alt="${p.name}" style="width: 55px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; color: white; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</div>
              <div style="color: var(--gold); font-size: 0.9rem; letter-spacing: 2px;">${stars}</div>
              <div style="font-size: 0.8rem; color: rgba(255,255,255,0.5); margin-top: 2px;">${reviews.length} review${reviews.length !== 1 ? 's' : ''} · Avg: ${avgRating}/5</div>
            </div>
            <i class="fas fa-chevron-right" style="color: rgba(255,255,255,0.3); font-size: 0.9rem;"></i>
          </div>
        `;
      });
    })
    .catch(err => console.error('Error loading reviews:', err));
}

window.openReviewsDetail = (productId) => {
  fetch('/api/products')
    .then(r => r.json())
    .then(products => {
      const p = products.find(prod => prod.id === productId);
      if (!p) return;
      
      let reviews = [];
      try { reviews = typeof p.reviews === 'string' ? JSON.parse(p.reviews) : (p.reviews || []); } catch(e) {}
      
      document.getElementById('reviewsModalTitle').innerText = p.name + ' — Reviews';
      document.getElementById('reviewsModalSubtitle').innerText = reviews.length + ' review' + (reviews.length !== 1 ? 's' : '') + ' total';
      
      const list = document.getElementById('reviewsModalList');
      list.innerHTML = '';
      
      if (reviews.length === 0) {
        list.innerHTML = '<p style="color: rgba(255,255,255,0.5); text-align:center; padding: 20px;">No reviews for this product.</p>';
      } else {
        reviews.forEach((r, idx) => {
          const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
          list.innerHTML += `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 15px; background: rgba(255,255,255,0.04); border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                  <span style="font-weight: 600; color: var(--gold);">${r.user}</span>
                  <span style="color: #ffb300; font-size: 0.85rem; letter-spacing: 1px;">${stars}</span>
                </div>
                <div style="font-size: 0.9rem; color: rgba(255,255,255,0.8); line-height: 1.5;">${r.comment}</div>
              </div>
              <button onclick="deleteReview(${productId}, ${idx})" style="background: rgba(255,0,0,0.15); border: 1px solid rgba(255,0,0,0.3); color: #ff5252; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; flex-shrink: 0; margin-left: 12px; transition: 0.3s;" onmouseover="this.style.background='rgba(255,0,0,0.3)'" onmouseout="this.style.background='rgba(255,0,0,0.15)'" title="Delete this review">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          `;
        });
      }
      
      document.getElementById('reviewsDetailModal').style.display = 'flex';
    });
};

window.deleteReview = (productId, reviewIndex) => {
  if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) return;
  
  fetch('/api/admin/products/' + productId + '/reviews/' + reviewIndex, {
    method: 'DELETE',
    headers: getAuthHeaders()
  }).then(async r => {
    if (handleAuthError(r)) return;
    const res = await r.json();
    if (res.error) return alert(res.error);
    // Refresh both the detail modal and the reviews list
    openReviewsDetail(productId);
    loadReviews();
  }).catch(err => {
    console.error(err);
    alert('Failed to delete review.');
  });
};


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
      const msg = encodeURIComponent(`Hello ${decodedUser},

Great news from AZ Fashion! ✨
Your order for "${decodedProd}" has been DISPATCHED.

🚚 Courier: ${courier}
📦 Tracking ID: ${tracking_id}

Track your package here: https://17track.net/en/track?nums=${tracking_id}

Estimated delivery is within 10 days. Thank you for choosing us!`);
      window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
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
