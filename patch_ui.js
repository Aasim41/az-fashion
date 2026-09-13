const fs = require('fs');

// =============================
// UI IMPROVEMENTS
// =============================

let css = fs.readFileSync('frontend/style.css', 'utf8');

// 1. Add smooth scroll behavior globally
if (!css.includes('scroll-behavior: smooth')) {
  css = css.replace(
    'html {\n  width: 100%;\n  max-width: 100vw;\n  overflow-x: hidden !important;\n}',
    `html {
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden !important;
  scroll-behavior: smooth;
}`
  );
}

// 2. Add custom scrollbar styling for dark theme
if (!css.includes('Custom Scrollbar')) {
  css += `

/* ============ Custom Scrollbar ============ */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: #111; }
::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #c9a230; }

/* ============ Enhanced Product Card Hover ============ */
.product-card {
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
}
.product-card:hover {
  box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 20px rgba(212,175,55,0.15) !important;
}

/* ============ Better Button Hover Effects ============ */
.btn-solid, .button-submit, .menu-btn {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.btn-solid:hover, .button-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(212, 175, 55, 0.35);
}

/* ============ Improved Modal Animations ============ */
.glass-modal.active,
.modal-overlay[style*="display: flex"],
.collection-modal.active {
  animation: modalFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
@keyframes modalFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.glass-modal.active .modal-content,
.collection-modal.active .modal-content {
  animation: modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes modalSlideUp {
  from { transform: translateY(30px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* ============ Footer Links Polish ============ */
.footer-col a:not(.social-icon) {
  display: block;
  margin-bottom: 10px;
  transition: color 0.3s, transform 0.3s !important;
}
.footer-col a:not(.social-icon):hover {
  color: var(--gold) !important;
  transform: translateX(5px);
}

/* ============ Section Reveal Animation ============ */
.reveal {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}
.reveal.active {
  opacity: 1;
  transform: translateY(0);
}

/* ============ Selection Highlight ============ */
::selection {
  background: var(--gold);
  color: #000;
}

/* ============ Size Button Enhancement ============ */
.size-btn {
  transition: all 0.25s ease !important;
}
.size-btn:not(:disabled):hover {
  background: var(--gold) !important;
  color: #000 !important;
  transform: scale(1.05);
}
.size-btn.selected {
  box-shadow: 0 0 12px rgba(212, 175, 55, 0.4);
}

/* ============ Focus Outlines for Accessibility ============ */
button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--gold);
  outline-offset: 2px;
}
`;
}

fs.writeFileSync('frontend/style.css', css);
console.log('✓ style.css: UI enhancements applied');

// =============================
// Fix scroll-to-section nav clicks
// =============================
let mainJs = fs.readFileSync('frontend/main.js', 'utf8');

// Ensure nav radio buttons scroll properly
if (!mainJs.includes('glass-nav scroll handler enhanced')) {
  const oldNavHandler = `document.querySelectorAll('input[name="glass-nav"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const el = document.getElementById(radio.value);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });`;
  
  const newNavHandler = `// glass-nav scroll handler enhanced
  document.querySelectorAll('input[name="glass-nav"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const el = document.getElementById(radio.value);
      if (el) {
        const headerOffset = 100;
        const elementPosition = el.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });`;
  
  if (mainJs.includes(oldNavHandler)) {
    mainJs = mainJs.replace(oldNavHandler, newNavHandler);
  }
}

fs.writeFileSync('frontend/main.js', mainJs);
console.log('✓ main.js: Scroll navigation enhanced');

console.log('\n✅ All UI improvements applied');
