document.addEventListener('DOMContentLoaded', () => {

// Global Search & Filter
function executeSearchAndFilter() {
  const searchInput = document.getElementById('filterSearch');
  const sizeSelect = document.getElementById('filterSize');
  const minPriceInput = document.getElementById('filterMinPrice');
  const maxPriceInput = document.getElementById('filterMaxPrice');

  const search = searchInput ? searchInput.value.trim() : '';
  const size = sizeSelect ? sizeSelect.value : '';
  const minPrice = minPriceInput ? minPriceInput.value : '';
  const maxPrice = maxPriceInput ? maxPriceInput.value : '';
  
  if (!search && !size && !minPrice && !maxPrice) {
    alert('Please enter a search term or select a filter.');
    return;
  }

  // Construct query string
  let qs = '?';
  if (search) qs += `search=${encodeURIComponent(search)}&`;
  if (size) qs += `size=${encodeURIComponent(size)}&`;
  if (minPrice) qs += `min_price=${minPrice}&`;
  if (maxPrice) qs += `max_price=${maxPrice}&`;

  const modal = document.getElementById('collectionModal');
  const grid = document.getElementById('modalProductsGrid');
  const nameEl = document.getElementById('modalCollectionName');
  const descEl = document.getElementById('modalCollectionDesc');

  nameEl.innerText = 'Search Results';
  descEl.innerText = 'Searching catalog...';
  grid.innerHTML = '<p style="color:white; text-align:center; width:100%;">Finding exquisite pieces...</p>';
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  fetch(`/api/products${qs}`)
    .then(r => r.json())
    .then(products => {
      descEl.innerText = `Found ${products.length} product${products.length === 1 ? '' : 's'} matching your criteria.`;
      grid.innerHTML = '';
      if (!products || products.length === 0) {
         grid.innerHTML = '<p style="color:white;text-align:center;width:100%;padding:40px 0;">No products found matching your search.</p>';
         return;
      }
      products.forEach((prod) => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.style.cursor = 'pointer';
        const numericPrice = parseInt(String(prod.price).replace(/[^0-9]/g, '')) || prod.price;
        card.innerHTML = `
          <div class="product-img-wrapper">
            <img src="${prod.image_url || '/images/col_daily.png'}" alt="${prod.name}">
          </div>
          <div class="product-info">
            <h4 class="product-name">${prod.name}</h4>
            <p class="product-desc">${prod.description || ''}</p>
            <div class="product-price">₹${numericPrice}</div>
          </div>
        `;
        card.addEventListener('click', () => {
          if (typeof window.openProductDetails === 'function') {
            window.openProductDetails(prod);
          }
        });
        grid.appendChild(card);
      });
    })
    .catch(err => {
      console.error(err);
      grid.innerHTML = '<p style="color:#ff5252;text-align:center;width:100%;">Failed to load search results. Please try again.</p>';
    });
}

document.getElementById('applyFiltersBtn')?.addEventListener('click', executeSearchAndFilter);
document.getElementById('filterSearch')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    executeSearchAndFilter();
  }
});

  let currentUser = JSON.parse(localStorage.getItem('az_user') || 'null');
  let selectedProduct = null;
  let selectedSize = null;
  let selectedColor = null;

  function getUserAuthHeaders() {
    const token = localStorage.getItem('az_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  function handleSessionTerminated() {
    localStorage.removeItem('az_user');
    localStorage.removeItem('az_token');
    currentUser = null;
    alert("⚠️ Security Alert: Your account was logged into from another device. You have been logged out on this device.");
    window.location.reload();
  }

  function verifyActiveSession() {
    if (!currentUser || !currentUser.id || !localStorage.getItem('az_token')) return;
    fetch('/api/auth/verify-session', {
      headers: getUserAuthHeaders()
    }).then(r => {
      if (r.status === 401) {
        handleSessionTerminated();
      }
    }).catch(() => {});
  }

  function updateNavUser() {
    const navUser = document.getElementById('navAccountUser');
    if (navUser) {
      if (currentUser && currentUser.name) {
        const firstName = currentUser.name.split(' ')[0];
        navUser.innerText = firstName;
      } else {
        navUser.innerText = 'Account';
      }
    }
  }

  function updateMyRequestsBadge() {
    const badge = document.getElementById('myRequestsBadge');
    if (!currentUser || !currentUser.id) {
      if (badge) badge.style.display = 'none';
      return;
    }
    fetch(`/api/requests?user_id=${currentUser.id}`, {
      headers: getUserAuthHeaders()
    })
      .then(r => {
        if (r.status === 401) {
          handleSessionTerminated();
          return null;
        }
        return r.json();
      })
      .then(allReqs => {
        if (!allReqs || !Array.isArray(allReqs)) return;
        const activeReqs = allReqs.filter(r => r.status !== 'paid');
        if (badge) {
          if (activeReqs.length > 0) {
            badge.innerText = activeReqs.length;
            badge.style.display = 'inline-block';
          } else {
            badge.style.display = 'none';
          }
        }

        // Check for approved ('available') requests and notify the client
        const availableReqs = allReqs.filter(r => r.status === 'available');
        availableReqs.forEach(req => {
          const notifKey = `az_notif_seen_${req.id}`;
          if (!sessionStorage.getItem(notifKey)) {
            sessionStorage.setItem(notifKey, 'true');
            showInAppNotification(req);
          }
        });
      })
      .catch(() => {});
  }

  function showInAppNotification(req) {
    const toast = document.getElementById('clientNotifyToast');
    const title = document.getElementById('clientNotifyTitle');
    const body = document.getElementById('clientNotifyBody');
    const actBtn = document.getElementById('clientNotifyActionBtn');

    if (toast && title && body && actBtn) {
      title.innerText = '✨ Exclusive Request Approved!';
      body.innerText = `Great news! Your request for "${req.product_name}" is approved & ready for checkout.`;
      actBtn.onclick = () => {
        toast.style.display = 'none';
        window.openRequestsModal();
      };
      toast.style.display = 'block';

      setTimeout(() => {
        if (toast && toast.style.display !== 'none') {
          toast.style.opacity = '0';
          setTimeout(() => {
            toast.style.display = 'none';
            toast.style.opacity = '1';
          }, 400);
        }
      }, 14000);
    }

    // Native Web Notifications API if supported and granted
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        let notifImg = req.image_url || '/images/col_daily.png';
        new Notification("AZ Fashion - Request Approved!", {
          body: `Your request for "${req.product_name}" has been approved! Tap to checkout.`,
          icon: notifImg
        });
      } catch(e) {}
    }
  }

  // Poll for request updates, notifications, and verify active single-device session every 15 seconds
  setInterval(() => {
    if (currentUser && currentUser.id) {
      verifyActiveSession();
      updateMyRequestsBadge();
    }
  }, 15000);

  // Request Web Notification permission as soon as opening the website
  function initNotificationPermission() {
    if ("Notification" in window) {
      if (Notification.permission === "default") {
        // 1. Prompt immediately upon opening the website
        try {
          Notification.requestPermission().catch(() => {});
        } catch(e) {}

        // 2. Also ensure prompt fires on very first user gesture (touch or click)
        // for mobile browsers that block passive permission requests
        const askOnFirstGesture = () => {
          if (Notification.permission === "default") {
            try {
              Notification.requestPermission().catch(() => {});
            } catch(e) {}
          }
          window.removeEventListener('click', askOnFirstGesture);
          window.removeEventListener('touchstart', askOnFirstGesture);
        };
        window.addEventListener('click', askOnFirstGesture, { once: true });
        window.addEventListener('touchstart', askOnFirstGesture, { once: true });
      }
    }
  }

  initNotificationPermission();

  updateNavUser();
  verifyActiveSession();
  updateMyRequestsBadge();

  // Initial Onboarding Check
  const onboardingFlow = document.getElementById('onboardingFlow');
  const mainSite = document.getElementById('mainSite');
  
  if (currentUser) {
    if (!currentUser.tcAccepted) {
      onboardingFlow.classList.add('active');
      document.getElementById('obStepAuth').classList.remove('active');
      document.getElementById('obStepTC').classList.add('active');
    } else {
      onboardingFlow.classList.remove('active');
      mainSite.style.display = 'block';
    }
  } else {
    // Show onboarding
    onboardingFlow.classList.add('active');
  }
  // --- Preloader Animation ---
  const loader = document.getElementById('loader');
  const progress = document.querySelector('.progress');
  const title = document.querySelector('.loader-title');
  const bgs = document.querySelectorAll('.loader-bg');
  
  let w = 0;
  const int = setInterval(() => {
    w += Math.random() * 15;
    if (w >= 100) {
      w = 100;
      clearInterval(int);
      progress.style.width = '100%';
      
      // Animate out
      setTimeout(() => {
        title.style.opacity = '0';
        document.querySelector('.progress-bar').style.opacity = '0';
        
        bgs.forEach((bg, i) => {
          setTimeout(() => {
            bg.style.transform = 'scaleY(0)';
            bg.style.transition = 'transform 0.8s cubic-bezier(0.7, 0, 0.3, 1)';
          }, i * 200);
        });
        
        setTimeout(() => {
          loader.style.display = 'none';
          document.body.classList.remove('loading');
          
          // Trigger hero animations
          document.querySelectorAll('.hero-title .word').forEach((w, i) => {
            setTimeout(() => {
              w.style.transition = 'transform 1s cubic-bezier(0.16, 1, 0.3, 1), opacity 1s';
              w.style.transform = 'translateY(0)';
              w.style.opacity = '1';
            }, i * 200 + 500);
          });
        }, 1200);
      }, 500);
    } else {
      progress.style.width = w + '%';
    }
  }, 100);

  // --- Hero Slideshow ---
  const slides = document.querySelectorAll('.hero-slide');
  if (slides.length > 0) {
    let currentSlide = 0;
    setInterval(() => {
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % slides.length;
      slides[currentSlide].classList.add('active');
    }, 4000); // Change slide every 4 seconds
  }



  // --- Parallax & Reveal on Scroll ---
  const parallaxEls = document.querySelectorAll('.parallax-el, .parallax-bg');
  const parallaxImgs = document.querySelectorAll('.parallax-img img');
  const reveals = document.querySelectorAll('.reveal');

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    // Element Parallax
    parallaxEls.forEach(el => {
      const speed = el.getAttribute('data-speed') || 0.2;
      el.style.transform = `translateY(${scrollY * speed}px)`;
    });

    // Image Parallax (Inner scroll)
    parallaxImgs.forEach(img => {
      const parent = img.parentElement.parentElement;
      const rect = parent.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        const offset = (rect.top / window.innerHeight) * 20; // 20% movement
        img.style.transform = `translateY(${offset}%)`;
      }
    });

    // Reveal Elements
    reveals.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight - 100) {
        el.classList.add('active');
      }
    });
  });

  // --- Scrollspy Navigation ---
  const observerOptions = { root: null, rootMargin: '-20% 0px -70% 0px', threshold: 0 };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const radio = document.querySelector(`input[name="glass-nav"][value="${entry.target.id}"]`);
        if (radio) radio.checked = true;
      }
    });
  }, observerOptions);

  document.querySelectorAll('.scrollspy-section').forEach(sec => observer.observe(sec));

  // --- Fetch Collections & Horizontal Scroll ---
  const collectionsGrid = document.getElementById('collectionsGrid');
  const collectionsContainer = document.querySelector('.collections-container');

  if (collectionsGrid) {
    fetch('/api/collections?t=' + Date.now())
      .then(r => r.json())
      .then(data => {
        if (!data || data.length === 0) return;
        
        const loopedData = [...data, ...data];
        loopedData.forEach(item => {
          const imgUrl = item.image_url || '/images/col_chikankari.png';

          // Map collection name to local fallback image
          const fallbackMap = {
            'Daily Wear': '/images/col_daily.png',
            'Party Wear': '/images/col_party.png',
            'Lucknow Chikankari': '/images/col_chikankari.png',
            'Pakistani Suits': '/images/col_pakistani.png',
          };
          const fallback = fallbackMap[item.name] || '/images/col_daily.png';

          const card = document.createElement('div');
          card.className = 'collection-card-3d magnetic';
          card.innerHTML = `
            <img src="${imgUrl}" alt="${item.name}" onerror="this.onerror=null;this.src='${fallback}'">
            <div class="card-3d-overlay">
              <h3>${item.name}</h3>
              <p>${item.description}</p>
            </div>
          `;
          card.addEventListener('click', () => {
            openCollectionModal(item);
          });
          collectionsGrid.appendChild(card);
        });

        // 3D Tilt Effect on dynamically added cards
        const cards = document.querySelectorAll('.collection-card-3d');
        cards.forEach(card => {
          card.addEventListener('mousemove', (e) => {
            const r = card.getBoundingClientRect();
            const x = e.clientX - r.left - r.width/2;
            const y = e.clientY - r.top - r.height/2;
            card.style.transform = `rotateX(${-y/10}deg) rotateY(${x/10}deg)`;
          });
          card.addEventListener('mouseleave', () => {
            card.style.transform = `rotateX(0) rotateY(0)`;
          });
        });
        // Manual touch swipe & mouse drag + auto-sliding
        if (collectionsContainer) {
          let isDown = false;
          let startX, scrollLeftVal;
          let autoScrollActive = true;
          let resumeTimeout = null;

          collectionsContainer.addEventListener('mousedown', (e) => {
            isDown = true;
            autoScrollActive = false;
            startX = e.pageX - collectionsContainer.offsetLeft;
            scrollLeftVal = collectionsContainer.scrollLeft;
          });
          window.addEventListener('mouseup', () => {
            if (isDown) {
              isDown = false;
              clearTimeout(resumeTimeout);
              resumeTimeout = setTimeout(() => { autoScrollActive = true; }, 2000);
            }
          });
          collectionsContainer.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - collectionsContainer.offsetLeft;
            const walk = (x - startX) * 1.5;
            collectionsContainer.scrollLeft = scrollLeftVal - walk;
          });

          collectionsContainer.addEventListener('touchstart', () => {
            autoScrollActive = false;
            clearTimeout(resumeTimeout);
          }, { passive: true });
          collectionsContainer.addEventListener('touchend', () => {
            clearTimeout(resumeTimeout);
            resumeTimeout = setTimeout(() => { autoScrollActive = true; }, 2500);
          }, { passive: true });

          setInterval(() => {
            if (autoScrollActive && !isDown) {
              collectionsContainer.scrollLeft += 1;
              if (collectionsContainer.scrollLeft >= (collectionsGrid.scrollWidth / 2)) {
                collectionsContainer.scrollLeft = 0;
              }
            }
          }, 30);
        }
      })
      .catch(console.error);
  }

  // Navigation Logic
  document.querySelectorAll('input[name="glass-nav"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const targetId = e.target.value;
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // --- Collection Modal Logic ---
  const modal = document.getElementById('collectionModal');
  const modalClose = document.querySelector('.modal-close');
  const modalBackdrop = document.querySelector('.modal-backdrop');
  
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = 'auto'; // restore scroll
  }

  window.openCollectionModal = function(collection) {
    document.getElementById('modalCollectionName').innerText = collection.name;
    document.getElementById('modalCollectionDesc').innerText = collection.description;
    
    const grid = document.getElementById('modalProductsGrid');
    grid.innerHTML = '<p style="color:white; text-align:center;">Loading exquisite pieces...</p>';
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden'; // prevent background scrolling

    fetch(`/api/products?collection_id=${collection.id}`)
      .then(r => r.json())
      .then(products => {
        grid.innerHTML = '';
        if (products.length === 0) {
          grid.innerHTML = '<p style="color:white;">No products found in this collection currently.</p>';
          return;
        }
        products.forEach(prod => {
          const pCard = document.createElement('div');
          pCard.className = 'product-card';
          pCard.style.cursor = 'pointer';
          const numericPrice = parseInt(String(prod.price).replace(/[^0-9]/g, ''));
          pCard.innerHTML = `
            <div class="product-img-wrapper">
              <img src="${prod.image_url}" alt="${prod.name}">
            </div>
            <div class="product-info">
              <h4 class="product-name">${prod.name}</h4>
              <p class="product-desc">${prod.description}</p>
              <div class="product-price">₹${numericPrice}</div>
            </div>
          `;
          pCard.addEventListener('click', () => window.openProductDetails(prod));
          grid.appendChild(pCard);
        });
      })
      .catch(e => {
        grid.innerHTML = '<p style="color:red;">Error loading products.</p>';
      });
  };

  // --- E-COMMERCE LOGIC ---
  
  // 1. Full-Screen Onboarding Flow
  const obAuthForm = document.getElementById('obAuthForm');
  const obForgotForm = document.getElementById('obForgotForm');
  const obAddressForm = document.getElementById('obAddressForm');
  
  const stepAuth = document.getElementById('obStepAuth');
  const stepAddress = document.getElementById('obStepAddress');
  
  const authToggle = document.getElementById('obAuthToggle');
  const authToggleText = document.getElementById('obAuthToggleText');
  const authSubmitText = document.getElementById('obAuthSubmitText');
  const authTitle = document.getElementById('obAuthTitle');
  const nameGroup = document.getElementById('obNameGroup');
  const nameInput = document.getElementById('obNameInput');
  const forgotToggle = document.getElementById('obForgotPasswordToggle');
  const forgotBack = document.getElementById('obForgotBack');

  const obTabSignup = document.getElementById('obTabSignup');
  const obTabLogin = document.getElementById('obTabLogin');
  const obPhoneGroup = document.getElementById('obPhoneGroup');
  const obPhoneInput = document.getElementById('obPhoneInput');
  const obEmailLabel = document.getElementById('obEmailLabel');
  const obRememberRow = document.getElementById('obRememberRow');

  let isLoginMode = false; // Default to Create Account for new visitors

  function setAuthMode(loginMode) {
    isLoginMode = loginMode;
    if (isLoginMode) {
      if (obTabLogin) {
        obTabLogin.style.background = 'var(--gold)';
        obTabLogin.style.color = '#000';
        obTabLogin.style.borderColor = 'var(--gold)';
        obTabLogin.style.fontWeight = 'bold';
      }
      if (obTabSignup) {
        obTabSignup.style.background = 'transparent';
        obTabSignup.style.color = '#fff';
        obTabSignup.style.borderColor = 'rgba(255,255,255,0.2)';
        obTabSignup.style.fontWeight = '500';
      }
      authTitle.innerText = 'Sign in to access your unique requests and account.';
      authSubmitText.innerText = 'Sign In';
      authToggleText.innerText = "Don't have an account?";
      authToggle.innerText = 'Create Account';
      if (nameGroup) nameGroup.style.display = 'none';
      if (nameInput) nameInput.required = false;
      if (obPhoneGroup) obPhoneGroup.style.display = 'none';
      if (obPhoneInput) obPhoneInput.required = false;
      if (obEmailLabel) obEmailLabel.innerText = 'Email or Mobile Number';
      if (document.getElementById('obEmailInput')) document.getElementById('obEmailInput').placeholder = 'Enter email or 10-digit mobile';
      if (obRememberRow) obRememberRow.style.display = 'flex';
    } else {
      if (obTabSignup) {
        obTabSignup.style.background = 'var(--gold)';
        obTabSignup.style.color = '#000';
        obTabSignup.style.borderColor = 'var(--gold)';
        obTabSignup.style.fontWeight = 'bold';
      }
      if (obTabLogin) {
        obTabLogin.style.background = 'transparent';
        obTabLogin.style.color = '#fff';
        obTabLogin.style.borderColor = 'rgba(255,255,255,0.2)';
        obTabLogin.style.fontWeight = '500';
      }
      authTitle.innerText = 'Create your exclusive client account to enter the boutique.';
      authSubmitText.innerText = 'Create Account & Enter';
      authToggleText.innerText = 'Already have an account?';
      authToggle.innerText = 'Sign in';
      if (nameGroup) nameGroup.style.display = 'flex';
      if (nameInput) nameInput.required = true;
      if (obPhoneGroup) obPhoneGroup.style.display = 'flex';
      if (obPhoneInput) obPhoneInput.required = true;
      if (obEmailLabel) obEmailLabel.innerText = 'Email Address';
      if (document.getElementById('obEmailInput')) document.getElementById('obEmailInput').placeholder = 'Enter your email';
      if (obRememberRow) obRememberRow.style.display = 'none';
    }
  }

  obTabSignup?.addEventListener('click', () => setAuthMode(false));
  obTabLogin?.addEventListener('click', () => setAuthMode(true));
  authToggle?.addEventListener('click', () => setAuthMode(!isLoginMode));

  setAuthMode(false); // Initial state is sign up

  forgotToggle?.addEventListener('click', () => {
    obAuthForm.style.display = 'none';
    obForgotForm.style.display = 'flex';
    authTitle.innerText = 'Reset your password to regain access.';
  });

  forgotBack?.addEventListener('click', () => {
    obForgotForm.style.display = 'none';
    obAuthForm.style.display = 'flex';
    authTitle.innerText = isLoginMode ? 'Sign in to access your unique requests and account.' : 'Create your exclusive client account to enter the boutique.';
  });

  obForgotForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('obForgotEmail').value;
    const newPassword = document.getElementById('obForgotNewPassword').value;
    
    // Validate min 8 char, 1 capital, 1 special, no space, 1 digit
    const passRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_\-+={}[\]|\\:;"'<>,.?/])(?!.*\s).{8,}$/;
    if (!passRegex.test(newPassword)) {
      return alert("Password must be at least 8 characters, with 1 capital letter, 1 number, 1 special character, and NO spaces.");
    }
    
    fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, newPassword })
    }).then(r => r.json()).then(res => {
      if (res.error) return alert(res.error);
      alert("Password reset successfully! Please log in.");
      document.getElementById('obForgotNewPassword').value = '';
      forgotBack.click();
    }).catch(err => {
      console.error(err);
      alert("Failed to connect to the server.");
    });
  });

  obAuthForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = nameInput ? nameInput.value.trim() : '';
    const emailOrIdentifier = document.getElementById('obEmailInput').value.trim();
    const phone = obPhoneInput ? obPhoneInput.value.trim() : '';
    const password = document.getElementById('obPasswordInput').value;
    
    const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
    const body = isLoginMode 
      ? { identifier: emailOrIdentifier, password } 
      : { name, email: emailOrIdentifier, phone, password };
    
    const origSubmitText = authSubmitText.innerText;
    authSubmitText.innerText = 'Authenticating...';

    fetch(`${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json()).then(res => {
      authSubmitText.innerText = origSubmitText;
      if (res.error) return alert(res.error);
      
      // Successful Login OR Sign Up
      currentUser = res.user;
      localStorage.setItem('az_user', JSON.stringify(currentUser));
      if (res.token) localStorage.setItem('az_token', res.token);
      
      updateNavUser();
      updateMyRequestsBadge();

      stepAuth.classList.remove('active');
      unlockMainSite();
    }).catch(err => {
      authSubmitText.innerText = origSubmitText;
      console.error(err);
      alert("Failed to connect to server. Please check your connection.");
    });
  });



  // --- Account Dashboard Logic ---
  window.openAccountModal = () => {
    if (!currentUser) return alert("Please log in first.");
    
    document.getElementById('accName').innerText = currentUser.name || 'Valued Client';
    document.getElementById('accEmail').innerText = currentUser.email || '';
    const phoneDisplay = document.getElementById('accPhoneDisplay');
    if (phoneDisplay) {
      phoneDisplay.innerHTML = currentUser.phone ? '<i class="fas fa-phone"></i> ' + currentUser.phone : '';
    }
    const clientDisplay = document.getElementById('accClientId');
    if (clientDisplay) {
      clientDisplay.innerText = 'Account ID: #AZ-' + currentUser.id;
    }
    
    renderAccountAddresses();
    
    // Fetch Orders (paid requests)
    const ordersList = document.getElementById('accOrdersList');
    ordersList.innerHTML = '<p>Loading your orders...</p>';
    
    fetch(`/api/requests?user_id=${currentUser.id}`, {
      headers: getUserAuthHeaders()
    })
      .then(r => {
        if (r.status === 401) {
          handleSessionTerminated();
          return null;
        }
        return r.json();
      })
      .then(reqs => {
        if (!reqs) return;
        ordersList.innerHTML = '';
        const paidReqs = reqs.filter(r => r.status === 'paid');
        if (paidReqs.length === 0) {
          ordersList.innerHTML = '<p style="font-size: 0.9rem; opacity: 0.8;">No orders found. Explore our collections to place an order!</p>';
        } else {
          paidReqs.forEach(r => {
            ordersList.innerHTML += `
              <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                <div>
                  <h4 style="color: var(--gold); margin-bottom: 5px;">${r.product_name}</h4>
                  <p style="font-size: 0.85rem; opacity: 0.8;">Size: ${r.size} | Color: ${r.color}</p>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                  <div style="color: #4caf50; font-weight: bold; font-size: 0.9rem; margin-bottom: 5px;">
                    PAID
                  </div>
                  <a href="https://wa.me/+918210634488?text=Hi,%20I%20have%20received%20my%20order%20for%20${encodeURIComponent(r.product_name)}%20but%20there%20is%20an%20issue/damage.%20[Please%20attach%20video%20proof%20here]" target="_blank" style="font-size: 0.8rem; color: #ff9800; text-decoration: underline;">Report Issue / Damage</a>
                </div>
              </div>
            `;
          });
        }
      });
      
    document.getElementById('accountModal').classList.add('active');
  };

  function renderAccountAddresses() {
    const list = document.getElementById('accAddressesList');
    list.innerHTML = '';
    
    let addresses = [];
    if (currentUser.address) {
      try {
        addresses = JSON.parse(currentUser.address);
        if (!Array.isArray(addresses)) addresses = [currentUser.address];
      } catch(e) {
        addresses = [currentUser.address];
      }
    }
    
    if (addresses.length === 0) {
      list.innerHTML = '<p style="font-size: 0.9rem; opacity: 0.8;">No saved addresses.</p>';
    } else {
      addresses.forEach(addr => {
        list.innerHTML += `
          <div style="background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px; font-size: 0.9rem;">
            ${addr}
          </div>
        `;
      });
    }
  }

  const accAddAddressForm = document.getElementById('accAddAddressForm');
  if (accAddAddressForm) {
    accAddAddressForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const house = document.getElementById('accHouseNo').value.trim();
      const street = document.getElementById('accStreet').value.trim();
      const landmark = document.getElementById('accLandmark').value.trim();
      const city = document.getElementById('accCity').value.trim();
      const pin = document.getElementById('accPincode').value.trim();
      const phone = document.getElementById('accPhone') ? document.getElementById('accPhone').value.trim() : '';
      
      if (!house || !street || !city || !pin || !phone) {
        return alert("Please fill all required address fields, including your mobile/phone number.");
      }
      
      const newAddr = `${house} ${street}, ${landmark ? 'Near '+landmark+', ' : ''}${city} - ${pin} (Ph: ${phone})`;
      
      let addresses = [];
      if (currentUser.address) {
        try { addresses = JSON.parse(currentUser.address); } catch(e) {}
        if (!Array.isArray(addresses)) addresses = [currentUser.address];
      }
      
      addresses.push(newAddr);
      const addressArrStr = JSON.stringify(addresses);
      
      fetch('/api/user/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getUserAuthHeaders() },
        body: JSON.stringify({ user_id: currentUser.id, name: currentUser.name, address: addressArrStr })
      }).then(r => {
        if (r.status === 401) {
          handleSessionTerminated();
          return;
        }
        currentUser.address = addressArrStr;
        localStorage.setItem('az_user', JSON.stringify(currentUser));
        
        if (document.getElementById('accPhone')) document.getElementById('accPhone').value = '';
        document.getElementById('accHouseNo').value = '';
        document.getElementById('accStreet').value = '';
        document.getElementById('accLandmark').value = '';
        document.getElementById('accCity').value = '';
        document.getElementById('accPincode').value = '';
        
        document.getElementById('accAddAddressForm').style.display = 'none';
        
        renderAccountAddresses();
      });
    });
  }

  window.logoutUser = () => {
    localStorage.removeItem('az_user');
    localStorage.removeItem('az_token');
    window.location.reload();
  };

  window.deleteAccount = () => {
    if (confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) {
      fetch('/api/user/' + currentUser.id, {
        method: 'DELETE',
        headers: getUserAuthHeaders()
      }).then(res => {
        if (res.status === 401) {
          handleSessionTerminated();
          return;
        }
        if (!res.ok) throw new Error('Failed to delete account');
        alert("Your account has been deleted.");
        localStorage.removeItem('az_user');
        localStorage.removeItem('az_token');
        window.location.reload();
      }).catch(err => {
        alert("An error occurred while deleting your account.");
      });
    }
  };

  function unlockMainSite() {
    document.getElementById('obStepAuth').classList.remove('active');
    setTimeout(() => {
      document.getElementById('obStepTC').classList.add('active');
    }, 300);
  }

  document.getElementById('obTcSubmitBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!document.getElementById('obTcCheckbox').checked) {
      alert("You must agree to the Terms & Conditions before entering.");
      return;
    }
    
    if (currentUser) {
      currentUser.tcAccepted = true;
      localStorage.setItem('az_user', JSON.stringify(currentUser));
    }

    if ("Notification" in window && Notification.permission === "default") {
      try { Notification.requestPermission().catch(() => {}); } catch(e) {}
    }

    const onboardingFlow = document.getElementById('onboardingFlow');
    onboardingFlow.style.opacity = '0';
    setTimeout(() => {
      onboardingFlow.classList.remove('active');
      onboardingFlow.style.display = 'none';
      document.getElementById('mainSite').style.display = 'block';
    }, 800);
  });

  // 2. Product Details Flow
  const pdModal = document.getElementById('productDetailsModal');
  
  window.openProductDetails = (prod) => {
    selectedProduct = prod;
    selectedSize = null;
    selectedColor = null;
    
    document.getElementById('pdName').innerText = prod.name;
    document.getElementById('pdDesc').innerText = prod.description;
    document.getElementById('pdPrice').innerText = `₹${prod.price}`;

    // Multi-image gallery setup
    let images = prod.images || [];
    if (!images || images.length === 0) {
      images = [prod.image_url || '/images/col_daily.png'];
    }
    
    let currentImgIdx = 0;
    const pdImg = document.getElementById('pdImg');
    const pdPrevImgBtn = document.getElementById('pdPrevImgBtn');
    const pdNextImgBtn = document.getElementById('pdNextImgBtn');
    const pdImgCounter = document.getElementById('pdImgCounter');
    const pdThumbnailsList = document.getElementById('pdThumbnailsList');
    
    function showImage(idx) {
      currentImgIdx = (idx + images.length) % images.length;
      if (pdImg) {
        pdImg.style.opacity = '0.3';
        pdImg.src = images[currentImgIdx];
        setTimeout(() => { pdImg.style.opacity = '1'; }, 100);
      }
      
      if (images.length > 1) {
        if (pdPrevImgBtn) pdPrevImgBtn.style.display = 'flex';
        if (pdNextImgBtn) pdNextImgBtn.style.display = 'flex';
        if (pdImgCounter) {
          pdImgCounter.style.display = 'block';
          pdImgCounter.innerText = `${currentImgIdx + 1} / ${images.length}`;
        }
        
        // Highlight active thumbnail
        if (pdThumbnailsList) {
          Array.from(pdThumbnailsList.children).forEach((thumb, i) => {
            thumb.style.borderColor = (i === currentImgIdx) ? 'var(--gold)' : 'rgba(255,255,255,0.2)';
            thumb.style.opacity = (i === currentImgIdx) ? '1' : '0.5';
          });
        }
      } else {
        if (pdPrevImgBtn) pdPrevImgBtn.style.display = 'none';
        if (pdNextImgBtn) pdNextImgBtn.style.display = 'none';
        if (pdImgCounter) pdImgCounter.style.display = 'none';
      }
    }

    if (pdThumbnailsList) {
      pdThumbnailsList.innerHTML = '';
      if (images.length > 1) {
        images.forEach((img, i) => {
          const thumb = document.createElement('img');
          thumb.src = img;
          thumb.style.cssText = 'width: 55px; height: 70px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 2px solid rgba(255,255,255,0.2); opacity: 0.5; transition: 0.2s; flex-shrink: 0;';
          thumb.onclick = () => showImage(i);
          pdThumbnailsList.appendChild(thumb);
        });
      }
    }

    if (pdPrevImgBtn) pdPrevImgBtn.onclick = (e) => { e.stopPropagation(); showImage(currentImgIdx - 1); };
    if (pdNextImgBtn) pdNextImgBtn.onclick = (e) => { e.stopPropagation(); showImage(currentImgIdx + 1); };
    
    // Mobile Touch Swiping on main image
    let touchStartX = 0;
    const mainImgWrap = document.querySelector('.product-main-img-wrap');
    if (mainImgWrap) {
      mainImgWrap.ontouchstart = (e) => { touchStartX = e.touches[0].clientX; };
      mainImgWrap.ontouchend = (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        if (touchStartX - touchEndX > 40 && images.length > 1) {
          showImage(currentImgIdx + 1);
        } else if (touchEndX - touchStartX > 40 && images.length > 1) {
          showImage(currentImgIdx - 1);
        }
      };
    }

    showImage(0);
    
    // Render Sizes
    const sizesContainer = document.getElementById('pdSizes');
    sizesContainer.innerHTML = '';
    (prod.sizes || []).forEach(size => {
      const btn = document.createElement('button');
      btn.className = 'size-btn';
      btn.innerText = size;
      btn.onclick = () => {
        document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedSize = size;
      };
      sizesContainer.appendChild(btn);
    });

    // Render Reviews
    function renderReviews(reviews) {
      const reviewsContainer = document.getElementById('pdReviewsList');
      reviewsContainer.innerHTML = '';
      (reviews || []).forEach(r => {
        reviewsContainer.innerHTML += `
          <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px;">
            <div style="font-weight: bold; color: var(--gold);">${r.user} - ${r.rating}★</div>
            <div style="font-size: 0.9rem; margin-top: 5px; opacity: 0.8;">${r.comment}</div>
          </div>
        `;
      });
    }
    
    renderReviews(prod.reviews);
    document.getElementById('addReviewForm').style.display = 'none';

    pdModal.classList.add('active');
  };

  const addReviewBtn = document.getElementById('addReviewBtn');
  const addReviewForm = document.getElementById('addReviewForm');
  const submitReviewBtn = document.getElementById('submitReviewBtn');
  
  if (addReviewBtn) {
    addReviewBtn.addEventListener('click', () => {
      addReviewForm.style.display = addReviewForm.style.display === 'none' ? 'block' : 'none';
      if (currentUser && currentUser.name) {
        document.getElementById('reviewName').value = currentUser.name;
      }
    });
  }
  
  if (submitReviewBtn) {
    submitReviewBtn.addEventListener('click', () => {
      const name = document.getElementById('reviewName').value;
      const rating = document.getElementById('reviewRating').value;
      const comment = document.getElementById('reviewComment').value;
      
      if (!name || !rating || !comment) return alert("Please fill all fields.");
      
      const newReview = { user: name, rating: parseInt(rating), comment: comment };
      
      // Update local state for immediate feedback
      if (!selectedProduct.reviews) selectedProduct.reviews = [];
      selectedProduct.reviews.unshift(newReview);
      renderReviews(selectedProduct.reviews);
      
      addReviewForm.style.display = 'none';
      document.getElementById('reviewRating').value = '';
      document.getElementById('reviewComment').value = '';
      
      // Send to backend
      fetch(`/api/products/${selectedProduct.id}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReview)
      }).catch(err => console.error("Failed to save review to backend", err));
      
      alert("Review submitted successfully!");
    });
  }

  // Submit Request Action
  const pdRequestBtn = document.getElementById('pdRequestBtn');
  if (pdRequestBtn) {
    pdRequestBtn.addEventListener('click', () => {
      if (!selectedSize) return alert('Please select a size.');
      submitRequest();
    });
  }

  function submitRequest() {
    const pdRequestBtn = document.getElementById('pdRequestBtn');
    const originalText = pdRequestBtn.innerHTML;
    pdRequestBtn.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> Submitting...</span>';
    
    fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getUserAuthHeaders() },
      body: JSON.stringify({
        user_id: currentUser.id,
        product_id: selectedProduct.id,
        size: selectedSize,
        color: selectedProduct.colors ? selectedProduct.colors[0] : 'Default'
      })
    }).then(r => {
      if (r.status === 401) {
        handleSessionTerminated();
        return null;
      }
      return r.json();
    }).then(res => {
      if (!res) return;
      if (res.error) {
        pdRequestBtn.innerHTML = originalText;
        return alert(res.error);
      }
      
      // Success Animation
      pdRequestBtn.innerHTML = '<span><i class="fas fa-check-circle"></i> Successfully Requested!</span>';
      pdRequestBtn.style.backgroundColor = '#4caf50';
      pdRequestBtn.style.borderColor = '#4caf50';
      
      updateMyRequestsBadge();

      // Request browser notification permission so client can get push alerts
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
      
      setTimeout(() => {
        pdModal.classList.remove('active');
        // Reset after modal closes
        setTimeout(() => {
          pdRequestBtn.innerHTML = originalText;
          pdRequestBtn.style.backgroundColor = '';
          pdRequestBtn.style.borderColor = '';
        }, 500);
      }, 1500);
    }).catch(() => {
      pdRequestBtn.innerHTML = originalText;
      alert("Something went wrong.");
    });
  }

  // 4. Requests & Razorpay Flow
  window.openRequestsModal = () => {
    if (!currentUser) {
      return alert("Please login or sign up first to view your requests.");
    }
    const list = document.getElementById('checkoutItemsList');
    const details = document.getElementById('checkoutDetails');
    const totalPrice = document.getElementById('checkoutTotalPrice');
    const payBtn = document.getElementById('checkoutPayBtn');
    const testPayBtn = document.getElementById('testPayBtn');
    
    // Address Setup
    const addrSelect = document.getElementById('cartAddressSelect');
    const newAddrForm = document.getElementById('cartNewAddressForm');
    
    while(addrSelect.options.length > 2) { addrSelect.remove(2); }
    let addresses = [];
    if (currentUser.address) {
      try { addresses = JSON.parse(currentUser.address); } catch(e) {}
      if (!Array.isArray(addresses)) addresses = [currentUser.address];
    }
    addresses.forEach(addr => {
      const opt = document.createElement('option');
      opt.value = addr;
      opt.text = addr;
      addrSelect.add(opt);
    });
    
    if (addresses.length > 0) {
      addrSelect.selectedIndex = 2; // select first saved
    } else {
      addrSelect.selectedIndex = 1; // select "new"
    }
    
    newAddrForm.style.display = (addrSelect.value === 'new') ? 'flex' : 'none';
    addrSelect.onchange = () => { newAddrForm.style.display = (addrSelect.value === 'new') ? 'flex' : 'none'; };

    const locBtn = document.getElementById('cartBtnUseLocation');
    if (locBtn) {
      locBtn.onclick = () => {
        if (!navigator.geolocation) return alert("Geolocation not supported.");
        locBtn.innerHTML = 'Locating...';
        navigator.geolocation.getCurrentPosition(pos => {
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`)
            .then(r => r.json()).then(data => {
              locBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Use Current Location';
              if (data.address) {
                document.getElementById('cartHouseNo').value = data.address.house_number || '';
                document.getElementById('cartStreet').value = data.address.road || data.address.suburb || data.display_name.split(',')[0];
                document.getElementById('cartCity').value = data.address.city || data.address.town || data.address.county || '';
                document.getElementById('cartPincode').value = data.address.postcode || '';
              }
            }).catch(() => { locBtn.innerHTML = 'Use Current Location'; });
        }, () => { locBtn.innerHTML = 'Use Current Location'; });
      };
    }

    const validateAndSaveAddress = (callback) => {
      if (addrSelect.value === 'new') {
        const house = document.getElementById('cartHouseNo').value.trim();
        const street = document.getElementById('cartStreet').value.trim();
        const landmark = document.getElementById('cartLandmark').value.trim();
        const city = document.getElementById('cartCity').value.trim();
        const pin = document.getElementById('cartPincode').value.trim();
        const phone = document.getElementById('cartPhone') ? document.getElementById('cartPhone').value.trim() : '';
        
        if (!house || !street || !city || !pin || !phone) {
          return alert("Please fill all required address fields, including your mobile/phone number.");
        }
        
        const newAddr = `${house} ${street}, ${landmark ? 'Near '+landmark+', ' : ''}${city} - ${pin} (Ph: ${phone})`;
        addresses.push(newAddr);
        const addressArrStr = JSON.stringify(addresses);
        
        fetch('/api/user/address', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getUserAuthHeaders() },
          body: JSON.stringify({ user_id: currentUser.id, name: currentUser.name, address: addressArrStr })
        }).then(r => {
          if (r.status === 401) {
            handleSessionTerminated();
            return;
          }
          currentUser.address = addressArrStr;
          localStorage.setItem('az_user', JSON.stringify(currentUser));
          callback();
        });
      } else if (!addrSelect.value) {
        alert("Please select or add a shipping address.");
      } else {
        callback();
      }
    };

    const cartSaveAddressBtn = document.getElementById('cartSaveAddressBtn');
    if (cartSaveAddressBtn) {
      cartSaveAddressBtn.onclick = () => {
        validateAndSaveAddress(() => {
          while(addrSelect.options.length > 2) { addrSelect.remove(2); }
          addresses.forEach(addr => {
            const opt = document.createElement('option');
            opt.value = addr;
            opt.text = addr;
            addrSelect.add(opt);
          });
          addrSelect.value = addresses[addresses.length - 1];
          newAddrForm.style.display = 'none';
          alert("Shipping address saved successfully!");
        });
      };
    }
    
    list.innerHTML = '<p style="padding: 20px;">Loading...</p>';
    document.getElementById('requestsModal').classList.add('active');
    
    fetch(`/api/requests?user_id=${currentUser.id}`, {
      headers: getUserAuthHeaders()
    })
      .then(r => {
        if (r.status === 401) {
          handleSessionTerminated();
          return null;
        }
        return r.json();
      })
      .then(allReqs => {
        if (!allReqs) return;
        updateMyRequestsBadge();
        const reqs = allReqs.filter(r => r.status !== 'paid');
        list.innerHTML = '';
        if (reqs.length === 0) {
          list.innerHTML = `<div class="step"><span>Your cart is empty</span><p>Request an item to see it here.</p></div>`;
          details.innerHTML = '<span>Subtotal</span><span>₹0</span><span>Shipping</span><span>Free</span><span>Total</span><span>₹0</span>';
          totalPrice.innerText = '₹0';
          payBtn.style.display = 'none';
          testPayBtn.style.display = 'none';
          return;
        }

        let total = 0;
        let payIds = [];
        reqs.forEach(r => {
          let statusText = `<span style="color: #4caf50; font-weight: 600;">AVAILABLE</span>`;
          if (r.status === 'pending') statusText = `<span style="color: #ff9800; font-weight: 600;">PENDING APPROVAL</span>`;
          if (r.status === 'paid') statusText = `<span style="color: #2196f3; font-weight: 600;">PAID</span>`;
          
          if (r.status === 'available') {
            total += r.price;
            payIds.push(r.id);
          }
          
          let extraInfo = '';
          if (r.status === 'declined') {
            statusText = `<span style="color: #f44336; font-weight: 600;">DECLINED</span>`;
            extraInfo = `<div style="margin-top: 10px; font-size: 0.85rem; color: #ff9800; line-height: 1.4;">
              We sincerely apologize, but this exclusive piece is currently out of stock. Join our <a href="https://chat.whatsapp.com/IivXOd4K7kx1tK72XAdbZa" target="_blank" style="color: #4caf50; text-decoration: underline; font-weight: bold;">WhatsApp Community</a> to get first access to our huge collection along with exclusive rates.
            </div>`;
          }

          let reqImg = r.image_url || '/images/col_daily.png';
          try {
            if (reqImg.startsWith('[')) {
              const arr = JSON.parse(reqImg);
              if (Array.isArray(arr) && arr.length > 0) reqImg = arr[0];
            }
          } catch(e) {}
          
          list.innerHTML += `
            <div class="step" style="position: relative; display: flex; gap: 15px; align-items: center; padding: 15px; margin-bottom: 15px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
              <img src="${reqImg}" alt="${r.product_name}" style="width: 70px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
              <div style="flex: 1; min-width: 0; text-align: left; padding-right: 28px;">
                <span style="display: block; font-weight: 600; color: var(--gold); font-size: 1.05rem; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r.product_name}</span>
                <p style="margin: 0 0 5px 0; font-size: 0.9rem; opacity: 0.9;">Size: <strong>${r.size}</strong> &bull; <strong style="color: var(--gold);">₹${r.price}</strong></p>
                <div><span style="font-size: 0.8rem; opacity: 0.7;">Status: </span>${statusText}</div>
                ${extraInfo}
              </div>
              <button onclick="removeRequest(${r.id})" style="position: absolute; right: 14px; top: 14px; background: transparent; border: none; color: #ff5252; cursor: pointer; font-size: 1.15rem; transition: 0.2s;" title="Remove Request">
                <i class="fas fa-trash-alt"></i>
              </button>
            </div>
          `;
        });
        
        details.innerHTML = `<span>Subtotal</span><span>₹${total}</span><span>Shipping</span><span>Free</span><span>Total</span><span>₹${total}</span>`;
        totalPrice.innerText = `₹${total}`;
        
        if (total > 0) {
          payBtn.style.display = 'flex';
          testPayBtn.style.display = 'flex';
          
          testPayBtn.onclick = () => {
            validateAndSaveAddress(() => {
              alert("Test Payment Successful! (Bypassing Razorpay)");
              fetch('/api/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getUserAuthHeaders() },
                body: JSON.stringify({ test_mode: true, req_ids: payIds.join(',') })
              }).then(r => {
                if (r.status === 401) {
                  handleSessionTerminated();
                  return null;
                }
                return r.json();
              }).then(verifyRes => {
                if (!verifyRes) return;
                document.getElementById('requestsModal').classList.remove('active');
                const confModal = document.getElementById('orderConfirmationModal');
                document.getElementById('confirmOrderId').innerText = "TEST-" + Math.floor(Math.random()*10000);
                confModal.classList.add('active');
                updateMyRequestsBadge();
              });
            });
          };

          payBtn.onclick = () => {
            validateAndSaveAddress(() => {
              window.initRazorpayCheckout(total, payIds.join(','));
            });
          };
        } else {
          payBtn.style.display = 'none';
          testPayBtn.style.display = 'none';
        }
      });
  };

  window.removeRequest = (reqId) => {
    if (!confirm("Are you sure you want to remove this request?")) return;
    
    fetch(`/api/requests/${reqId}`, {
      method: 'DELETE',
      headers: getUserAuthHeaders()
    }).then(r => {
      if (r.status === 401) {
        handleSessionTerminated();
        return null;
      }
      return r.json();
    }).then(res => {
      if (!res) return;
      if (res.error) return alert(res.error);
      updateMyRequestsBadge();
      openRequestsModal(); // Refresh modal
    }).catch(err => {
      console.error(err);
      alert("Failed to delete request");
    });
  };

  window.initRazorpayCheckout = (amount, reqIds) => {
    alert("Initiating secure checkout... Please wait.");
    fetch('/api/razorpay/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getUserAuthHeaders() },
      body: JSON.stringify({ amount })
    }).then(r => {
      if (r.status === 401) {
        handleSessionTerminated();
        return null;
      }
      return r.json();
    }).then(order => {
      if (!order) return;
      if (order.error) {
        return alert("Order Creation Error: " + order.error);
      }
      
      const options = {
        "key": "rzp_test_TAcCFGTght1pfM", // Real Razorpay Key
        "amount": order.amount,
        "currency": "INR",
        "name": "AZ Fashion",
        "description": "Premium Ethnic Wear",
        "order_id": order.id,
        "handler": function (response) {
          fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getUserAuthHeaders() },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          }).then(r => {
            if (r.status === 401) {
              handleSessionTerminated();
              return null;
            }
            return r.json();
          }).then(verifyRes => {
            if (!verifyRes) return;
            if (verifyRes.error) {
              alert('Payment Verification Failed: ' + verifyRes.error);
            } else {
              document.getElementById('requestsModal').classList.remove('active');
              const confModal = document.getElementById('orderConfirmationModal');
              document.getElementById('confirmOrderId').innerText = verifyRes.orderId || response.razorpay_order_id;
              confModal.classList.add('active');
              updateMyRequestsBadge();
            }
          });
        },
        "prefill": {
          "name": currentUser ? currentUser.name : '',
          "email": currentUser ? currentUser.email : ''
        },
        "theme": {
          "color": "#d4af37" // gold
        }
      };
      
      try {
        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
          alert("Payment Failed: " + response.error.description);
        });
        rzp.open();
      } catch (err) {
        alert("Failed to open Razorpay: " + err.message);
      }
    }).catch(err => {
      alert("Network Error: " + err.message);
    });
  };

});
