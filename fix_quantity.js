const fs = require('fs');

let main = fs.readFileSync('frontend/main.js', 'utf8');

// 1. Add global quantity variable
if (!main.includes("let selectedQuantity = 1;")) {
  main = main.replace(
    "let selectedColor = null;",
    "let selectedColor = null;\n  let selectedQuantity = 1;"
  );
}

// 2. Fix the size rendering logic in openProductDetails
main = main.replace(
  /const sizesContainer = document\.getElementById\('pdSizes'\);\s+sizesContainer\.innerHTML = '';\s+\(prod\.sizes \|\| \[\]\)\.forEach\(size => {[\s\S]*?sizesContainer\.appendChild\(btn\);\s+}\);/,
  `const sizesContainer = document.getElementById('pdSizes');
    sizesContainer.innerHTML = '';
    (prod.sizes || []).forEach(sizeObj => {
      const sizeName = typeof sizeObj === 'object' ? sizeObj.name : sizeObj;
      const sizeStock = typeof sizeObj === 'object' ? sizeObj.stock : 10;
      
      const btn = document.createElement('button');
      btn.className = 'size-btn';
      btn.innerText = sizeName;
      if (sizeStock <= 0) {
        btn.disabled = true;
        btn.style.opacity = '0.4';
        btn.style.cursor = 'not-allowed';
        btn.innerText += ' (Out of stock)';
      }
      btn.onclick = () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedSize = sizeName;
      };
      sizesContainer.appendChild(btn);
    });

    // Handle Quantity UI
    selectedQuantity = 1;
    const qtyInput = document.getElementById('qtyInput');
    const qtyMinus = document.getElementById('qtyMinus');
    const qtyPlus = document.getElementById('qtyPlus');
    if (qtyInput) qtyInput.value = 1;
    
    if (qtyMinus && qtyPlus) {
      qtyMinus.onclick = () => {
        if (selectedQuantity > 1) {
          selectedQuantity--;
          qtyInput.value = selectedQuantity;
        }
      };
      qtyPlus.onclick = () => {
        // Find stock of selected size to enforce max quantity
        let maxStock = 10;
        if (selectedSize) {
          const sObj = (prod.sizes || []).find(s => (typeof s === 'object' ? s.name : s) === selectedSize);
          if (sObj && typeof sObj === 'object') maxStock = sObj.stock;
        }
        if (selectedQuantity < maxStock) {
          selectedQuantity++;
          qtyInput.value = selectedQuantity;
        } else {
          alert('Maximum available stock for this size is ' + maxStock);
        }
      };
    }`
);

// 3. Submit Request to include Quantity
main = main.replace(
  "size: selectedSize,",
  "size: selectedQuantity > 1 ? `${selectedSize} | Qty: ${selectedQuantity}` : selectedSize,"
);

// 4. Fix total price calculation in checkout modal
main = main.replace(
  "let cartTotal = 0;",
  `let cartTotal = 0;
    const qtyMatch = Array.from(checkoutSet).map(id => pendingReqs.find(r => r.id === id)).map(r => r ? (r.size.match(/\\| Qty: (\\d+)/) ? parseInt(r.size.match(/\\| Qty: (\\d+)/)[1], 10) : 1) : 1);`
);

// Actually, it's better to patch the specific checkout price logic
main = main.replace(
  "const finalPrice = req.price;",
  `const qtyMatch = req.size.match(/\\| Qty: (\\d+)/);
            const reqQty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
            const finalPrice = req.price * reqQty;`
);

// And the Razorpay amount calculation
main = main.replace(
  "amount: cartTotal",
  "amount: cartTotal"
);

fs.writeFileSync('frontend/main.js', main);
console.log("main.js patched with quantity and object rendering fixes");


// Server.js - Fix stock deduction
let server = fs.readFileSync('backend/server.js', 'utf8');

server = server.replace(
  /sizesArr = sizesArr\.map\(s => \{\s+if \(s\.name === r\.size\) \{\s+modified = true;\s+return \{ \.\.\.s, stock: Math\.max\(0, s\.stock - 1\) \};\s+\}\s+return s;\s+\}\);/,
  `const sizeName = r.size.split(' | Qty: ')[0];
                  const qtyMatch = r.size.match(/\\| Qty: (\\d+)/);
                  const reqQty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
                  
                  sizesArr = sizesArr.map(s => {
                    if (s.name === sizeName) {
                      modified = true;
                      return { ...s, stock: Math.max(0, s.stock - reqQty) };
                    }
                    return s;
                  });`
);

fs.writeFileSync('backend/server.js', server);
console.log("server.js patched for multi-quantity stock deduction");

