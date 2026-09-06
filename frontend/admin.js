function getAuthHeaders() {
  const token = sessionStorage.getItem('az_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function handleAuthError(res) {
  if (res.status === 401 || res.status === 403) {
    sessionStorage.removeItem('az_admin_token');
    alert('Admin session expired or unauthorized. Please log in.');
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('adminLogin').style.display = 'flex';
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
  adminPollerTimer = setInterval(checkNewRequests, 12000); // Check every 12 seconds
}

function checkNewRequests() {
  if (!sessionStorage.getItem('az_admin_token')) return;

  fetch('/api/admin/requests', {
    headers: getAuthHeaders()
  }).then(async r => {
    if (r.status === 401 || r.status === 403) return;
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

// Tab Navigation
document.querySelectorAll('.admin-nav-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
    
    btn.classList.add('active');
    const tabName = btn.getAttribute('data-tab');
    document.getElementById('tab-' + tabName).style.display = 'block';
    if (tabName === 'requests') {
      loadRequests();
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
document.getElementById('addProductForm').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const formData = new FormData();
  formData.append('name', document.getElementById('addName').value);
  formData.append('description', document.getElementById('addDesc').value);
  formData.append('price', document.getElementById('addPrice').value);
  formData.append('collection_id', document.getElementById('addCollection').value);
  formData.append('sizes', document.getElementById('addSizes').value);
  
  const files = document.getElementById('addImages').files;
  if (!files || files.length === 0) {
    return alert("Please select at least one product image.");
  }
  for (let i = 0; i < files.length; i++) {
    formData.append('images', files[i]);
  }

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
    document.getElementById('addImagePreview').innerHTML = '';
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
  document.getElementById('editSizes').value = (p.sizes || []).join(', ');
  document.getElementById('editImages').value = ''; // Reset file input
  document.getElementById('editImagePreview').innerHTML = '';
  
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
  formData.append('sizes', document.getElementById('editSizes').value);
  
  const files = document.getElementById('editImages').files;
  if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
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
      if(r.status === 'paid') statusBadge = '<span style="color:#2196f3; font-weight:bold;">PAID (Order Confirmed)</span>';
      if(r.status === 'declined') statusBadge = '<span style="color:#f44336; font-weight:bold;">DECLINED</span>';

      let cleanPhone = (r.user_phone || '').replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

      let waMsg = encodeURIComponent(`Hello ${r.user_name || 'Valued Client'},\n\nGreetings from AZ Fashion! ✨\nYour request for exclusive piece "${r.product_name}" (Size: ${r.size}) has been APPROVED and is reserved for you.\n\nPlease visit our boutique website to complete your order:\n${window.location.origin}\n\nThank you!`);
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
