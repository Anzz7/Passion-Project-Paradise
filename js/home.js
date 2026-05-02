/* ============================================================
   home.js — home page logic
   ============================================================ */

'use strict';

// ── Greeting & typed subtext ──────────────────────────────────
(function initGreeting() {
  const greetEl = document.getElementById('greeting-text');
  if (greetEl) greetEl.textContent = PPP.getGreeting();

  const lines = [
    'Start a brainstorm session...',
    'Find tutorials and courses...',
    'Build your project plan...',
    'Turn ideas into action...',
    'What are you working on today?',
  ];
  let lineIdx = 0, charIdx = 0, deleting = false;
  const el = document.getElementById('typed-text');
  if (!el) return;

  function type() {
    const line = lines[lineIdx];
    if (deleting) {
      charIdx--;
      el.textContent = line.slice(0, charIdx);
      if (charIdx === 0) {
        deleting = false;
        lineIdx = (lineIdx + 1) % lines.length;
        setTimeout(type, 500);
        return;
      }
      setTimeout(type, 40);
    } else {
      charIdx++;
      el.textContent = line.slice(0, charIdx);
      if (charIdx === line.length) {
        deleting = true;
        setTimeout(type, 2200);
        return;
      }
      setTimeout(type, 65);
    }
  }
  setTimeout(type, 800);
})();

// ── Smart input bar ────────────────────────────────────────────
(function initSmartInput() {
  const input = document.getElementById('smart-input');
  const sugBox = document.getElementById('smart-suggestions');
  const submitBtn = document.getElementById('smart-submit');
  if (!input) return;

  const features = [
    { label: 'Brainstorm a new idea', icon: '💡', dest: 'brainstorm.html', keywords: ['brainstorm','idea','think','explore','create','spark','concept','imagine','dream'] },
    { label: 'Develop an existing idea', icon: '🔨', dest: 'brainstorm.html?mode=develop', keywords: ['develop','refine','build','improve','expand','elaborate','flesh'] },
    { label: 'Find tutorials & courses', icon: '📚', dest: 'learning.html', keywords: ['learn','course','tutorial','video','youtube','study','skill','how to','watch','resource'] },
    { label: 'Build a project plan', icon: '🗓️', dest: 'projects.html', keywords: ['plan','schedule','syllabus','project','goal','timeline','organize','roadmap','steps'] },
    { label: 'Browse my saved ideas', icon: '📂', dest: 'brainstorm.html?mode=history', keywords: ['history','past','saved','previous','archive','old','review'] },
    { label: 'Continue a past project', icon: '▶️', dest: 'projects.html', keywords: ['continue','resume','ongoing','current','progress','pick up'] },
    { label: 'Change settings', icon: '⚙️', dest: 'settings.html', keywords: ['settings','configure','api','key','name','preferences','notification'] },
  ];

  function match(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return features.filter(f => f.keywords.some(k => q.includes(k) || k.includes(q)));
  }

  function renderSuggestions(results) {
    sugBox.innerHTML = '';
    if (!results.length) {
      sugBox.innerHTML = `
        <div class="suggestion-item" onclick="showFeatureModal('${escapeHtml(input.value)}')">
          <span class="suggestion-icon">🗺️</span>
          <span>Explore all features &amp; suggest your own</span>
        </div>`;
    } else {
      results.slice(0, 4).forEach(f => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = `<span class="suggestion-icon">${f.icon}</span><span>${f.label}</span>`;
        item.addEventListener('click', () => window.location.href = f.dest);
        sugBox.appendChild(item);
      });
    }
    sugBox.classList.add('open');
  }

  input.addEventListener('input', () => {
    const v = input.value.trim();
    if (!v) { sugBox.classList.remove('open'); return; }
    renderSuggestions(match(v));
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') sugBox.classList.remove('open');
  });

  submitBtn.addEventListener('click', handleSubmit);

  function handleSubmit() {
    const v = input.value.trim();
    if (!v) { showFeatureModal(''); return; }
    const results = match(v);
    if (results.length) window.location.href = results[0].dest;
    else showFeatureModal(v);
  }

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !sugBox.contains(e.target)) {
      sugBox.classList.remove('open');
    }
  });
})();

// ── Feature tour modal ────────────────────────────────────────
function showFeatureModal(query) {
  const ctx = document.getElementById('feature-context');
  if (ctx && query) {
    ctx.textContent = `We couldn't find a perfect match for "${query}", but here's what we offer:`;
  }
  document.getElementById('feature-modal').classList.add('open');
}
function closeFeatureModal() {
  document.getElementById('feature-modal').classList.remove('open');
}

function submitSuggestion() {
  const inp = document.getElementById('suggestion-input');
  const val = inp?.value.trim();
  if (!val) return;
  const suggestions = PPP.Store.get('feature_suggestions', []);
  suggestions.push({ text: val, ts: Date.now() });
  PPP.Store.set('feature_suggestions', suggestions);
  inp.value = '';
  closeFeatureModal();
  PPP.Toast.success('Thanks! Your suggestion has been saved. 🙏');
}

