/* ============================================================
   settings.js — Settings page logic
   ============================================================ */

'use strict';

window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  updateStats();
  loadSuggestions();
});

// ── Load saved values into form ───────────────────────────────
function loadSettings() {
  const nameInp = document.getElementById('name-input');
  if (nameInp) nameInp.value = PPP.User.name || '';

  const ytInp = document.getElementById('yt-key-input');
  if (ytInp) ytInp.value = PPP.User.apiYoutube || '';

  const gemInp = document.getElementById('gemini-key-input');
  if (gemInp) gemInp.value = PPP.User.apiGemini || '';

  // Notifications toggle
  const enabled = PPP.User.notificationsEnabled;
  const toggle = document.getElementById('notif-toggle');
  const label  = document.getElementById('notif-label');
  if (toggle) toggle.classList.toggle('on', enabled);
  if (label)  label.textContent = enabled ? 'On' : 'Off';
  updateNotifStatus();
}

// ── Save name ─────────────────────────────────────────────────
function saveName() {
  const val = document.getElementById('name-input')?.value.trim();
  if (!val) { PPP.Toast.error('Please enter a name.'); return; }
  PPP.User.name = val;
  PPP.Toast.success(`Got it — welcome, ${val}! 👋`);
}

// ── Save API keys ─────────────────────────────────────────────
function saveApiKeys() {
  const yt  = document.getElementById('yt-key-input')?.value.trim() || '';
  const gem = document.getElementById('gemini-key-input')?.value.trim() || '';
  PPP.User.apiYoutube = yt;
  PPP.User.apiGemini  = gem;
  PPP.Toast.success('API keys saved!');
}

// ── Show/hide API key ─────────────────────────────────────────
function toggleKey(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const isHidden = inp.type === 'password';
  inp.type = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? 'Hide' : 'Show';
}

// ── Notifications ─────────────────────────────────────────────
async function toggleNotifications(toggleEl) {
  const currentlyOn = toggleEl.classList.contains('on');
  const label = document.getElementById('notif-label');

  if (currentlyOn) {
    // Turn off
    toggleEl.classList.remove('on');
    label.textContent = 'Off';
    PPP.User.notificationsEnabled = false;
    PPP.Store.set('reminders', []);
    updateNotifStatus();
    PPP.Toast.show('Reminders turned off.');
    return;
  }

  // Turn on — request permission first
  if (!('Notification' in window)) {
    PPP.Toast.error('Your browser does not support notifications.');
    return;
  }

  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    toggleEl.classList.add('on');
    label.textContent = 'On';
    PPP.User.notificationsEnabled = true;
    updateNotifStatus();
    PPP.Toast.success('Reminders enabled! You\'ll be nudged about undeveloped ideas.');
    // Show a test notification
    new Notification('Passion Project Paradise 🔴', {
      body: 'Reminders are on! We\'ll check in about your ideas.',
    });
  } else if (perm === 'denied') {
    PPP.Toast.error('Permission denied. Enable notifications in your browser settings.');
  } else {
    PPP.Toast.warn('Notification permission was dismissed.');
  }
}

function updateNotifStatus() {
  const statusWrap = document.getElementById('notif-status');
  const statusText = document.getElementById('notif-status-text');
  if (!statusWrap || !statusText) return;

  if (!('Notification' in window)) {
    statusWrap.style.display = '';
    statusText.textContent = '⚠ Your browser does not support notifications.';
    return;
  }

  if (Notification.permission === 'denied') {
    statusWrap.style.display = '';
    statusText.textContent = '🚫 Notifications are blocked. To enable, click the lock icon in your browser address bar and allow notifications for this site.';
    return;
  }

  if (PPP.User.notificationsEnabled) {
    const reminders = PPP.Store.get('reminders', []);
    statusWrap.style.display = '';
    statusText.textContent = reminders.length
      ? `✓ Active — tracking ${reminders.length} idea reminder${reminders.length > 1 ? 's' : ''}.`
      : '✓ Active — no pending reminders right now.';
  } else {
    statusWrap.style.display = 'none';
  }
}

