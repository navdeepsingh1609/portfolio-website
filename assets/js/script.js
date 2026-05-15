/* ================================================================
   PORTFOLIO - JS REWRITE (2026 SPA Architecture)
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  
  // ── DOM ELEMENTS ────────────────────────────────────────────────
  const root = document.documentElement;
  const themeBtn = document.querySelector('.theme-toggle-btn');
  const navBtns = document.querySelectorAll('.nav-btn:not(.theme-toggle-btn)');
  const navIndicator = document.getElementById('nav-indicator');
  const navContainer = document.querySelector('.nav-container');
  const views = document.querySelectorAll('.view');
  const reveals = document.querySelectorAll('.reveal');
  
  // ── SVG DISPLACEMENT MAP GENERATORS ─────────────────────────────
  
  function generatePanelMap() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(size, size);
    
    // Panel is a rounded rectangle, let's say radius is 32 out of 256
    const r = 32;
    for(let y = 0; y < size; y++) {
      for(let x = 0; x < size; x++) {
        // Distance to inner rectangle
        let cx = Math.max(r, Math.min(x, size - r));
        let cy = Math.max(r, Math.min(y, size - r));
        let dx = x - cx;
        let dy = y - cy;
        let dist = Math.sqrt(dx*dx + dy*dy);
        
        let vx = 0, vy = 0;
        // Only displace near the edges (bezel)
        if (dist > 0 && dist < r) {
          // Bezel refraction: push outwards
          let mag = Math.sin((dist / r) * Math.PI) * 0.5;
          vx = (dx / dist) * mag;
          vy = (dy / dist) * mag;
        }
        
        let idx = (y * size + x) * 4;
        imgData.data[idx] = 128 + vx * 127;
        imgData.data[idx+1] = 128 + vy * 127;
        imgData.data[idx+2] = 128;
        imgData.data[idx+3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const mapImage = document.getElementById('map-panel');
    if (mapImage) mapImage.setAttribute('href', canvas.toDataURL('image/png'));
  }

  function generatePillMap() {
    const w = 256, h = 64; // generic pill
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    
    const r = h / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let cx = Math.max(r, Math.min(x, w - r));
        let dx = x - cx;
        let dy = y - r;
        let dist = Math.sqrt(dx*dx + dy*dy);
        
        let vx = 0, vy = 0;
        if (dist < r) {
          // To magnify, sample towards center
          let lx = (w / 2) - x;
          let ly = (h / 2) - y;
          // Stronger magnification in the middle
          let mag = 0.5 * Math.cos((dist / r) * (Math.PI / 2));
          vx = lx * mag;
          vy = ly * mag;
        }
        
        // Normalize vectors
        let nx = Math.max(-1, Math.min(1, vx / (w / 2)));
        let ny = Math.max(-1, Math.min(1, vy / (h / 2)));
        
        let idx = (y * w + x) * 4;
        imgData.data[idx] = 128 + nx * 127;
        imgData.data[idx+1] = 128 + ny * 127;
        imgData.data[idx+2] = 128;
        imgData.data[idx+3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const mapImage = document.getElementById('map-pill');
    if (mapImage) mapImage.setAttribute('href', canvas.toDataURL('image/png'));
  }

  generatePanelMap();
  generatePillMap();

  // ── STATE ───────────────────────────────────────────────────────
  let currentViewId = 'view-overview';

  // ── THEME TOGGLE ────────────────────────────────────────────────
  const THEME_KEY = 'pf-theme';
  // Force dark-mode by default on every fresh load
  const getSavedTheme = () => 'dark-mode';
  
  function applyTheme(theme) {
    const icon = themeBtn?.querySelector('ion-icon');
    const label = themeBtn?.querySelector('.theme-label');
    if (theme === 'light-mode') {
      root.classList.add('light-mode');
      if (icon) icon.setAttribute('name', 'sunny');
      if (label) label.textContent = 'Light Mode';
    } else {
      root.classList.remove('light-mode');
      if (icon) icon.setAttribute('name', 'moon');
      if (label) label.textContent = 'Dark Mode';
    }
  }

  // Init theme
  const currentTheme = getSavedTheme();
  applyTheme(currentTheme);

  themeBtn?.addEventListener('click', () => {
    const isLight = root.classList.contains('light-mode');
    const newTheme = isLight ? 'dark-mode' : 'light-mode';
    
    const icon = themeBtn.querySelector('ion-icon');
    if (icon) {
      // Animate out
      icon.style.transform = 'rotate(180deg) scale(0.5)';
      icon.style.opacity = '0';
      
      setTimeout(() => {
        localStorage.setItem(THEME_KEY, newTheme);
        applyTheme(newTheme);
        
        // Animate in
        icon.style.transform = 'rotate(360deg) scale(1)';
        icon.style.opacity = '1';
        
        // Reset transform seamlessly after animation
        setTimeout(() => {
          icon.style.transition = 'none';
          icon.style.transform = 'rotate(0deg) scale(1)';
          // Force reflow
          void icon.offsetWidth;
          icon.style.transition = '';
        }, 400);
      }, 200);
    } else {
      localStorage.setItem(THEME_KEY, newTheme);
      applyTheme(newTheme);
    }
  });


  // ── SPA ROUTER & NAVIGATION ─────────────────────────────────────
  
  // Update indicator position using transforms (GPU accelerated)
  function updateIndicator(activeBtn) {
    if (!activeBtn || !navIndicator || !navContainer) return;
    if (!navContainer.contains(activeBtn)) return;
    
    // We use getBoundingClientRect for absolute precision relative to the container
    const containerRect = navContainer.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();
    
    const offsetLeft = btnRect.left - containerRect.left;
    const width = btnRect.width;
    
    // Hardware accelerated positioning
    navIndicator.style.transform = `translateX(${offsetLeft}px)`;
    navIndicator.style.width = `${width}px`;
  }

  function switchView(targetId) {
    if (targetId === currentViewId) return;
    
    // 1. Manage Active Button Classes
    navBtns.forEach(btn => {
      const isActive = btn.dataset.target === targetId;
      btn.classList.toggle('active', isActive);
      if (isActive) updateIndicator(btn);
    });

    // 2. Manage View Visibility (SPA Transition)
    views.forEach(view => {
      if (view.id === targetId) {
        view.classList.add('active-view');
        if (targetId === 'view-game') {
          document.getElementById('main-content').classList.add('game-mode');
          document.body.classList.add('game-active');
        } else {
          document.getElementById('main-content').classList.remove('game-mode');
          document.body.classList.remove('game-active');
        }
      } else {
        view.classList.remove('active-view');
      }
    });

    // 3. Reset scroll position and re-trigger reveals
    if (window.innerWidth <= 900) {
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        // On mobile, scroll to the content area so the sidebar (Game/Resume) 
        // "scrolls up" out of view, making the section visible.
        mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    currentViewId = targetId;
    
    // Wait for view transition to finish before triggering reveals
    setTimeout(() => {
      initRevealsForView(document.getElementById(targetId));
    }, 50);
  }

  // Click listeners for nav buttons
  navBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(btn.dataset.target);
    });
  });

  // Handle Resize Event to keep indicator aligned
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const activeBtn = document.querySelector('.nav-btn.active');
      if (activeBtn) {
        // Disable transition during resize for instant snap
        navIndicator.style.transition = 'none';
        updateIndicator(activeBtn);
        // Force reflow
        void navIndicator.offsetWidth;
        navIndicator.style.transition = '';
      }
    }, 50);
  }, { passive: true });

  // Init indicator
  const initBtn = document.querySelector('.nav-btn.active');
  // Need slight delay for fonts/layout to settle
  setTimeout(() => updateIndicator(initBtn), 100);


  // ── SCROLL REVEAL ANIMATIONS ────────────────────────────────────
  const revealOptions = {
    root: null,
    rootMargin: '0px 0px -50px 0px',
    threshold: 0.1
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Stagger sibling reveals
        const container = entry.target.parentElement;
        const siblings = Array.from(container.querySelectorAll('.reveal:not(.visible)'));
        const index = siblings.indexOf(entry.target);
        
        if (index > -1) {
          entry.target.style.transitionDelay = `${index * 100}ms`;
        }
        
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, revealOptions);

  function initRevealsForView(view) {
    if (!view) return;
    const items = view.querySelectorAll('.reveal');
    items.forEach(item => {
      item.classList.remove('visible');
      item.style.transitionDelay = '0ms';
      revealObserver.observe(item);
    });
  }

  // Init reveals for the first view
  initRevealsForView(document.getElementById(currentViewId));

  // ── AUTO-HIDE NAV ON SCROLL (Mobile Only) ───────────────────────
  let lastScrollTop = 0;
  const mainNav = document.getElementById('main-nav');
  
  window.addEventListener('scroll', () => {
    // Only apply logic on mobile screens
    if (window.innerWidth > 900 || document.body.classList.contains('game-active')) {
      if (mainNav) mainNav.classList.remove('nav-hidden');
      return;
    }
    
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Determine scroll direction
    // If scrolled down more than 100px and scrolling down
    if (scrollTop > lastScrollTop && scrollTop > 100) {
      mainNav.classList.add('nav-hidden');
    } else if (scrollTop < lastScrollTop) {
      // Scrolling up
      mainNav.classList.remove('nav-hidden');
    }
    
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
  }, { passive: true });


});
