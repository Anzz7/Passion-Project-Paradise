/* ============================================================
   brainstorm.js — Ideas Hub logic
   ============================================================ */

'use strict';

// ── Question bank ─────────────────────────────────────────────
const QUESTIONS = [
  {
    category: 'The Spark',
    text: 'What made this idea click? Describe the moment or experience that inspired it.',
    hint: 'Was it a frustration, a conversation, something you read, or just a feeling?',
  },
  {
    category: 'The Problem',
    text: 'What problem does this idea solve — and for whom?',
    hint: 'Try to be specific. "People who..." is a stronger start than "everyone."',
  },
  {
    category: 'The Vision',
    text: 'If this idea worked perfectly, what does the world look like one year from now?',
    hint: 'Paint a vivid picture. How would someone\'s day be different because of what you built?',
  },
  {
    category: 'The Doubt',
    text: 'What\'s the part of this idea you\'re most unsure about? What feels risky or hard?',
    hint: 'The things you avoid thinking about are often the most important to name.',
  },
  {
    category: 'The Competition',
    text: 'Has anyone tried something like this before? What happened — and what would you do differently?',
    hint: 'Existing attempts aren\'t a dead end. They\'re proof the problem is real.',
  },
  {
    category: 'Your Edge',
    text: 'Why are you the right person to pursue this? What do you bring that others don\'t?',
    hint: 'It doesn\'t have to be expertise. It could be obsession, access, lived experience, or timing.',
  },
  {
    category: 'The First Step',
    text: 'What\'s the smallest, cheapest version of this idea you could test in a week?',
    hint: 'Think breadboard, not the finished product. What would tell you if you\'re onto something?',
  },
  {
    category: 'The Energy',
    text: 'How excited are you about this, honestly? What would make you more excited?',
    hint: 'Passion is the fuel. It\'s worth knowing how full your tank is right now.',
  },
];

// ── Session state ─────────────────────────────────────────────
let session = {
  id: null,
  name: '',
  answers: {},
  freeNotes: '',
  startedAt: null,
  completed: false,
};
let currentQ = 0;
let autoSaveTimer = null;

// ── Show/hide stages ──────────────────────────────────────────
function showStage(id) {
  ['stage-welcome','stage-name','stage-questions','stage-notes','stage-complete']
    .forEach(s => {
      const el = document.getElementById(s);
      if (el) el.style.display = s === id ? '' : 'none';
    });
}

// ── Start new session ─────────────────────────────────────────
function startNewSession() {
  session = {
    id: 'idea_' + Date.now(),
    name: '',
    answers: {},
    freeNotes: '',
    startedAt: Date.now(),
    completed: false,
  };
  currentQ = 0;
  closeSidebar();
  showStage('stage-name');
  const inp = document.getElementById('idea-name-input');
  if (inp) { inp.value = ''; inp.focus(); }
}

// ── Name stage ────────────────────────────────────────────────
function initNameStage() {
  const inp = document.getElementById('idea-name-input');
  const btn = document.getElementById('name-next-btn');
  const counter = document.getElementById('name-char-count');
  if (!inp) return;

  inp.addEventListener('input', () => {
    counter.textContent = `${inp.value.length} / 100`;
  });

  const proceed = () => {
    const v = inp.value.trim();
    if (!v) { inp.style.borderColor = 'var(--red)'; inp.focus(); return; }
    session.name = v;
    document.getElementById('notes-idea-name').textContent = v;
    showQuestionsStage();
  };

  btn.addEventListener('click', proceed);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') proceed(); });
}

// ── Questions stage ────────────────────────────────────────────
function showQuestionsStage() {
  showStage('stage-questions');
  renderQuestion();
}

function renderQuestion() {
  const q = QUESTIONS[currentQ];
  if (!q) { showStage('stage-notes'); return; }

  // Animate out then in
  const stage = document.getElementById('question-stage');
  stage.style.opacity = '0';
  stage.style.transform = 'translateX(20px)';

  setTimeout(() => {
    document.getElementById('q-category').textContent = q.category;
    document.getElementById('q-text').textContent = q.text;
    document.getElementById('q-hint').textContent = q.hint;
    document.getElementById('progress-label').textContent = `${currentQ + 1} / ${QUESTIONS.length}`;

    const answerEl = document.getElementById('q-answer');
    answerEl.value = session.answers[currentQ] || '';

    renderDots();

    stage.style.transition = 'opacity 0.35s, transform 0.35s';
    stage.style.opacity = '1';
    stage.style.transform = 'translateX(0)';
    answerEl.focus();
  }, 180);
}

