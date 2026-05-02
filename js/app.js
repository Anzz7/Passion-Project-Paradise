/* ============================================================
   app.js — shared utilities for Passion Project Paradise
   ============================================================ */

'use strict';

// ── Storage helpers ──────────────────────────────────────────
const Store = {
  get(key, fallback = null) {
    try { return JSON.parse(localStorage.getItem('ppp_' + key)) ?? fallback; }
    catch { return fallback; }
  },
  set(key, value) { localStorage.setItem('ppp_' + key, JSON.stringify(value)); },
  remove(key) { localStorage.removeItem('ppp_' + key); },
  clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('ppp_'))
      .forEach(k => localStorage.removeItem(k));
  }
};

// ── User profile ─────────────────────────────────────────────
const User = {
  get name() { return Store.get('user_name', ''); },
  set name(v) { Store.set('user_name', v); },
  get apiYoutube() { return Store.get('api_youtube', ''); },
  set apiYoutube(v) { Store.set('api_youtube', v); },
  get apiGemini() { return Store.get('api_gemini', ''); },
  set apiGemini(v) { Store.set('api_gemini', v); },
  get notificationsEnabled() { return Store.get('notif_enabled', false); },
  set notificationsEnabled(v) { Store.set('notif_enabled', v); },
};

// ── Toast notifications ───────────────────────────────────────
const Toast = {
  container: null,
  init() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },
  show(msg, type = 'default', duration = 3500) {
    if (!this.container) this.init();
    const icons = { success: '✓', error: '✕', warning: '⚠', default: '💡' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${icons[type] || icons.default}</span><span>${msg}</span>`;
    this.container.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'toastOut 0.3s ease forwards';
      setTimeout(() => t.remove(), 300);
    }, duration);
    return t;
  },
  success(m, d) { return this.show(m, 'success', d); },
  error(m, d) { return this.show(m, 'error', d); },
  warn(m, d) { return this.show(m, 'warning', d); },
};

// ── Ripple effect ─────────────────────────────────────────────
function addRipple(el) {
  el.addEventListener('click', function(e) {
    const r = document.createElement('span');
    r.className = 'ripple';
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    r.style.cssText = `
      width:${size}px; height:${size}px;
      left:${e.clientX - rect.left - size/2}px;
      top:${e.clientY - rect.top - size/2}px;
    `;
    this.appendChild(r);
    setTimeout(() => r.remove(), 700);
  });
}
function applyRipples() {
  document.querySelectorAll('.btn, .hub-card, .feature-tile').forEach(addRipple);
}

// ── 3-D tilt on hover ─────────────────────────────────────────
function applyTilt(el, strength = 18) {
  el.addEventListener('mousemove', e => {
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / strength;
    const y = (e.clientY - rect.top - rect.height / 2) / strength;
    el.style.transform = `perspective(800px) rotateY(${x}deg) rotateX(${-y}deg) translateY(-6px)`;
  });
  el.addEventListener('mouseleave', () => {
    el.style.transform = '';
    el.style.transition = 'transform 0.45s var(--ease)';
    setTimeout(() => { el.style.transition = ''; }, 450);
  });
}
function applyTilts() {
  document.querySelectorAll('.hub-card').forEach(el => applyTilt(el));
}

// ── Scroll reveal ─────────────────────────────────────────────
function initScrollReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ── Smooth scroll header ──────────────────────────────────────
function initStickyHeader() {
  const h = document.querySelector('.site-header');
  if (!h) return;
  window.addEventListener('scroll', () => h.classList.toggle('scrolled', window.scrollY > 20), { passive: true });
}

// ── Greeting text ─────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  const name = User.name;
  const suffix = name ? `, ${name}` : '';
  if (h < 5)  return `Still up${suffix}? Ideas don't sleep either.`;
  if (h < 12) return `Good morning${suffix}! What's brewing today?`;
  if (h < 17) return `Good afternoon${suffix}. Let's create something.`;
  if (h < 21) return `Good evening${suffix}. Your ideas are waiting.`;
  return `Late night ideating${suffix}? The best ideas come now.`;
}

// ── Notification system ───────────────────────────────────────
const Notifs = {
  async requestPermission() {
    if (!('Notification' in window)) return false;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  },

  schedule(ideaId, ideaTitle, type) {
    const reminders = Store.get('reminders', []);
    if (reminders.find(r => r.ideaId === ideaId && r.type === (type || 'idea'))) return;
    reminders.push({
      ideaId,
      ideaTitle,
      type: type || 'idea',
      scheduledFor: Date.now() + 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
      repeat: true
    });
    Store.set('reminders', reminders);
  },

  cancel(ideaId, type) {
    let reminders = Store.get('reminders', []);
    if (type) {
      reminders = reminders.filter(r => !(r.ideaId === ideaId && r.type === type));
    } else {
      reminders = reminders.filter(r => r.ideaId !== ideaId);
    }
    Store.set('reminders', reminders);
  },

  markProgressed(ideaId) {
    const reminders = Store.get('reminders', []);
    const updated = reminders.filter(r => !(r.ideaId === ideaId && r.type === 'idea'));
    Store.set('reminders', updated);
  },

  checkDue() {
    if (!User.notificationsEnabled) return;
    this._autoCleanup();
    const reminders = Store.get('reminders', []);
    const now = Date.now();
    let changed = false;
    reminders.forEach(r => {
      if (now >= r.scheduledFor) {
        this._fire(r);
        r.scheduledFor = now + 24 * 60 * 60 * 1000;
        changed = true;
      }
    });
    if (changed) Store.set('reminders', reminders);
    this._showBanner(reminders);
  },

  _autoCleanup() {
    const reminders = Store.get('reminders', []);
    const ideas = Store.get('ideas', []);
    const projects = Store.get('projects', []);
    const ideaIds = new Set(ideas.map(i => i.id));
    const projectIdeaIds = new Set(projects.filter(p => p.fromIdea).map(p => p.fromIdea));

    const cleaned = reminders.filter(r => {
      if (r.type === 'idea') {
        if (!ideaIds.has(r.ideaId)) return false;
        if (projectIdeaIds.has(r.ideaId)) return false;
      }
      if (r.type === 'learning' || r.type === 'project') {
        if (!ideaIds.has(r.ideaId) && !projects.find(p => p.id === r.ideaId)) return false;
      }
      return true;
    });

    if (cleaned.length !== reminders.length) Store.set('reminders', cleaned);
  },

  _fire(reminder) {
    if (Notification.permission !== 'granted') return;
    const messages = {
      idea: `Your idea "${reminder.ideaTitle}" is still waiting to be developed!`,
      learning: `Keep learning! Continue your course for "${reminder.ideaTitle}".`,
      project: `Check in on your project plan for "${reminder.ideaTitle}".`,
    };
    new Notification('Passion Project Paradise', {
      body: messages[reminder.type] || messages.idea,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%235856D6"/><text y=".9em" font-size="80" x="10">💡</text></svg>'
    });
  },

  _showBanner(reminders) {
    const due = reminders.filter(r => Date.now() >= r.scheduledFor - 24 * 60 * 60 * 1000);
    if (!due.length) return;
    const banner = document.getElementById('reminder-banner');
    if (!banner) return;
    const r = due[0];
    const textEl = banner.querySelector('.reminder-text');
    const linkEl = banner.querySelector('a');
    if (r.type === 'idea') {
      textEl.textContent = `Your idea "${r.ideaTitle}" is waiting to be developed.`;
      if (linkEl) { linkEl.textContent = 'Pick it up →'; linkEl.href = 'brainstorm.html?mode=history'; }
    } else if (r.type === 'learning') {
      textEl.textContent = `Continue learning: "${r.ideaTitle}"`;
      if (linkEl) { linkEl.textContent = 'Open courses →'; linkEl.href = 'learning.html'; }
    } else if (r.type === 'project') {
      textEl.textContent = `Check in on "${r.ideaTitle}"`;
      if (linkEl) { linkEl.textContent = 'View plan →'; linkEl.href = 'projects.html'; }
    }
    banner.classList.add('show');
    setTimeout(() => banner.classList.remove('show'), 7000);
  }
};

// ── Confetti 🎉 ───────────────────────────────────────────────
function fireConfetti() {
  const colors = ['#DC2626', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#F97316'];
  for (let i = 0; i < 90; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 10 + 5;
    const isCircle = Math.random() > 0.5;
    el.style.cssText = `
      left:${Math.random() * 100}vw;
      width:${size}px; height:${size}px;
      background:${color};
      border-radius:${isCircle ? '50%' : '2px'};
      animation-delay:${Math.random() * 1.5}s;
      animation-duration:${Math.random() * 2 + 2.5}s;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }
}

// ── Page routing helpers ──────────────────────────────────────
function navigate(page) {
  const pages = {
    home: 'index.html',
    brainstorm: 'brainstorm.html',
    learning: 'learning.html',
    projects: 'projects.html',
    settings: 'settings.html',
  };
  if (pages[page]) window.location.href = pages[page];
}

// ── Format date ───────────────────────────────────────────────
function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function timeAgo(ts) {
  const diff = Date.now() - ts;
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d} days ago`;
}

// ── Time-of-day gradient background ──────────────────────────
function applyTimeGradient() {
  const h = new Date().getHours();
  const m = new Date().getMinutes();
  const t = h + m / 60;

  const gradients = [
    // 0-5: deep night — dark indigo/navy
    { stop: 0,  colors: ['#0a0a1a', '#111133', '#1a1a3e'] },
    // 5-6: pre-dawn — deep blue to purple hint
    { stop: 5,  colors: ['#111133', '#1e1e4a', '#2d1b4e'] },
    // 6-7: dawn — purple, pink, warm gold
    { stop: 6,  colors: ['#2d1b4e', '#b44e75', '#f4a261'] },
    // 7-8: sunrise — warm peach, soft gold
    { stop: 7,  colors: ['#f4a261', '#fcd5b5', '#fef0e1'] },
    // 8-12: morning — light cream/blue
    { stop: 8,  colors: ['#e8f0fe', '#f0f4f8', '#fafbfd'] },
    // 12-14: midday — bright subtle warmth
    { stop: 12, colors: ['#f5f7fa', '#eef1f5', '#fafbfd'] },
    // 14-17: afternoon — warm whites
    { stop: 14, colors: ['#faf8f5', '#f5f0eb', '#fef9f4'] },
    // 17-18: golden hour — warm amber tones
    { stop: 17, colors: ['#fef0e1', '#fcd5b5', '#f8c291'] },
    // 18-19: sunset — orange, pink, purple
    { stop: 18, colors: ['#f8c291', '#e77f8a', '#8e6aae'] },
    // 19-20: dusk — deep purple, blue
    { stop: 19, colors: ['#8e6aae', '#4a4e8a', '#2b2d5e'] },
    // 20-24: night — dark indigo
    { stop: 20, colors: ['#1e1e4a', '#151535', '#0a0a1a'] },
  ];

  function lerp(a, b, f) { return a + (b - a) * f; }
  function lerpColor(c1, c2, f) {
    const r1 = parseInt(c1.slice(1,3), 16), g1 = parseInt(c1.slice(3,5), 16), b1 = parseInt(c1.slice(5,7), 16);
    const r2 = parseInt(c2.slice(1,3), 16), g2 = parseInt(c2.slice(3,5), 16), b2 = parseInt(c2.slice(5,7), 16);
    const r = Math.round(lerp(r1, r2, f)), g = Math.round(lerp(g1, g2, f)), b = Math.round(lerp(b1, b2, f));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
  }

  let prev = gradients[gradients.length - 1], next = gradients[0];
  for (let i = 0; i < gradients.length; i++) {
    if (t >= gradients[i].stop) {
      prev = gradients[i];
      next = gradients[(i + 1) % gradients.length];
    }
  }

  const range = (next.stop > prev.stop) ? next.stop - prev.stop : (24 - prev.stop + next.stop);
  const elapsed = (t >= prev.stop) ? t - prev.stop : (24 - prev.stop + t);
  const frac = Math.min(elapsed / range, 1);

  const c1 = lerpColor(prev.colors[0], next.colors[0], frac);
  const c2 = lerpColor(prev.colors[1], next.colors[1], frac);
  const c3 = lerpColor(prev.colors[2], next.colors[2], frac);

  document.body.style.background = `linear-gradient(160deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
  document.body.style.backgroundAttachment = 'fixed';

  const lum = (parseInt(c1.slice(1,3), 16) * 0.299 + parseInt(c1.slice(3,5), 16) * 0.587 + parseInt(c1.slice(5,7), 16) * 0.114);
  const isDark = lum < 128;
  document.documentElement.classList.toggle('dark-time', isDark);
}

// ── Init all shared behaviors ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  Toast.init();
  applyTimeGradient();
  applyRipples();
  applyTilts();
  initScrollReveal();
  initStickyHeader();
  Notifs.checkDue();

  // Mark active nav link
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.dataset.page && path.includes(link.dataset.page)) {
      link.classList.add('active');
    }
  });

  // Name prompt on first visit
  if (!User.name) {
    const inp = document.getElementById('name-prompt-input');
    if (inp) {
      const saved = prompt('Welcome to Passion Project Paradise! What should I call you?');
      if (saved && saved.trim()) {
        User.name = saved.trim();
      }
    }
  }
});

// Expose globally
window.PPP = { Store, User, Toast, Notifs, fireConfetti, navigate, formatDate, timeAgo, getGreeting, applyTimeGradient };
