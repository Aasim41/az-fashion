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

function showAdminDashboard() {
  document.getElementById('adminLogin').style.display = 'none';
  document.getElementById('adminDashboard').style.display = 'flex';
  loadCollections();
}

window.logoutAdmin = () => {
  sessionStorage.removeItem('az_admin_token');
  document.getElementById('adminDashboard').style.display = 'none';
  document.getElementById('adminLogin').style.display = 'flex';
};

// Check if admin is already logged in
if (sessionStorage.getItem('az_admin_token')) {
  showAdminDashboard();
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
    document.getElementById('tab-' + btn.getAttribute('data-tab')).style.display = 'block';
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

// Add Product
document.getElementById('addProductForm').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const formData = new FormData();
  formData.append('name', document.getElementById('addName').value);
  formData.append('description', document.getElementById('addDesc').value);
  formData.append('price', document.getElementById('addPrice').value);
  formData.append('collection_id', document.getElementById('addCollection').value);
  formData.append('sizes', document.getElementById('addSizes').value);
  formData.append('image', document.getElementById('addImage').files[0]);

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
    loadProducts();
  }).catch(err => {
    console.error(err);
    alert('Upload failed. Please check image format and size (max 5MB).');
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
  document.getElementById('editImage').value = ''; // Reset file input
  
  document.getElementById('editProductModal').style.display = 'flex';
};

// Edit Product Submit
document.getElementById('editProductForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  
  const formData = new FormData();
  formData.append('name', document.getElementById('editName').value);
  formData.append('description', document.getElementById('editDesc').value);
  formData.append('price', document.getElementById('editPrice').value);
  formData.append('collection_id', document.getElementById('editCollection').value);
  formData.append('sizes', document.getElementById('editSizes').value);
  
  const imageFile = document.getElementById('editImage').files[0];
  if(imageFile) {
    formData.append('image', imageFile);
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

// Load Requests
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
    reqs.forEach(r => {
      let statusBadge = r.status;
      if(r.status === 'pending') statusBadge = '<span style="color:#ff9800;">PENDING</span>';
      if(r.status === 'available') statusBadge = '<span style="color:#4caf50;">AVAILABLE (Awaiting Payment)</span>';
      if(r.status === 'paid') statusBadge = '<span style="color:#2196f3;">PAID (Order Placed)</span>';
      if(r.status === 'declined') statusBadge = '<span style="color:#f44336;">DECLINED</span>';

      let actionBtns = '';
      if(r.status === 'pending') {
        actionBtns = `
          <button class="btn-action" onclick="approveRequest(${r.id})">Approve</button>
          <button class="btn-action btn-danger" onclick="declineRequest(${r.id})">Decline</button>
        `;
      }

      tbody.innerHTML += `
        <tr>
          <td>${new Date(r.created_at).toLocaleDateString()}</td>
          <td>${r.user_name || 'Client'} <br> <small style="opacity:0.7">${r.user_email || ''}</small></td>
          <td>${r.product_name}</td>
          <td>${r.size || 'N/A'}</td>
          <td>${statusBadge}</td>
          <td>${actionBtns}</td>
        </tr>
      `;
    });
  }).catch(err => console.error('Error loading requests:', err));
}

// Approve Request
window.approveRequest = (id) => {
  if(!confirm("Approve this request? The user will be able to checkout.")) return;
  fetch('/api/requests/' + id + '/approve', {
    method: 'POST',
    headers: getAuthHeaders()
  }).then(async r => {
    if (handleAuthError(r)) return;
    const res = await r.json();
    if(res.error) return alert(res.error);
    loadRequests();
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