// ── Stats ─────────────────────────────────────────────────────
function updateStats() {
  const ideas     = PPP.Store.get('ideas', []);
  const courses   = PPP.Store.get('saved_courses', []);
  const projects  = PPP.Store.get('projects', []);
  const reminders = PPP.Store.get('reminders', []);

  setText('stat-ideas',     ideas.length);
  setText('stat-courses',   courses.length);
  setText('stat-projects',  projects.length);
  setText('stat-reminders', reminders.length);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Feature suggestions ───────────────────────────────────────
function loadSuggestions() {
  const suggestions = PPP.Store.get('feature_suggestions', []);
  const section = document.getElementById('suggestions-section');
  const listEl  = document.getElementById('suggestions-list');
  if (!section || !listEl) return;

  if (!suggestions.length) { section.style.display = 'none'; return; }

  section.style.display = '';
  listEl.innerHTML = suggestions.map((s, i) => `
    <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--separator)">
      <span class="badge badge-gray">#${i + 1}</span>
      <div style="flex:1">
        <p style="font-size:0.9rem">${escHtml(s.text)}</p>
        <p class="small muted">${PPP.formatDate(s.ts)}</p>
      </div>
    </div>
  `).join('');
}

function clearSuggestions() {
  PPP.Store.remove('feature_suggestions');
  loadSuggestions();
  PPP.Toast.success('Suggestions cleared.');
}

// ── Data clearing ─────────────────────────────────────────────
function clearSection(key, label) {
  if (!confirm(`Clear all ${label}? This cannot be undone.`)) return;
  PPP.Store.remove(key);
  if (key === 'ideas') PPP.Store.remove('reminders');
  updateStats();
  PPP.Toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} cleared.`);
}

function resetAll() {
  if (!confirm('Reset EVERYTHING? This will delete all your ideas, courses, project plans, API keys, and preferences. This cannot be undone.')) return;
  PPP.Store.clearAll();
  PPP.Toast.success('All data cleared. Starting fresh!');
  setTimeout(() => window.location.href = 'index.html', 1500);
}

function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── API Setup Guide ──────────────────────────────────────────
const guideData = {
  youtube: {
    title: 'YouTube Data API v3',
    subtitle: 'Free tier gives you 10,000 units/day — more than enough for searching tutorials.',
    steps: [
      'Go to <a href="https://console.cloud.google.com" target="_blank">console.cloud.google.com</a> and sign in with your Google account.',
      'Click <strong>Select a project</strong> at the top, then <strong>New Project</strong>. Name it anything (e.g. "PPP") and click <strong>Create</strong>.',
      'Open the navigation menu <strong>☰ → APIs &amp; Services → Library</strong>. Search for <code>YouTube Data API v3</code> and click <strong>Enable</strong>.',
      'Go to <strong>☰ → APIs &amp; Services → Credentials</strong>. Click <strong>+ Create Credentials → API key</strong>.',
      'Copy the key and paste it into the <strong>YouTube Data API v3</strong> field on this page, then click <strong>Save API Keys</strong>.',
    ],
  },
  gemini: {
    title: 'Google Gemini API',
    subtitle: 'The free tier includes 15 requests/minute — perfect for generating project plans.',
    steps: [
      'Visit <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> and sign in with your Google account.',
      'Click <strong>Create API key</strong>. If prompted, select your Google Cloud project (or create a new one).',
      'Your API key will appear — click the <strong>copy</strong> icon next to it.',
      'Paste the key into the <strong>Google Gemini API</strong> field on this page, then click <strong>Save API Keys</strong>.',
    ],
  },
};

let guideType = null;
let guideStep = 0;

function openGuide(type) {
  guideType = type;
  guideStep = 0;
  const data = guideData[type];
  document.getElementById('guide-label').textContent = 'Setup Guide';
  document.getElementById('guide-title').textContent = data.title;
  document.getElementById('guide-subtitle').textContent = data.subtitle;
  renderGuideDots(data.steps.length);
  renderGuideStep();
  document.getElementById('guide-modal').classList.add('open');
}

function closeGuide() {
  document.getElementById('guide-modal').classList.remove('open');
}

function guideNav(dir) {
  const total = guideData[guideType].steps.length;
  guideStep = Math.max(0, Math.min(total - 1, guideStep + dir));
  renderGuideStep();
}

function renderGuideDots(total) {
  const wrap = document.getElementById('guide-dots');
  wrap.innerHTML = '';
  for (let i = 0; i < total; i++) {
    const dot = document.createElement('div');
    dot.className = 'guide-dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('data-i', i);
    dot.addEventListener('click', () => { guideStep = i; renderGuideStep(); });
    wrap.appendChild(dot);
  }
}

function renderGuideStep() {
  const data = guideData[guideType];
  const total = data.steps.length;
  const stepsEl = document.getElementById('guide-steps');
  stepsEl.innerHTML = `<div class="guide-step"><span class="guide-step-num">${guideStep + 1}</span>${data.steps[guideStep]}</div>`;

  document.getElementById('guide-prev').style.visibility = guideStep === 0 ? 'hidden' : '';
  const nextBtn = document.getElementById('guide-next');
  if (guideStep === total - 1) {
    nextBtn.textContent = 'Done ✓';
    nextBtn.onclick = closeGuide;
  } else {
    nextBtn.textContent = 'Next →';
    nextBtn.onclick = () => guideNav(1);
  }

  document.querySelectorAll('#guide-dots .guide-dot').forEach((d, i) => {
    d.classList.toggle('active', i === guideStep);
  });
}
