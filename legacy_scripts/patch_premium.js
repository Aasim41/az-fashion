const fs = require('fs');

// =============================
// PREMIUM CSS ENHANCEMENTS
// =============================
let css = fs.readFileSync('frontend/style.css', 'utf8');

// 1. Hero slide transitions — cinematic crossfade + slow zoom (Ken Burns effect)
css = css.replace(
  '.hero-slide {\n  position: absolute; top:0; left:0; width: 100%; height: 100%;\n  opacity: 0;\n  transition: opacity 1.5s ease-in-out;\n}\n.hero-slide.active { opacity: 1; z-index: 1; }\n.hero-bg-img {\n  width: 100%; height: 100%; object-fit: contain; background-color: #070707;\n  transform: scale(1.05);\n}',
  `.hero-slide {
  position: absolute; top:0; left:0; width: 100%; height: 100%;
  opacity: 0;
  transition: opacity 2s cubic-bezier(0.4, 0, 0.2, 1);
}
.hero-slide.active { opacity: 1; z-index: 1; }
.hero-slide.active .hero-bg-img {
  animation: kenBurns 12s ease-in-out infinite alternate;
}
@keyframes kenBurns {
  0% { transform: scale(1.0); }
  100% { transform: scale(1.08); }
}
.hero-bg-img {
  width: 100%; height: 100%; object-fit: cover; background-color: #070707;
  transform: scale(1.02);
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}`
);

// 2. Hero overlay — more cinematic gradient with side vignette
css = css.replace(
  `.hero-overlay {
  position: absolute; top:0; left:0; width:100%; height:100%;
  background: linear-gradient(180deg, rgba(7,7,7,0.4) 0%, rgba(7,7,7,1) 100%);
  z-index: 2;
}`,
  `.hero-overlay {
  position: absolute; top:0; left:0; width:100%; height:100%;
  background: 
    linear-gradient(180deg, rgba(7,7,7,0.2) 0%, rgba(7,7,7,0.05) 40%, rgba(7,7,7,0.7) 75%, rgba(7,7,7,1) 100%),
    radial-gradient(ellipse at center, transparent 50%, rgba(7,7,7,0.5) 100%);
  z-index: 2;
}`
);

// 3. Product cards — premium glass morphism + sharper images
css = css.replace(
  `.product-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 5px;
  overflow: hidden;
  transition: transform 0.3s ease, background 0.3s ease;
}`,
  `.product-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.5s cubic-bezier(0.23, 1, 0.32, 1), background 0.4s ease, box-shadow 0.5s ease, border-color 0.4s ease;
  will-change: transform;
}`
);

css = css.replace(
  `.product-card:hover {
  transform: translateY(-5px);
  background: rgba(255,255,255,0.08);
}`,
  `.product-card:hover {
  transform: translateY(-8px);
  background: rgba(255,255,255,0.06);
  border-color: rgba(212, 175, 55, 0.2);
  box-shadow: 0 25px 50px rgba(0,0,0,0.4), 0 0 0 1px rgba(212,175,55,0.1);
}`
);

// 4. Product images — better rendering quality  
css = css.replace(
  `.product-img-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.7s ease;
}`,
  `.product-img-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  image-rendering: -webkit-optimize-contrast;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}`
);

// 5. Collection cards — premium hover glow
css = css.replace(
  '.collection-card-3d img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }',
  `.collection-card-3d img {
  width: 100%; height: 100%; object-fit: cover;
  transition: transform 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  image-rendering: -webkit-optimize-contrast;
}
.collection-card-3d:hover img { transform: scale(1.04); }
.collection-card-3d::after {
  content: '';
  position: absolute; inset: 0;
  border-radius: 10px;
  border: 1px solid transparent;
  transition: border-color 0.5s ease, box-shadow 0.5s ease;
  pointer-events: none;
  z-index: 5;
}
.collection-card-3d:hover::after {
  border-color: rgba(212, 175, 55, 0.3);
  box-shadow: 0 30px 60px rgba(0,0,0,0.5), inset 0 0 30px rgba(212,175,55,0.05);
}`
);

// 6. Lookbook items — better image rendering
css = css.replace(
  `.slider-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}
.slider-item:hover img {
  transform: scale(1.03);
}`,
  `.slider-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  image-rendering: -webkit-optimize-contrast;
}
.slider-item:hover img {
  transform: scale(1.04);
}
.slider-item {
  border-radius: 12px !important;
  box-shadow: 0 15px 40px rgba(0,0,0,0.3);
  transition: box-shadow 0.5s ease, transform 0.5s ease;
}
.slider-item:hover {
  box-shadow: 0 25px 50px rgba(0,0,0,0.5);
}`
);

// 7. Modal content — smoother backdrop + premium glass effect
css = css.replace(
  `.glass-modal {
  position: fixed; top:0; left:0; width:100vw; height:100vh;
  background: rgba(0,0,0,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  z-index: 500000;
  display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.4s ease;`,
  `.glass-modal {
  position: fixed; top:0; left:0; width:100vw; height:100vh;
  background: rgba(0,0,0,0.88); backdrop-filter: blur(25px) saturate(180%); -webkit-backdrop-filter: blur(25px) saturate(180%);
  z-index: 500000;
  display: flex; justify-content: center; align-items: center; opacity: 0; pointer-events: none; transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);`
);

