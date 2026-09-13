const fs = require('fs');
let content = fs.readFileSync('frontend/admin.js', 'utf8');

// We need to inject the Color Variant logic into admin.js
const variantLogic = `
function createColorVariantRow(containerId) {
  const container = document.getElementById(containerId);
  const row = document.createElement('div');
  row.className = 'color-variant-row';
  row.style.cssText = 'display: flex; flex-direction: column; gap: 10px; background: rgba(255,255,255,0.02); padding: 10px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.1); position: relative;';
  
  row.innerHTML = \`
    <button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: none; border: none; color: #ff5252; cursor: pointer; font-weight: bold;">X</button>
    <div>
      <label style="color: var(--text-muted); display: block; margin-bottom: 5px; font-size: 0.9rem;">Color Name (e.g. Red)</label>
      <input type="text" class="var-name" placeholder="Color Name" style="width: 100%; padding: 8px; border-radius: 5px; border: none; background: rgba(0,0,0,0.5); color: white;" required>
    </div>
    <div>
      <label style="color: var(--text-muted); display: block; margin-bottom: 5px; font-size: 0.9rem;">Images for this Color</label>
      <input type="file" class="var-files" accept="image/*" multiple style="color: white; font-size: 0.85rem;" required>
    </div>
  \`;
  container.appendChild(row);
}

document.getElementById('addColorVariantBtn')?.addEventListener('click', () => {
  createColorVariantRow('addColorVariantContainer');
});

document.getElementById('editColorVariantBtn')?.addEventListener('click', () => {
  createColorVariantRow('editColorVariantContainer');
});
`;

if (!content.includes('createColorVariantRow')) {
  // Insert before addProductForm submit
  content = content.replace(
    "document.getElementById('addProductForm').addEventListener('submit', (e) => {", 
    variantLogic + "\ndocument.getElementById('addProductForm').addEventListener('submit', (e) => {"
  );
  
  // Replace Add Product Logic
  const addRegex = /const colorsVal = document\.getElementById\('addColors'\)\.value;\s*formData\.append\('colors', colorsVal\);\s*const files = document\.getElementById\('addImages'\)\.files;\s*if \(!files \|\| files\.length === 0\) \{\s*return alert\("Please select at least one product image\."\);\s*\}\s*for \(let i = 0; i < files\.length; i\+\+\) \{\s*formData\.append\('images', files\[i\]\);\s*\}/s;
  
  const addReplacement = `
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
`;
  content = content.replace(addRegex, addReplacement);

  // Replace Edit Product populate
  const editPopulateRegex = /if \(p\.colors && Array\.isArray\(p\.colors\)\) \{.*?\}\s*document\.getElementById\('editImages'\)\.value = '';.*?innerHTML = '';/s;
  const editPopulateReplacement = `
  const variantCont = document.getElementById('editColorVariantContainer');
  if (variantCont) variantCont.innerHTML = '';
`;
  content = content.replace(editPopulateRegex, editPopulateReplacement);

  // Replace Edit Product Submit
  const editSubmitRegex = /const colorsVal = document\.getElementById\('editColors'\)\.value;\s*formData\.append\('colors', colorsVal\);\s*const files = document\.getElementById\('editImages'\)\.files;\s*if \(files && files\.length > 0\) \{\s*for \(let i = 0; i < files\.length; i\+\+\) \{\s*formData\.append\('images', files\[i\]\);\s*\}\s*\}/s;
  
  const editSubmitReplacement = `
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
`;
  content = content.replace(editSubmitRegex, editSubmitReplacement);
  
  fs.writeFileSync('frontend/admin.js', content);
  console.log('admin.js updated successfully!');
} else {
  console.log('Already updated.');
}
