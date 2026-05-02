/* ============================================================
   learning.js — Learning Hub with YouTube Data API v3
   ============================================================ */

'use strict';

const YT_API = 'https://www.googleapis.com/youtube/v3/search';
const YT_VIDEOS_API = 'https://www.googleapis.com/youtube/v3/videos';

let nextPageToken = '';
let lastQuery = '';

// ── Init ──────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  checkApiKey();
  initSearch();
  initFilters();
  renderMyCourses();

  // Pre-fill from brainstorm redirect
  const query = PPP.Store.get('learning_query', '');
  if (query) {
    const inp = document.getElementById('search-input');
    if (inp) inp.value = query;
    PPP.Store.remove('learning_query');
    performSearch(query);
  }

  // Personalise heading
  const name = PPP.User.name;
  if (name) {
    const sub = document.getElementById('learning-subtext');
    if (sub) sub.textContent = `What does your passion project need you to learn, ${name}?`;
  }
});

// ── API key check ─────────────────────────────────────────────
function checkApiKey() {
  const warn = document.getElementById('api-warning');
  if (!PPP.User.apiYoutube && warn) warn.style.display = '';
  else if (warn) warn.style.display = 'none';
}

// ── Search ────────────────────────────────────────────────────
function initSearch() {
  const btn = document.getElementById('search-btn');
  const inp = document.getElementById('search-input');
  if (!btn || !inp) return;

  btn.addEventListener('click', () => {
    const q = inp.value.trim();
    if (q) performSearch(q);
  });

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = inp.value.trim();
      if (q) performSearch(q);
    }
  });

  const loadMore = document.getElementById('load-more-btn');
  if (loadMore) loadMore.addEventListener('click', () => loadMoreResults());
}

async function performSearch(query, append = false) {
  const apiKey = PPP.User.apiYoutube;
  if (!apiKey) {
    PPP.Toast.error('Add your YouTube API key in Settings first.');
    return;
  }

  lastQuery = query;
  setLoadingState(true, append);

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: 12,
      key: apiKey,
      relevanceLanguage: 'en',
      videoEmbeddable: 'true',
      ...(append && nextPageToken ? { pageToken: nextPageToken } : {}),
    });

    const res = await fetch(`${YT_API}?${params}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error?.message || 'YouTube API error');
    }
    const data = await res.json();
    nextPageToken = data.nextPageToken || '';

    // Fetch durations
    const ids = data.items.map(i => i.id.videoId).join(',');
    const durations = await fetchDurations(ids, apiKey);

    renderResults(data.items, durations, append);
    document.getElementById('load-more-btn').style.display = nextPageToken ? '' : 'none';
    document.getElementById('load-more-wrap').style.display = '';
  } catch (err) {
    PPP.Toast.error(err.message || 'Search failed. Check your API key.');
    setLoadingState(false, append);
  }
}

async function fetchDurations(ids, apiKey) {
  try {
    const params = new URLSearchParams({ part: 'contentDetails', id: ids, key: apiKey });
    const res = await fetch(`${YT_VIDEOS_API}?${params}`);
    const data = await res.json();
    const map = {};
    data.items?.forEach(v => { map[v.id] = formatDuration(v.contentDetails.duration); });
    return map;
  } catch { return {}; }
}

function formatDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const h = parseInt(match[1] || 0);
  const m = parseInt(match[2] || 0);
  const s = parseInt(match[3] || 0);
  if (h) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function loadMoreResults() {
  if (nextPageToken && lastQuery) performSearch(lastQuery, true);
}

// ── Render results ────────────────────────────────────────────
function setLoadingState(loading, append) {
  document.getElementById('search-prompt').style.display = 'none';
  document.getElementById('search-loading').style.display = loading && !append ? '' : 'none';
  if (!append && loading) document.getElementById('video-grid').innerHTML = '';
}

function renderResults(items, durations, append) {
  document.getElementById('search-loading').style.display = 'none';
  const grid = document.getElementById('video-grid');

  if (!items.length && !append) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state-icon">🔍</div>
      <div class="empty-state-title">No results found</div>
      <p>Try different keywords or check your API key.</p>
    </div>`;
    return;
  }

  const savedCourses = PPP.Store.get('saved_courses', []);
  const savedIds = new Set(savedCourses.map(c => c.videoId));

  const cards = items.map(item => {
    const vid = item.id.videoId;
    const snippet = item.snippet;
    const thumb = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '';
    const dur = durations[vid] || '';
    const isSaved = savedIds.has(vid);

    return `
      <div class="video-card reveal" data-vid="${vid}">
        <div class="video-thumbnail" onclick="openVideo('${vid}')">
          <img src="${thumb}" alt="${escHtml(snippet.title)}" loading="lazy" />
          <div class="video-play-overlay">
            <div class="play-btn">▶</div>
          </div>
          ${dur ? `<div class="video-duration">${dur}</div>` : ''}
        </div>
        <div class="video-info">
          <div class="video-title">${escHtml(snippet.title)}</div>
          <div class="video-channel">📺 ${escHtml(snippet.channelTitle)}</div>
          <div class="video-card-footer">
            <span class="small muted">${formatRelativeDate(snippet.publishedAt)}</span>
            <button class="save-btn ${isSaved ? 'saved' : ''}"
              onclick="toggleSave(this, '${vid}', ${JSON.stringify(escHtml(snippet.title))}, ${JSON.stringify(escHtml(snippet.channelTitle))}, ${JSON.stringify(thumb)})"
            >${isSaved ? '✓ Saved' : '+ Save'}</button>
          </div>
        </div>
      </div>`;
  }).join('');

  if (append) grid.insertAdjacentHTML('beforeend', cards);
  else grid.innerHTML = cards;

  // Stagger reveal
  setTimeout(() => {
    grid.querySelectorAll('.reveal:not(.visible)').forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), i * 60);
    });
  }, 50);
}

