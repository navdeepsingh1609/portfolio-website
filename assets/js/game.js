(function() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const startBtn = document.getElementById('start-game-btn');
  const overlay = document.getElementById('game-start-overlay');
  
  let gameRunning = false;
  let keys = {};
  let lastTime = 0;
  let score = 0;
  let celebrationTriggered = false;

  // ── CELEBRATION CONFETTI ─────────────────────────────────────────
  let confettiCanvas = null;
  let confettiCtx = null;
  let confettiParticles = [];
  let confettiAnimId = null;
  let bannerEl = null;

  function launchCelebration() {
    if (confettiCanvas) return; // already running

    // Full-page confetti canvas
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
    document.body.appendChild(confettiCanvas);
    confettiCtx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;

    // Banner
    bannerEl = document.createElement('div');
    bannerEl.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0);
      z-index: 100000; background: linear-gradient(135deg, #10b981, #38bdf8);
      color: #fff; padding: 24px 48px; border-radius: 20px;
      font-family: 'Outfit', sans-serif; font-size: 1.6rem; font-weight: 800;
      text-align: center; box-shadow: 0 20px 60px rgba(16,185,129,0.5);
      transition: transform 0.5s cubic-bezier(0.25,1.2,0.5,1);
      white-space: nowrap;
    `;
    bannerEl.innerHTML = '🐛 All Bugs Squashed! 🎉<br><span style="font-size:1rem;font-weight:400;opacity:0.85;">Navdeep: 8/8 bugs fixed. Ship it!</span>';
    document.body.appendChild(bannerEl);
    // Animate in
    requestAnimationFrame(() => { bannerEl.style.transform = 'translate(-50%, -50%) scale(1)'; });

    // Spawn confetti particles
    const colors = ['#10b981','#38bdf8','#a855f7','#f59e0b','#ec4899','#fff'];
    for (let i = 0; i < 200; i++) {
      confettiParticles.push({
        x: Math.random() * confettiCanvas.width,
        y: -10 - Math.random() * confettiCanvas.height * 0.5,
        w: 6 + Math.random() * 10,
        h: 4 + Math.random() * 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 5,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.2,
        opacity: 1
      });
    }

    function animateConfetti() {
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.angle += p.spin;
        p.opacity -= 0.004;
        if (p.opacity < 0) p.opacity = 0;
        confettiCtx.save();
        confettiCtx.globalAlpha = p.opacity;
        confettiCtx.translate(p.x, p.y);
        confettiCtx.rotate(p.angle);
        confettiCtx.fillStyle = p.color;
        confettiCtx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        confettiCtx.restore();
      });
      confettiParticles = confettiParticles.filter(p => p.opacity > 0);
      if (confettiParticles.length > 0) {
        confettiAnimId = requestAnimationFrame(animateConfetti);
      } else {
        teardownCelebration();
      }
    }
    confettiAnimId = requestAnimationFrame(animateConfetti);

    // Auto-dismiss banner after 4s
    setTimeout(() => {
      if (bannerEl) {
        bannerEl.style.transform = 'translate(-50%, -50%) scale(0)';
        setTimeout(() => { if (bannerEl) { bannerEl.remove(); bannerEl = null; } }, 500);
      }
    }, 4000);
  }

  function teardownCelebration() {
    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);
    if (confettiCanvas) { confettiCanvas.remove(); confettiCanvas = null; }
    confettiParticles = [];
  }

  // Physics constants (scaled for dt which is ~1.0 at 60fps)
  const GRAVITY = 0.6;
  const FRICTION = 0.82;
  const JUMP_FORCE = -14;
  const MOVE_SPEED = 7;
  const MAX_FALL_SPEED = 18;

  let player = {
    x: 100,
    y: 0,
    width: 32,
    height: 32,
    vx: 0,
    vy: 0,
    color: '#00e5ff',
    glow: '#00e5ff',
    grounded: false
  };

  let cameraX = 0;
  let cameraY = 0;
  
  // Milestones (Serious Content)
  const milestones = [
    {
      x: 400, y: 350,
      text: "Thapar Institute (2019-2023)", subtext: "B.E. Computer Science",
      logoSrc: './assets/images/Thapar_logo.jpg', logoId: 'thapar'
    },
    {
      x: 1400, y: 250,
      text: "NXP Semiconductors (2023-2024)", subtext: "Microprocessor Header Engineer",
      logoSrc: './assets/images/NXP_logo.avif', logoId: 'nxp'
    },
    {
      x: 2400, y: 150,
      text: "University of Toronto (2025-2026)", subtext: "MSc Applied Computing (AI)",
      logoSrc: 'https://upload.wikimedia.org/wikipedia/en/0/04/Utoronto_coa.svg',
      logoId: 'uoft'
    },
    {
      x: 3400, y: 200,
      text: "AMD (2026-Present)", subtext: "AI Intern - Generative AI",
      logoSrc: null, logoId: 'amd'
    },
    {
      x: 4400, y: 300,
      text: "The horizon keeps moving. \uD83D\uDE80", subtext: "The best chapters haven't been written yet.",
      logoSrc: null, logoId: null
    }
  ];

  // Helper: draw logo into a circle at (cx, cy) with given radius
  function drawLogo(id, cx, cy, r, img, imgReady) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    if (id === 'thapar') {
      if (imgReady) {
        // Real Thapar logo image
        ctx.fillStyle = '#e31b23';
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const scale = Math.min((r * 1.8) / iw, (r * 1.8) / ih);
        ctx.drawImage(img, cx - (iw * scale) / 2, cy - (ih * scale) / 2, iw * scale, ih * scale);
      } else {
        // Fallback: red bg with white 'ti'
        ctx.fillStyle = '#e31b23';
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${r * 0.95}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ti', cx, cy + r * 0.05);
      }

    } else if (id === 'nxp') {
      if (imgReady) {
        // Real NXP logo image
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const scale = Math.min((r * 1.9) / iw, (r * 1.9) / ih);
        ctx.drawImage(img, cx - (iw * scale) / 2, cy - (ih * scale) / 2, iw * scale, ih * scale);
      } else {
        // Fallback: colorful N-X-P letters
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        const sz = r * 0.72;
        ctx.font = `bold ${sz}px Outfit, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#f0a500'; ctx.textAlign = 'right';  ctx.fillText('N', cx - r * 0.02, cy);
        ctx.fillStyle = '#00aadd'; ctx.textAlign = 'center'; ctx.fillText('X', cx, cy);
        ctx.fillStyle = '#5cb85c'; ctx.textAlign = 'left';   ctx.fillText('P', cx + r * 0.02, cy);
      }

    } else if (id === 'amd') {
      // White bg, bold red AMD text
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = '#ed1c24';
      ctx.font = `bold ${r * 0.65}px Outfit, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AMD', cx, cy);

    } else if (id === 'uoft' && imgReady) {
      // White bg then contained image
      ctx.fillStyle = '#fff';
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const iw = img.naturalWidth;
      const ih = img.naturalHeight;
      const scale = Math.min((r * 1.8) / iw, (r * 1.8) / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    } else {
      // Fallback: purple circle with first letter
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    ctx.restore();
  }

  // Preload all logos
  milestones.forEach(m => {
    if (m.logoSrc) {
      const img = new Image();
      // Don't set crossOrigin for local assets — it causes CORS failures
      img.onload  = () => { m._imgReady = true; };
      img.onerror = () => { m._imgReady = false; };
      img.src = m.logoSrc;
      m._img = img;
      m._imgReady = false;
    }
  });

  // Jokes (Fun Content)
  const jokes = [
    { x: 800, y: 150, text: "Why do programmers prefer dark mode?", punchline: "Because light attracts bugs!" },
    { x: 1900, y: 100, text: "I'd tell you a UDP joke...", punchline: "But you might not get it." },
    { x: 2900, y: 50, text: "There are 10 types of people in the world:", punchline: "Those who understand binary, and those who don't." },
    { x: 3900, y: 100, text: "Hardware:", punchline: "The part of a computer you can kick." }
  ];

  // Collectible Bugs
  let bugs = [];
  function initBugs() {
    bugs = [
      { x: 600,  y: 350, collected: false },
      { x: 1200, y: 200, collected: false },
      { x: 1700, y: 150, collected: false },
      { x: 2200, y: 100, collected: false },
      { x: 2700, y: 150, collected: false },
      { x: 3200, y: 150, collected: false },
      { x: 3700, y: 200, collected: false },
      { x: 4200, y: 250, collected: false }
    ];
    // renderX/Y are used during the Easter egg animation
    bugs.forEach(b => { b.renderX = b.x; b.renderY = b.y; });
  }

  // ── LIGHT MODE EASTER EGG ────────────────────────────────────────
  let easterState   = 'none'; // 'none' | 'attracting' | 'returning'
  let easterTimeout = null;
  let bulbWorldX    = 0;
  let bulbWorldY    = 0;
  let showBulb      = false;

  function startLightEaster() {
    if (easterState !== 'none') return;
    easterState = 'attracting';
    showBulb = true;
    // Place bulb at current camera center in world space
    const rect = canvas.getBoundingClientRect();
    bulbWorldX = cameraX + rect.width  / 2;
    bulbWorldY = cameraY + rect.height / 3;
    if (easterTimeout) clearTimeout(easterTimeout);
    easterTimeout = setTimeout(() => {
      easterState = 'returning';
      easterTimeout = setTimeout(() => {
        easterState = 'none';
        showBulb = false;
        // Snap render positions back to world positions
        bugs.forEach(b => { b.renderX = b.x; b.renderY = b.y; });
      }, 3000);
    }, 7000);
  }

  function stopLightEaster() {
    if (easterTimeout) clearTimeout(easterTimeout);
    easterTimeout = null;
    easterState = 'none';
    showBulb = false;
    bugs.forEach(b => { b.renderX = b.x; b.renderY = b.y; });
  }

  // Generate platforms
  let platforms = [
    // Starting Ground
    { x: -500, y: 500, width: 1300, height: 400, color: '#1e293b' },
    // Step up
    { x: 900, y: 400, width: 250, height: 400, color: '#1e293b' },
    // NXP milestone platform
    { x: 1300, y: 350, width: 400, height: 20, color: '#334155' },
    // Floating steps
    { x: 1800, y: 280, width: 150, height: 20, color: '#334155' },
    { x: 2100, y: 220, width: 150, height: 20, color: '#334155' },
    // UofT platform
    { x: 2350, y: 250, width: 500, height: 20, color: '#334155' },
    // Gap and AMD
    { x: 3100, y: 300, width: 150, height: 20, color: '#334155' },
    { x: 3350, y: 300, width: 500, height: 20, color: '#334155' },
    // Step down to goal
    { x: 4000, y: 350, width: 150, height: 20, color: '#334155' },
    // Final Ground
    { x: 4300, y: 400, width: 1000, height: 400, color: '#1e293b' }
  ];

  // Particles for jumping/landing/collecting
  let particles = [];
  function createParticles(x, y, color, count, speed = 5) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 1) * speed,
        life: 1.0,
        color: color
      });
    }
  }

  // Input handling
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (gameRunning && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => keys[e.code] = false);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset any previous transform
    ctx.scale(dpr, dpr);
  }
  
  window.addEventListener('resize', resize);
  
  function init() {
    resize();
    overlay.style.display = 'none';
    gameRunning = true;
    canvas.focus();
    player.x = 100;
    player.y = 300;
    player.vx = 0;
    player.vy = 0;
    cameraX = 0;
    cameraY = 0;
    score = 0;
    celebrationTriggered = false;
    teardownCelebration();
    particles = [];
    initBugs();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  startBtn.addEventListener('click', init);

  function update(dt) {
    // Normalizing dt (assume 60fps = 1.0 dt)
    // Cap dt to avoid huge physics glitches if tab is inactive
    let timeScale = Math.min(dt / (1000/60), 2.0);

    // Horizontal Movement
    if (keys['KeyA'] || keys['ArrowLeft']) {
      player.vx -= 1.5 * timeScale;
    } else if (keys['KeyD'] || keys['ArrowRight']) {
      player.vx += 1.5 * timeScale;
    }
    
    // Friction and clamping
    player.vx *= Math.pow(FRICTION, timeScale);
    if (player.vx > MOVE_SPEED) player.vx = MOVE_SPEED;
    if (player.vx < -MOVE_SPEED) player.vx = -MOVE_SPEED;

    // Jumping
    if ((keys['KeyW'] || keys['ArrowUp'] || keys['Space']) && player.grounded) {
      player.vy = JUMP_FORCE;
      player.grounded = false;
      createParticles(player.x + player.width/2, player.y + player.height, player.color, 12, 6);
    }

    // Gravity
    player.vy += GRAVITY * timeScale;
    if (player.vy > MAX_FALL_SPEED) player.vy = MAX_FALL_SPEED;

    // Save previous position
    let prevX = player.x;
    let prevY = player.y;

    player.x += player.vx * timeScale;
    
    // Horizontal Collision
    platforms.forEach(p => {
      if (player.x < p.x + p.width && player.x + player.width > p.x &&
          player.y < p.y + p.height && player.y + player.height > p.y) {
        if (player.vx > 0) {
          player.x = p.x - player.width;
          player.vx = 0;
        } else if (player.vx < 0) {
          player.x = p.x + p.width;
          player.vx = 0;
        }
      }
    });

    player.y += player.vy * timeScale;
    
    // Vertical Collision
    let wasGrounded = player.grounded;
    player.grounded = false;
    platforms.forEach(p => {
      if (player.x < p.x + p.width && player.x + player.width > p.x &&
          player.y < p.y + p.height && player.y + player.height > p.y) {
        if (player.vy >= 0 && prevY + player.height <= p.y + 1 + (player.vy * timeScale)) { 
          player.y = p.y - player.height;
          player.vy = 0;
          player.grounded = true;
          if (!wasGrounded) createParticles(player.x + player.width/2, player.y + player.height, '#fff', 5);
        } else if (player.vy < 0 && prevY >= p.y + p.height - 1 + (player.vy * timeScale)) { 
          player.y = p.y + p.height;
          player.vy = 0;
        }
      }
    });

    // ── Easter egg: animate bug render positions ──────────────────
    if (easterState === 'attracting' || easterState === 'returning') {
      bugs.forEach(b => {
        if (b.collected) return;
        const targetX = easterState === 'attracting' ? bulbWorldX - 10 : b.x;
        const targetY = easterState === 'attracting' ? bulbWorldY - 10 : b.y;
        b.renderX += (targetX - b.renderX) * 0.04 * timeScale;
        b.renderY += (targetY - b.renderY) * 0.04 * timeScale;
      });
    } else {
      // Normally keep render in sync with world position (for floating)
      bugs.forEach(b => { if (!b.collected) { b.renderX = b.x; b.renderY = b.y; } });
    }

    // Check Bug Collection
    bugs.forEach(bug => {
      if (!bug.collected) {
        let bx = bug.x + 10;
        let by = bug.y + 10;
        let px = player.x + player.width/2;
        let py = player.y + player.height/2;
        let dist = Math.hypot(bx - px, by - py);
        if (dist < 30) {
          bug.collected = true;
          score++;
          createParticles(bx, by, '#10b981', 20, 8);
          // Check if all collected
          if (!celebrationTriggered && score === bugs.length) {
            celebrationTriggered = true;
            launchCelebration();
          }
        }
      }
    });

    // Fall out of bounds → clean reset to start
    if (player.y > 1500) {
      player.x = 100;
      player.y = 300;
      player.vy = 0;
      player.vx = 0;
      player.grounded = false;
      cameraX = 0;
      cameraY = 0;
      // Spawn a burst of red particles at respawn point
      createParticles(player.x + player.width/2, player.y + player.height/2, '#ef4444', 30, 10);
    }

    // Update Particles
    particles.forEach(p => {
      p.x += p.vx * timeScale;
      p.y += p.vy * timeScale;
      p.life -= 0.02 * timeScale;
    });
    particles = particles.filter(p => p.life > 0);

    // Smooth Camera Follow
    const rect = canvas.getBoundingClientRect();
    const logicalWidth = rect.width;
    const logicalHeight = rect.height;
    
    let targetCameraX = player.x - logicalWidth / 3;
    let targetCameraY = player.y - logicalHeight / 1.5;
    
    if (targetCameraX < 0) targetCameraX = 0;
    
    // Fast follow rate
    cameraX += (targetCameraX - cameraX) * 0.15 * timeScale;
    cameraY += (targetCameraY - cameraY) * 0.15 * timeScale;
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    const logicalWidth = rect.width;
    const logicalHeight = rect.height;

    // Clear background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    // Draw Score
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 18px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`🐛 Bugs Squashed: ${score} / ${bugs.length}`, 30, 38);

    // Warning: don't turn on light mode (pulses to hint at the Easter egg)
    const warnAlpha = 0.6 + Math.sin(Date.now() / 400) * 0.4;
    ctx.globalAlpha = warnAlpha;
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px Outfit, sans-serif';
    ctx.fillText('⚠️  Warning: Do NOT turn on light mode', 30, 60);
    ctx.globalAlpha = 1.0;

    // Draw grid background (parallax)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    let offsetX = -(cameraX * 0.3) % 100;
    let offsetY = -(cameraY * 0.3) % 100;
    ctx.beginPath();
    for(let i = offsetX; i < logicalWidth; i += 100) {
      ctx.moveTo(i, 0); ctx.lineTo(i, logicalHeight);
    }
    for(let i = offsetY; i < logicalHeight; i += 100) {
      ctx.moveTo(0, i); ctx.lineTo(logicalWidth, i);
    }
    ctx.stroke();
    ctx.restore();

    ctx.save();
    // Round camera position to prevent subpixel rendering tearing
    ctx.translate(-Math.round(cameraX), -Math.round(cameraY));

    // Draw Platforms
    platforms.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.width, p.height);
      
      // Neon top edge
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.width, 3);
    });

    // Draw Bugs
    bugs.forEach(bug => {
      if (!bug.collected) {
        const bx = Math.round(bug.renderX);
        const by = Math.round(bug.renderY);
        // Only add float bob when not in easter egg
        const floatOff = (easterState === 'none') ? Math.sin(Date.now() / 200 + bug.x) * 5 : 0;
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(bx + 10, by + 10 + floatOff, 8, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // Antenna
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + 10, by + 2 + floatOff); ctx.lineTo(bx + 5,  by - 4 + floatOff);
        ctx.moveTo(bx + 10, by + 2 + floatOff); ctx.lineTo(bx + 15, by - 4 + floatOff);
        ctx.stroke();
      }
    });

    // Draw Light Bulb (Easter Egg)
    if (showBulb) {
      const bx = Math.round(bulbWorldX);
      const by = Math.round(bulbWorldY);
      const pulse = 1 + Math.sin(Date.now() / 200) * 0.08;
      // Glow halo
      const halo = ctx.createRadialGradient(bx, by, 10, bx, by, 80 * pulse);
      halo.addColorStop(0,   'rgba(255, 230, 80, 0.35)');
      halo.addColorStop(1,   'rgba(255, 230, 80, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(bx, by, 80 * pulse, 0, Math.PI*2);
      ctx.fill();
      // Bulb body
      ctx.fillStyle = '#fde68a';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(bx, by - 10, 24 * pulse, 0, Math.PI*2);
      ctx.fill();
      // Bulb base
      ctx.fillStyle = '#d1d5db';
      ctx.shadowBlur = 0;
      ctx.fillRect(bx - 10, by + 14, 20, 8);
      ctx.fillRect(bx - 7,  by + 22, 14, 5);
      // "Light attracts bugs!" caption
      ctx.fillStyle = '#fef9c3';
      ctx.font = 'bold 15px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('💡 Why do programmers prefer dark mode?', bx, by - 50);
      ctx.fillStyle = '#fde68a';
      ctx.font = '13px Outfit, sans-serif';
      ctx.fillText('Because light attracts bugs! 🐛', bx, by - 30);
    }

    // Draw Jokes
    jokes.forEach(j => {
      let floatY = Math.sin(Date.now() / 400 + j.x) * 4;
      ctx.fillStyle = 'rgba(236, 72, 153, 0.1)';
      ctx.roundRect(Math.round(j.x - 200), Math.round(j.y + floatY - 40), 400, 70, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(236, 72, 153, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ec4899';
      ctx.font = 'bold 16px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(j.text, Math.round(j.x), Math.round(j.y + floatY - 15));
      ctx.fillStyle = '#fbcfe8';
      ctx.font = '14px Outfit, sans-serif';
      ctx.fillText(j.punchline, Math.round(j.x), Math.round(j.y + floatY + 10));
    });

    // Draw Milestones
    milestones.forEach(m => {
      let floatY = Math.sin(Date.now() / 400 + m.x) * 8;
      const BOX_W = 330;
      const BOX_H = 68;
      const LOGO_SIZE = 44;
      const LOGO_PAD = 10;
      const boxX = Math.round(m.x);
      const boxY = Math.round(m.y + floatY - 70);

      // Connecting line from box bottom to platform
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(boxX + BOX_W / 2, boxY + BOX_H);
      ctx.lineTo(boxX + BOX_W / 2, boxY + BOX_H + 100);
      ctx.stroke();

      // Node at bottom of line
      ctx.beginPath();
      ctx.arc(boxX + BOX_W / 2, boxY + BOX_H + 10, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#a855f7';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Info box background
      ctx.fillStyle = 'rgba(10, 15, 30, 0.88)';
      ctx.roundRect(boxX, boxY, BOX_W, BOX_H, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw logo circle
      const hasLogo = !!m.logoId;
      if (hasLogo) {
        const lx = boxX + LOGO_PAD;
        const ly = boxY + (BOX_H - LOGO_SIZE) / 2;
        const cx = lx + LOGO_SIZE / 2;
        const cy = ly + LOGO_SIZE / 2;
        drawLogo(m.logoId, cx, cy, LOGO_SIZE / 2, m._img, m._imgReady);
      }

      // Text (offset right of logo if present)
      const textX = hasLogo ? boxX + LOGO_PAD + LOGO_SIZE + 10 : boxX + BOX_W / 2;
      ctx.textAlign = hasLogo ? 'left' : 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px Outfit, sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(m.text, textX, boxY + 28);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px Outfit, sans-serif';
      ctx.fillText(m.subtext, textX, boxY + 48);
    });

    // Draw Particles
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(Math.round(p.x), Math.round(p.y), 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw Player
    ctx.fillStyle = player.color;
    ctx.shadowColor = player.glow;
    ctx.shadowBlur = 15;
    
    // Squeeze animation when moving vertically
    let stretchX = 1.0;
    let stretchY = 1.0;
    if (Math.abs(player.vy) > 1) {
      stretchY = 1.2;
      stretchX = 0.8;
    } else if (Math.abs(player.vx) > 0.5) {
      // lean into running
      stretchX = 1.1;
      stretchY = 0.9;
    }
    
    let drawW = player.width * stretchX;
    let drawH = player.height * stretchY;
    let drawX = player.x + (player.width - drawW)/2;
    let drawY = player.y + (player.height - drawH);

    ctx.fillRect(Math.round(drawX), Math.round(drawY), Math.round(drawW), Math.round(drawH));
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  function loop(time) {
    if (!gameRunning) return;
    
    let dt = time - lastTime;
    lastTime = time;
    
    // Prevent huge jumps if tab was inactive
    if (dt > 100) dt = 100;

    update(dt);
    draw();
    
    requestAnimationFrame(loop);
  }

  // Handle SPA view switching
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target.id === 'view-game') {
        if (mutation.target.classList.contains('active-view')) {
          resize();
          canvas.focus();
        } else {
          gameRunning = false;
          overlay.style.display = 'flex';
          stopLightEaster();
        }
      }
    });
  });

  const viewGame = document.getElementById('view-game');
  if (viewGame) {
    observer.observe(viewGame, { attributes: true, attributeFilter: ['class'] });
  }

  // Watch for light-mode toggle to trigger Easter egg
  const themeObserver = new MutationObserver(() => {
    const isLightMode = document.documentElement.classList.contains('light-mode');
    const isGameActive = document.getElementById('view-game')?.classList.contains('active-view');
    if (isGameActive && gameRunning) {
      if (isLightMode) {
        startLightEaster();
      } else {
        stopLightEaster();
      }
    }
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

})();
