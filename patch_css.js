const fs = require('fs');

// 1. Ensure .modal-overlay CSS exists in admin.css so it works on the admin dashboard
let adminCss = fs.readFileSync('frontend/admin.css', 'utf8');
if (!adminCss.includes('.modal-overlay')) {
  adminCss += `
/* Modals styling for admin */
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  z-index: 999999;
  display: none;
  align-items: center;
  justify-content: center;
}
.modal-content {
  background: #1a1a1a;
  max-width: 550px;
  width: 92%;
  border: 1px solid var(--gold);
  border-radius: 12px;
  padding: 25px;
  position: relative;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}
.close-modal {
  position: absolute;
  top: 15px;
  right: 15px;
  background: none;
  border: none;
  color: white;
  font-size: 1.2rem;
  cursor: pointer;
  transition: color 0.3s;
}
.close-modal:hover {
  color: var(--gold);
}
`;
  fs.writeFileSync('frontend/admin.css', adminCss);
  console.log('Added modal-overlay to admin.css');
}

// 2. Just in case, add it to style.css as well
let styleCss = fs.readFileSync('frontend/style.css', 'utf8');
if (!styleCss.includes('modal-overlay {') && !styleCss.includes('modal-overlay{')) {
  styleCss += `
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(0,0,0,0.85);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  z-index: 999999;
  display: none;
  align-items: center;
  justify-content: center;
}
`;
  fs.writeFileSync('frontend/style.css', styleCss);
  console.log('Added modal-overlay to style.css');
}