function renderDots() {
  const dotsEl = document.getElementById('stage-dots');
  dotsEl.innerHTML = QUESTIONS.map((_, i) => {
    let cls = 'stage-dot';
    if (i < currentQ) cls += ' done';
    else if (i === currentQ) cls += ' active';
    return `<div class="${cls}"></div>`;
  }).join('');
}

function saveCurrentAnswer() {
  const v = document.getElementById('q-answer')?.value || '';
  session.answers[currentQ] = v;
  persistSession();
  document.getElementById('autosave-indicator').textContent = 'Autosaved ✓';
}

function persistSession() {
  const ideas = PPP.Store.get('ideas', []);
  const idx = ideas.findIndex(i => i.id === session.id);
  const data = { ...session, updatedAt: Date.now() };
  if (idx >= 0) ideas[idx] = data;
  else ideas.unshift(data);
  PPP.Store.set('ideas', ideas);
}

function initQuestionsStage() {
  const nextBtn = document.getElementById('q-next-btn');
  const backBtn = document.getElementById('q-back-btn');
  const skipBtn = document.getElementById('q-skip-btn');
  const answerEl = document.getElementById('q-answer');
  if (!nextBtn) return;

  answerEl.addEventListener('input', () => {
    clearTimeout(autoSaveTimer);
    document.getElementById('autosave-indicator').textContent = 'Saving...';
    autoSaveTimer = setTimeout(saveCurrentAnswer, 800);
  });

  nextBtn.addEventListener('click', () => {
    saveCurrentAnswer();
    currentQ++;
    if (currentQ >= QUESTIONS.length) {
      showStage('stage-notes');
      const fn = document.getElementById('free-notes');
      if (fn) { fn.value = session.freeNotes || ''; fn.focus(); }
    } else {
      renderQuestion();
    }
  });

  backBtn.addEventListener('click', () => {
    if (currentQ === 0) { showStage('stage-name'); return; }
    saveCurrentAnswer();
    currentQ--;
    renderQuestion();
  });

  skipBtn.addEventListener('click', () => {
    currentQ++;
    if (currentQ >= QUESTIONS.length) {
      showStage('stage-notes');
    } else {
      renderQuestion();
    }
  });
}

function goToQuestions() {
  currentQ = QUESTIONS.length - 1;
  showQuestionsStage();
}

// ── Notes stage ───────────────────────────────────────────────
function initNotesStage() {
  const fn = document.getElementById('free-notes');
  if (!fn) return;
  fn.addEventListener('input', () => {
    session.freeNotes = fn.value;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(persistSession, 800);
  });
}

// ── Complete session ──────────────────────────────────────────
function completeSession() {
  session.freeNotes = document.getElementById('free-notes')?.value || '';
  session.completed = true;
  session.completedAt = Date.now();
  persistSession();

  // Schedule reminder if notifications enabled
  if (PPP.User.notificationsEnabled) {
    PPP.Notifs.schedule(session.id, session.name);
  }

  // Fire confetti
  PPP.fireConfetti();

  // Update completion message
  const msg = document.getElementById('completion-msg');
  if (msg) msg.textContent = `"${session.name}" is documented and saved. What's the next move?`;

  showStage('stage-complete');
  loadHistory();
}

function developIdea() {
  PPP.Notifs.markProgressed(session.id);
  PPP.Store.set('active_idea', session.id);
  window.location.href = 'projects.html?from=brainstorm';
}

function findResources() {
  PPP.Notifs.markProgressed(session.id);
  PPP.Store.set('learning_query', session.name);
  window.location.href = 'learning.html';
}

function saveAndHome() {
  persistSession();
  window.location.href = 'index.html';
}