function openVideo(videoId) {
  window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener');
}

// ── Save / unsave ─────────────────────────────────────────────
function toggleSave(btn, videoId, title, channel, thumb) {
  const courses = PPP.Store.get('saved_courses', []);
  const idx = courses.findIndex(c => c.videoId === videoId);

  if (idx >= 0) {
    courses.splice(idx, 1);
    btn.textContent = '+ Save';
    btn.classList.remove('saved');
    PPP.Notifs.cancel(videoId, 'learning');
    PPP.Toast.show('Removed from saved courses.');
  } else {
    courses.unshift({ videoId, title, channel, thumb, savedAt: Date.now(), progress: 0 });
    btn.textContent = '✓ Saved';
    btn.classList.add('saved');
    if (PPP.User.notificationsEnabled) {
      PPP.Notifs.schedule(videoId, title, 'learning');
    }
    PPP.Toast.success('Saved to My Courses!');
  }

  PPP.Store.set('saved_courses', courses);
  renderMyCourses();
}

// ── My Courses ────────────────────────────────────────────────
function renderMyCourses() {
  const courses = PPP.Store.get('saved_courses', []);
  const listEl = document.getElementById('my-courses-list');
  const clearBtn = document.getElementById('clear-courses-btn');
  if (!listEl) return;

  if (clearBtn) clearBtn.style.display = courses.length ? '' : 'none';

  if (!courses.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📌</div>
        <div class="empty-state-title">No saved courses yet</div>
        <p>Search for videos above and click Save to track them here.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = courses.map(c => `
    <div class="course-item reveal">
      <img class="course-thumb" src="${c.thumb}" alt="${escHtml(c.title)}" />
      <div class="course-info">
        <div class="course-title">${escHtml(c.title)}</div>
        <div class="small muted" style="margin-bottom:8px">📺 ${escHtml(c.channel)}</div>
        <div class="progress-bar" style="max-width:200px">
          <div class="progress-fill" style="width:${c.progress || 0}%"></div>
        </div>
      </div>
      <div class="course-actions">
        <button class="btn btn-primary btn-sm" onclick="openVideo('${c.videoId}')">Watch</button>
        <button class="btn btn-ghost btn-sm" onclick="markProgress('${c.videoId}')">
          ${c.progress >= 100 ? '✓ Done' : 'Progress'}
        </button>
        <button class="btn btn-ghost btn-sm" style="color:var(--text-secondary)" onclick="removeCourse('${c.videoId}')">✕</button>
      </div>
    </div>
  `).join('');

  setTimeout(() => {
    listEl.querySelectorAll('.reveal').forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), i * 80);
    });
  }, 50);
}

function markProgress(videoId) {
  const courses = PPP.Store.get('saved_courses', []);
  const course = courses.find(c => c.videoId === videoId);
  if (!course) return;

  const levels = [0, 25, 50, 75, 100];
  const idx = levels.indexOf(course.progress || 0);
  course.progress = levels[(idx + 1) % levels.length];
  PPP.Store.set('saved_courses', courses);
  renderMyCourses();
  if (course.progress === 100) {
    PPP.Notifs.cancel(videoId, 'learning');
    PPP.Toast.success('Course completed! 🎉');
  }
}

function removeCourse(videoId) {
  const courses = PPP.Store.get('saved_courses', []).filter(c => c.videoId !== videoId);
  PPP.Store.set('saved_courses', courses);
  PPP.Notifs.cancel(videoId, 'learning');
  renderMyCourses();
}

function clearAllCourses() {
  if (!confirm('Remove all saved courses?')) return;
  PPP.Store.set('saved_courses', []);
  renderMyCourses();
}

// ── Category filters ──────────────────────────────────────────
function initFilters() {
  document.querySelectorAll('.chip[data-cat]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-cat]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const cat = chip.dataset.cat;
      const query = cat ? `${cat} tutorial for beginners` : '';
      if (query) {
        document.getElementById('search-input').value = query;
        performSearch(query);
      }
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────
function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatRelativeDate(dateStr) {
  const d = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (d < 1) return 'Today';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d/7)}w ago`;
  if (d < 365) return `${Math.floor(d/30)}mo ago`;
  return `${Math.floor(d/365)}y ago`;
}