// 8. Onboarding — premium blur
css = css.replace(
  'filter: brightness(0.3) blur(10px);',
  'filter: brightness(0.25) blur(15px) saturate(120%);'
);

// 9. Better section heading animation
css = css.replace(
  '.section-heading { font-family: var(--font-serif); font-size: 4rem; margin-bottom: 80px; text-align: center; color: #fff; }',
  `.section-heading {
  font-family: var(--font-serif); font-size: 4rem; margin-bottom: 80px; text-align: center; color: #fff;
  letter-spacing: 3px;
  text-shadow: 0 4px 20px rgba(0,0,0,0.3);
}`
);

// 10. Heritage image — sharper rendering
css = css.replace(
  '.heritage-image img { width: 100%; height: 130%; object-fit: cover; }',
  `.heritage-image img {
  width: 100%; height: 130%; object-fit: cover;
  image-rendering: -webkit-optimize-contrast;
}`
);

// 11. Add a subtle page load animation
if (!css.includes('pageContentFadeIn')) {
  css += `

/* ============ Premium Page Load ============ */
#mainSite {
  animation: pageContentFadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
@keyframes pageContentFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ============ Premium Image Quality Global ============ */
img {
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

/* ============ Announcement Bar Polish ============ */
.announcement-bar {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

/* ============ Header Glass Effect ============ */
.header {
  backdrop-filter: blur(12px) saturate(150%);
  -webkit-backdrop-filter: blur(12px) saturate(150%);
  background: rgba(7, 7, 7, 0.4);
  border-bottom: 1px solid rgba(255,255,255,0.03);
  transition: background 0.4s ease, backdrop-filter 0.4s ease;
}

/* ============ Marquee Enhancement ============ */
.marquee-wrapper {
  background: linear-gradient(180deg, var(--bg-dark) 0%, rgba(15,15,15,1) 50%, var(--bg-dark) 100%);
}

/* ============ Footer Premium Polish ============ */
.footer-huge-title span {
  background: linear-gradient(135deg, #fff 0%, rgba(212,175,55,0.6) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ============ Product Detail Modal Image Quality ============ */
#pdGallery img, #pdMainImage {
  image-rendering: -webkit-optimize-contrast;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
}

/* ============ Smooth Section Transitions ============ */
.collections-section,
.lookbook-section,
.heritage-section,
.contact-section {
  position: relative;
}
.collections-section::before,
.lookbook-section::before,
.heritage-section::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 120px;
  background: linear-gradient(to bottom, var(--bg-dark), transparent);
  pointer-events: none;
  z-index: 2;
}

/* ============ Contact Form Premium ============ */
.input-group input, .input-group textarea {
  transition: border-color 0.3s ease, box-shadow 0.3s ease !important;
}
.input-group input:focus, .input-group textarea:focus {
  box-shadow: 0 0 15px rgba(212, 175, 55, 0.15);
}

/* ============ Stat Counter Animation ============ */
.stat-num {
  transition: color 0.3s ease;
}
.stat-item:hover .stat-num {
  text-shadow: 0 0 20px rgba(212, 175, 55, 0.4);
}

/* ============ Premium Glass Radio Nav ============ */
.glass-radio-group {
  backdrop-filter: blur(15px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(15px) saturate(180%) !important;
}
`;
}

fs.writeFileSync('frontend/style.css', css);
console.log('✓ style.css: Premium enhancements applied');


// =============================
// MAIN.JS — Smoother hero slideshow transition + scroll offset fix
// =============================
let mainJs = fs.readFileSync('frontend/main.js', 'utf8');

// Make hero slideshow slower (6s per slide instead of default)
if (mainJs.includes('setInterval(() => {')) {
  // Find the hero slideshow interval and make it 6 seconds
  mainJs = mainJs.replace(
    /setInterval\(\(\) => \{[\s\S]*?const slides = document\.querySelectorAll\('\.hero-slide'\);[\s\S]*?\}, (\d+)\);/,
    (match, interval) => {
      if (parseInt(interval) < 5000) {
        return match.replace(interval, '6000');
      }
      return match;
    }
  );
}

// Add CSS class to header on scroll for glass effect
if (!mainJs.includes('header-scrolled')) {
  const scrollHandler = `
  // Premium header scroll effect
  const headerEl = document.querySelector('.header');
  if (headerEl) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 100) {
        headerEl.style.background = 'rgba(7, 7, 7, 0.85)';
        headerEl.style.padding = '15px 5%';
      } else {
        headerEl.style.background = 'rgba(7, 7, 7, 0.4)';
        headerEl.style.padding = '30px 5%';
      }
    }, { passive: true });
  }
  // header-scrolled flag
`;
  // Insert after DOMContentLoaded opening
  mainJs = mainJs.replace(
    "document.querySelectorAll('.scrollspy-section').forEach(sec => observer.observe(sec));",
    "document.querySelectorAll('.scrollspy-section').forEach(sec => observer.observe(sec));\n" + scrollHandler
  );
}

fs.writeFileSync('frontend/main.js', mainJs);
console.log('✓ main.js: Premium scroll and slideshow enhancements');

console.log('\n✅ All premium enhancements applied — ready for build');
