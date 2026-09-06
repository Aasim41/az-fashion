document.getElementById('adminLoginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const pass = document.getElementById('adminPass').value;
  if (pass === 'admin123') { // Hardcoded for prototype
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'flex';
    loadProducts();
    loadRequests();
  } else {
    alert("Invalid admin password");
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
      addSelect.innerHTML = opts;
      editSelect.innerHTML = opts;
      
      // Load products only after collections are ready
      loadProducts();
    });
}
loadCollections();

// Load Products
function loadProducts() {
  fetch('/api/products')
    .then(r => r.json())
    .then(products => {
      const tbody = document.getElementById('adminProductsTable');
      tbody.innerHTML = '';
      products.forEach(p => {
        const catName = allCollections.find(c => c.id === p.collection_id)?.name || 'N/A';
        // Need to escape data for the edit button
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
    });
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
    body: formData
  }).then(r => r.json()).then(res => {
    if(res.error) return alert(res.error);
    alert('Product uploaded successfully!');
    document.getElementById('addProductForm').reset();
    loadProducts();
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
    body: formData
  }).then(r => r.json()).then(res => {
    if(res.error) return alert(res.error);
    alert('Product updated successfully!');
    document.getElementById('editProductModal').style.display = 'none';
    loadProducts();
  });
});

// Delete Product
window.deleteProduct = (id) => {
  if(!confirm("Are you sure you want to delete this product?")) return;
  fetch('/api/admin/products/' + id, { method: 'DELETE' })
    .then(r => r.json()).then(res => {
      if(res.error) return alert(res.error);
      loadProducts();
    });
};

// Load Requests
function loadRequests() {
  fetch('/api/admin/requests')
    .then(r => r.json())
    .then(reqs => {
      const tbody = document.getElementById('adminRequestsTable');
      tbody.innerHTML = '';
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
            <td>${r.user_name} <br> <small style="opacity:0.7">${r.user_email}</small></td>
            <td>${r.product_name}</td>
            <td>${r.size}</td>
            <td>${statusBadge}</td>
            <td>${actionBtns}</td>
          </tr>
        `;
      });
    });
}

// Approve Request
window.approveRequest = (id) => {
  if(!confirm("Approve this request? The user will be able to checkout.")) return;
  fetch('/api/requests/' + id + '/approve', { method: 'POST' })
    .then(r => r.json()).then(res => {
      if(res.error) return alert(res.error);
      loadRequests();
    });
}

// Decline Request
window.declineRequest = (id) => {
  if(!confirm("Decline this request?")) return;
  fetch('/api/requests/' + id + '/decline', { method: 'POST' })
    .then(r => r.json()).then(res => {
      if(res.error) return alert(res.error);
      loadRequests();
    });
}