// ── History sidebar ───────────────────────────────────────────
function toggleHistory() {
  const sidebar = document.getElementById('history-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  overlay.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) loadHistory();
}

function closeSidebar() {
  document.getElementById('history-sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').style.display = 'none';
}

function loadHistory() {
  const ideas = PPP.Store.get('ideas', []);
  const listEl = document.getElementById('history-list');
  if (!listEl) return;

  if (!ideas.length) {
    listEl.innerHTML = `
      <div class="empty-state" style="padding:40px 0">
        <div class="empty-state-icon">💭</div>
        <div class="empty-state-title">Nothing yet</div>
        <p>Your brainstorm history will appear here.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = ideas.map(idea => `
    <div class="history-item" onclick="openIdeaView('${idea.id}')">
      <div class="history-item-title">${escapeHtml(idea.name)}</div>
      <div class="history-item-date">${PPP.timeAgo(idea.updatedAt || idea.startedAt)}</div>
      ${idea.answers[0] ? `<div class="history-item-preview">${escapeHtml(idea.answers[0].slice(0, 80))}${idea.answers[0].length > 80 ? '…' : ''}</div>` : ''}
      <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
        ${idea.completed ? '<span class="badge badge-green">✓ Complete</span>' : '<span class="badge badge-gray">In progress</span>'}
        ${countAnswered(idea)}
      </div>
    </div>
  `).join('');
}

function countAnswered(idea) {
  const n = Object.values(idea.answers || {}).filter(v => v.trim()).length;
  return n ? `<span class="badge badge-gray">${n} answer${n !== 1 ? 's' : ''}</span>` : '';
}

function openIdeaView(ideaId) {
  const ideas = PPP.Store.get('ideas', []);
  const idea = ideas.find(i => i.id === ideaId);
  if (!idea) return;

  document.getElementById('view-idea-title').textContent = idea.name;
  document.getElementById('view-idea-date').textContent =
    PPP.formatDate(idea.startedAt) + (idea.completed ? ' · Completed' : ' · In progress');

  let html = '';
  QUESTIONS.forEach((q, i) => {
    const ans = idea.answers[i];
    if (ans && ans.trim()) {
      html += `
        <div style="margin-bottom:20px">
          <p class="stage-label" style="margin-bottom:4px">${q.category}</p>
          <p style="font-weight:600;margin-bottom:6px;font-size:0.95rem">${q.text}</p>
          <p style="color:var(--text-secondary);font-size:0.92rem;line-height:1.7">${escapeHtml(ans)}</p>
        </div>`;
    }
  });
  if (idea.freeNotes?.trim()) {
    html += `
      <div style="margin-bottom:20px">
        <p class="stage-label" style="margin-bottom:4px">Open Notes</p>
        <p style="color:var(--text-secondary);font-size:0.92rem;line-height:1.7;white-space:pre-wrap">${escapeHtml(idea.freeNotes)}</p>
      </div>`;
  }
  if (!html) html = '<p class="muted">No answers recorded yet.</p>';

  document.getElementById('view-idea-body').innerHTML = html;

  document.getElementById('view-develop-btn').onclick = () => {
    PPP.Notifs.markProgressed(ideaId);
    PPP.Store.set('active_idea', ideaId);
    window.location.href = 'projects.html?from=brainstorm';
  };
  document.getElementById('view-learn-btn').onclick = () => {
    PPP.Notifs.markProgressed(ideaId);
    PPP.Store.set('learning_query', idea.name);
    window.location.href = 'learning.html';
  };
  document.getElementById('view-delete-btn').onclick = () => deleteIdea(ideaId);

  document.getElementById('view-idea-modal').classList.add('open');
}

function deleteIdea(ideaId) {
  if (!confirm('Delete this brainstorm? This cannot be undone.')) return;
  const ideas = PPP.Store.get('ideas', []).filter(i => i.id !== ideaId);
  PPP.Store.set('ideas', ideas);
  PPP.Notifs.cancel(ideaId);
  document.getElementById('view-idea-modal').classList.remove('open');
  loadHistory();
  PPP.Toast.success('Brainstorm deleted.');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Init ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Welcome greeting
  const wg = document.getElementById('welcome-greeting');
  if (wg) wg.textContent = PPP.User.name ? `Ready to think, ${PPP.User.name}?` : 'Ready to think?';

  showStage('stage-welcome');
  initNameStage();
  initQuestionsStage();
  initNotesStage();
  loadHistory();

  // Check URL params
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'history') toggleHistory();

  // Close modal on overlay click
  document.getElementById('view-idea-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('view-idea-modal')) {
      document.getElementById('view-idea-modal').classList.remove('open');
    }
  });
});
