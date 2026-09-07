const fs = require('fs');

let code = fs.readFileSync('frontend/main.js', 'utf8');

const filterCode = `
// Global Search & Filter
document.getElementById('applyFiltersBtn')?.addEventListener('click', () => {
  const search = document.getElementById('filterSearch').value.trim();
  const size = document.getElementById('filterSize').value;
  const minPrice = document.getElementById('filterMinPrice').value;
  const maxPrice = document.getElementById('filterMaxPrice').value;
  
  if (!search && !size && !minPrice && !maxPrice) {
    showToast('Please enter a search term or filter.', 'error');
    return;
  }

  // Construct query string
  let qs = '?';
  if (search) qs += \`search=\${encodeURIComponent(search)}&\`;
  if (size) qs += \`size=\${encodeURIComponent(size)}&\`;
  if (minPrice) qs += \`min_price=\${minPrice}&\`;
  if (maxPrice) qs += \`max_price=\${maxPrice}&\`;

  fetch(\`/api/products\${qs}\`)
    .then(r => r.json())
    .then(products => {
      document.getElementById('modalCollectionName').textContent = 'Search Results';
      document.getElementById('modalCollectionDesc').textContent = \`Found \${products.length} products matching your criteria.\`;
      const grid = document.getElementById('modalProductsGrid');
      grid.innerHTML = '';
      if (products.length === 0) {
         grid.innerHTML = '<p style="color:white;text-align:center;width:100%;">No products found.</p>';
      } else {
         products.forEach((prod, index) => {
          const card = document.createElement('div');
          card.className = 'product-card reveal';
          card.style.animationDelay = (index * 0.1) + 's';
          card.innerHTML = \`
            <div class="product-image"><img src="\${prod.image_url}" alt="\${prod.name}"></div>
            <div class="product-info">
              <h3 class="product-title">\${prod.name}</h3>
              <div class="product-price">₹\${prod.price}</div>
            </div>
          \`;
          card.onclick = () => {
            window.openProductModal(prod);
          };
          grid.appendChild(card);
        });
      }
      document.getElementById('collectionModal').classList.add('active');
    })
    .catch(err => console.error(err));
});
`;

code = code.replace(/document\.addEventListener\('DOMContentLoaded', \(\) => \{/, "document.addEventListener('DOMContentLoaded', () => {\n" + filterCode);

const oldSizes = `    const pdSizes = document.getElementById('pdSizes');
    pdSizes.innerHTML = '';
    const sizesArr = typeof prod.sizes === 'string' ? JSON.parse(prod.sizes || '[]') : (prod.sizes || []);
    if (sizesArr.length > 0) {
      sizesArr.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'size-btn';
        btn.textContent = s;
        btn.onclick = () => {
          document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedSize = s;
        };
        pdSizes.appendChild(btn);
      });
    } else {`;

const newSizes = `    const pdSizes = document.getElementById('pdSizes');
    pdSizes.innerHTML = '';
    const sizesArr = typeof prod.sizes === 'string' ? JSON.parse(prod.sizes || '[]') : (prod.sizes || []);
    if (sizesArr.length > 0) {
      sizesArr.forEach(sObj => {
        // Support both old string format and new object format {name, stock}
        const sName = typeof sObj === 'object' ? sObj.name : sObj;
        const sStock = typeof sObj === 'object' ? sObj.stock : 10; // Default if old format
        
        const btn = document.createElement('button');
        btn.className = 'size-btn';
        btn.innerHTML = \`\${sName} \${sStock <= 0 ? '<span style="font-size:0.6rem;display:block;opacity:0.5;color:#ff4d4d">Out of Stock</span>' : ''}\`;
        
        if (sStock <= 0) {
          btn.disabled = true;
          btn.style.opacity = '0.4';
          btn.style.cursor = 'not-allowed';
          btn.style.borderColor = 'rgba(255,0,0,0.3)';
        } else {
          btn.onclick = () => {
            document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedSize = sName;
          };
        }
        pdSizes.appendChild(btn);
      });
    } else {`;

code = code.replace(oldSizes, newSizes);

fs.writeFileSync('frontend/main.js', code);
