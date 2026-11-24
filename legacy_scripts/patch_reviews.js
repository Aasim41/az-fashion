const fs = require('fs');

// =============================
// 1. BACKEND: Add DELETE review endpoint
// =============================
let server = fs.readFileSync('backend/server.js', 'utf8');

if (!server.includes('/api/admin/products/:id/reviews/:index')) {
  const deleteReviewEndpoint = `
// 22. Admin: Delete Review
app.delete('/api/admin/products/:id/reviews/:index', authenticateAdmin, async (req, res) => {
  try {
    const { id, index } = req.params;
    const idx = parseInt(index, 10);
    
    const { data: prod, error } = await supabase.from('products').select('reviews').eq('id', id).single();
    if (error || !prod) return res.status(404).json({ error: 'Product not found' });
    
    let reviews = [];
    try {
      reviews = typeof prod.reviews === 'string' ? JSON.parse(prod.reviews) : (prod.reviews || []);
    } catch(e) {}
    
    if (idx < 0 || idx >= reviews.length) return res.status(400).json({ error: 'Invalid review index' });
    
    reviews.splice(idx, 1);
    
    await supabase.from('products').update({ reviews: JSON.stringify(reviews) }).eq('id', id);
    res.json({ message: 'Review deleted', reviews });
  } catch (err) {
    console.error('Error deleting review:', err);
    res.status(500).json({ error: err.message });
  }
});
`;
  // Insert before the Razorpay section
  server = server.replace('// 19. Admin: Mark Shipped', deleteReviewEndpoint + '\n// 19. Admin: Mark Shipped');
  fs.writeFileSync('backend/server.js', server);
  console.log('✓ server.js: Added DELETE review endpoint');
}

// =============================
// 2. ADMIN.HTML: Add Reviews tab nav button + Reviews tab content + Reviews modal
// =============================
let adminHtml = fs.readFileSync('frontend/admin.html', 'utf8');

// Add Reviews nav button (after Requests & Orders button, before Notifications)
if (!adminHtml.includes('data-tab="reviews"')) {
  adminHtml = adminHtml.replace(
    `<button id="adminNotifBtn"`,
    `<button class="admin-nav-btn" data-tab="reviews"><i class="fas fa-star" style="margin-right:8px;"></i>Reviews</button>
      <button id="adminNotifBtn"`
  );

  // Add Reviews tab content (before closing admin-content div)
  const reviewsTabHtml = `
      <!-- Reviews Tab -->
      <div id="tab-reviews" class="admin-tab" style="display: none;">
        <h2 style="margin-bottom: 20px; color: var(--gold);"><i class="fas fa-star" style="margin-right: 10px;"></i>Product Reviews</h2>
        <p style="margin-bottom: 20px; color: rgba(255,255,255,0.7); font-size: 0.9rem;">Manage all customer reviews. Click on a product to view and delete individual reviews.</p>
        <div id="adminReviewsList" style="display: flex; flex-direction: column; gap: 15px;"></div>
      </div>
`;
  adminHtml = adminHtml.replace('    </div>\n  </div>\n\n  <!-- Edit Product Modal -->', reviewsTabHtml + '    </div>\n  </div>\n\n  <!-- Edit Product Modal -->');

  // Add Reviews Detail Modal
  const reviewsModalHtml = `
  <!-- Reviews Detail Modal -->
  <div id="reviewsDetailModal" class="modal-overlay" style="display: none; align-items:center; justify-content:center;">
    <div class="modal-content admin-modal" style="background:#1a1a1a; max-width:550px; width:92%; border:1px solid var(--gold); border-radius:12px; padding:25px; position:relative; max-height: 80vh; overflow-y: auto;">
      <button type="button" class="close-modal" onclick="document.getElementById('reviewsDetailModal').style.display='none'" style="position:absolute; top:15px; right:15px; background:none; border:none; color:white; font-size:1.2rem; cursor:pointer;"><i class="fas fa-times"></i></button>
      <h3 id="reviewsModalTitle" style="color: var(--gold); margin-bottom: 5px; font-family:var(--font-serif); font-size:1.4rem;">Product Reviews</h3>
      <p id="reviewsModalSubtitle" style="color: rgba(255,255,255,0.5); font-size: 0.85rem; margin-bottom: 20px;"></p>
      <div id="reviewsModalList" style="display: flex; flex-direction: column; gap: 12px;"></div>
    </div>
  </div>
`;
  adminHtml = adminHtml.replace('</body>', reviewsModalHtml + '\n</body>');
  
  fs.writeFileSync('frontend/admin.html', adminHtml);
  console.log('✓ admin.html: Added Reviews tab + modal');
}


// =============================
// 3. ADMIN.JS: Add reviews loading, detail modal, and delete logic
// =============================
let adminJs = fs.readFileSync('frontend/admin.js', 'utf8');

if (!adminJs.includes('loadReviews')) {
  const reviewsCode = `

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
        
        container.innerHTML += \`
          <div onclick="openReviewsDetail(\${p.id})" style="display: flex; align-items: center; gap: 15px; padding: 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; cursor: pointer; transition: all 0.3s ease; hover: transform: translateY(-2px);" onmouseover="this.style.borderColor='var(--gold)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.transform='none';">
            <img src="\${imgSrc}" alt="\${p.name}" style="width: 55px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 600; color: white; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">\${p.name}</div>
              <div style="color: var(--gold); font-size: 0.9rem; letter-spacing: 2px;">\${stars}</div>
              <div style="font-size: 0.8rem; color: rgba(255,255,255,0.5); margin-top: 2px;">\${reviews.length} review\${reviews.length !== 1 ? 's' : ''} · Avg: \${avgRating}/5</div>
            </div>
            <i class="fas fa-chevron-right" style="color: rgba(255,255,255,0.3); font-size: 0.9rem;"></i>
          </div>
        \`;
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
          list.innerHTML += \`
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 15px; background: rgba(255,255,255,0.04); border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                  <span style="font-weight: 600; color: var(--gold);">\${r.user}</span>
                  <span style="color: #ffb300; font-size: 0.85rem; letter-spacing: 1px;">\${stars}</span>
                </div>
                <div style="font-size: 0.9rem; color: rgba(255,255,255,0.8); line-height: 1.5;">\${r.comment}</div>
              </div>
              <button onclick="deleteReview(\${productId}, \${idx})" style="background: rgba(255,0,0,0.15); border: 1px solid rgba(255,0,0,0.3); color: #ff5252; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; flex-shrink: 0; margin-left: 12px; transition: 0.3s;" onmouseover="this.style.background='rgba(255,0,0,0.3)'" onmouseout="this.style.background='rgba(255,0,0,0.15)'" title="Delete this review">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          \`;
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
`;
  adminJs += reviewsCode;
  
  // Also hook loadReviews into the tab switching
  adminJs = adminJs.replace(
    "btn.classList.add('active');",
    `btn.classList.add('active');
    if (btn.dataset.tab === 'reviews') loadReviews();`
  );
  
  fs.writeFileSync('frontend/admin.js', adminJs);
  console.log('✓ admin.js: Added reviews management');
}

console.log('\n✅ All review management patches applied successfully');