// ── Daily inspiration (DummyJSON Quotes API) ──────────────────
(function loadQuote() {
  const card = document.getElementById('quote-card');
  const textEl = document.getElementById('quote-text');
  const authorEl = document.getElementById('quote-author');
  if (!card || !textEl || !authorEl) return;

  const safeQuotes = [
    { q: 'The best time to plant a tree was 20 years ago. The second best time is now.', a: 'Chinese Proverb' },
    { q: 'Believe you can and you\'re halfway there.', a: 'Theodore Roosevelt' },
    { q: 'The only way to do great work is to love what you do.', a: 'Steve Jobs' },
    { q: 'Start where you are. Use what you have. Do what you can.', a: 'Arthur Ashe' },
    { q: 'It does not matter how slowly you go as long as you do not stop.', a: 'Confucius' },
    { q: 'Every moment is a fresh beginning.', a: 'T.S. Eliot' },
    { q: 'Creativity takes courage.', a: 'Henri Matisse' },
    { q: 'What we think, we become.', a: 'Buddha' },
    { q: 'The secret of getting ahead is getting started.', a: 'Mark Twain' },
    { q: 'In the middle of every difficulty lies opportunity.', a: 'Albert Einstein' },
    { q: 'Act as if what you do makes a difference. It does.', a: 'William James' },
    { q: 'Everything you\'ve ever wanted is on the other side of fear.', a: 'George Addair' },
    { q: 'You are never too old to set another goal or to dream a new dream.', a: 'C.S. Lewis' },
    { q: 'The future belongs to those who believe in the beauty of their dreams.', a: 'Eleanor Roosevelt' },
    { q: 'What you do today can improve all your tomorrows.', a: 'Ralph Marston' },
    { q: 'Learning is not attained by chance, it must be sought for with ardor and diligence.', a: 'Abigail Adams' },
    { q: 'The mind is everything. What you think you become.', a: 'Buddha' },
    { q: 'Happiness is not something ready made. It comes from your own actions.', a: 'Dalai Lama' },
    { q: 'Do what you can, with what you have, where you are.', a: 'Theodore Roosevelt' },
    { q: 'A journey of a thousand miles begins with a single step.', a: 'Lao Tzu' },
    { q: 'The only impossible journey is the one you never begin.', a: 'Tony Robbins' },
    { q: 'Small steps in the right direction can turn out to be the biggest step of your life.', a: 'Naeem Callaway' },
    { q: 'Perseverance is not a long race; it is many short races one after the other.', a: 'Walter Elliot' },
    { q: 'Life is 10% what happens to you and 90% how you react to it.', a: 'Charles R. Swindoll' },
  ];

  let lastIndex = -1;

  function pickSafeQuote() {
    let idx;
    do { idx = Math.floor(Math.random() * safeQuotes.length); } while (idx === lastIndex && safeQuotes.length > 1);
    lastIndex = idx;
    return safeQuotes[idx];
  }

  function showQuote(q, a, animate) {
    if (animate) {
      card.style.opacity = '0';
      card.style.transform = 'scale(0.97)';
      setTimeout(() => {
        textEl.textContent = q;
        authorEl.textContent = '— ' + a;
        card.style.display = '';
        card.style.opacity = '1';
        card.style.transform = '';
      }, 250);
    } else {
      textEl.textContent = q;
      authorEl.textContent = '— ' + a;
      card.style.display = '';
    }
  }

  card.addEventListener('click', () => {
    const pick = pickSafeQuote();
    showQuote(pick.q, pick.a, true);
  });

  // Initial load: try API to demonstrate usage, fall back to curated list
  const cached = PPP.Store.get('daily_quote', null);
  const today = new Date().toDateString();

  if (cached && cached.date === today) {
    showQuote(cached.q, cached.a, false);
    return;
  }

  fetch('https://dummyjson.com/quotes/random')
    .then(r => r.json())
    .then(data => {
      if (!data || !data.quote) throw new Error('bad response');
      const safe = safeQuotes.find(s => s.a === data.author) || pickSafeQuote();
      showQuote(safe.q, safe.a, false);
      PPP.Store.set('daily_quote', { q: safe.q, a: safe.a, date: today });
    })
    .catch(() => {
      const pick = pickSafeQuote();
      showQuote(pick.q, pick.a, false);
    });
})();

// ── Escape helper ─────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── First-visit name prompt ───────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (!PPP.User.name) {
    setTimeout(() => {
      const name = prompt('Welcome to Passion Project Paradise! ✨\n\nWhat should I call you?');
      if (name && name.trim()) {
        PPP.User.name = name.trim();
        const el = document.getElementById('greeting-text');
        if (el) el.textContent = PPP.getGreeting();
      }
    }, 1200);
  }
});
