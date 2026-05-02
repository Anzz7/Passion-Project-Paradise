/* ============================================================
   projects.js — Project Plans logic
   ============================================================ */

'use strict';

// ── State ────────────────────────────────────────────────────
let wizardData = {
  goal: '',
  why: '',
  skillLevel: '',
  priorExperience: '',
  tools: '',
  startDate: '',
  endDate: '',
  hoursPerWeek: 10,
  unavailable: [],
  syllabus: null
};
let currentStep = 1;
let currentProjectId = null;
let generatedSyllabus = null;

// ── Helpers ──────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function getProjects() {
  return PPP.Store.get('projects', []);
}

function saveProjects(projects) {
  PPP.Store.set('projects', projects);
}

function getProjectById(id) {
  return getProjects().find(p => p.id === id) || null;
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function calcProgress(project) {
  if (!project.syllabus?.weeks?.length) return 0;
  const progress = project.progress || {};
  let total = 0;
  let done = 0;
  project.syllabus.weeks.forEach((w, wi) => {
    (w.days || []).forEach((d, di) => {
      if (d.type !== 'rest') {
        total++;
        if (progress['week' + wi + '_day' + di]) done++;
      }
    });
  });
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

// ── Views ────────────────────────────────────────────────────
function showView(name) {
  ['view-list', 'view-detail', 'view-wizard'].forEach(function(v) {
    document.getElementById(v).style.display = v === 'view-' + name ? '' : 'none';
  });
}

function showListView() {
  showView('list');
  renderProjectList();
  currentProjectId = null;
}

function showDetailView(projectId) {
  currentProjectId = projectId;
  showView('detail');
  renderProjectDetail(projectId);
}

function showWizardView() {
  showView('wizard');
  currentStep = 1;
  updateStepper();
  showStepPanel(1);
  // Hide syllabus output, show generating state
  document.getElementById('generating-state').style.display = '';
  document.getElementById('syllabus-output').style.display = 'none';
  document.getElementById('syllabus-actions').style.display = 'none';
}

// ── Project List ─────────────────────────────────────────────
function renderProjectList() {
  var projects = getProjects();
  var grid = document.getElementById('project-grid');
  var empty = document.getElementById('empty-projects');

  if (!projects.length) {
    grid.style.display = 'none';
    empty.style.display = '';
    return;
  }

  empty.style.display = 'none';
  grid.style.display = '';

  grid.innerHTML = projects.map(function(p) {
    var pct = calcProgress(p);
    var weekCount = p.syllabus && p.syllabus.weeks ? p.syllabus.weeks.length : 0;
    return '<div class="project-list-item card-hover" onclick="showDetailView(\'' + p.id + '\')" style="margin-bottom:16px;padding:20px 24px;cursor:pointer">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">' +
        '<div>' +
          '<h3 style="font-size:1.1rem;margin-bottom:4px">' + escapeHtml(truncate(p.goal, 60)) + '</h3>' +
          '<p class="small muted">' + weekCount + ' week' + (weekCount !== 1 ? 's' : '') + ' &middot; ' + p.hoursPerWeek + 'h/wk &middot; ' + (p.skillLevel || 'unset') + '</p>' +
        '</div>' +
        '<span class="badge ' + (pct === 100 ? 'badge-green' : 'badge-red') + '">' + pct + '%</span>' +
      '</div>' +
      '<div class="progress-bar" style="margin-bottom:8px">' +
        '<div class="progress-fill" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<p class="small muted">' + PPP.formatDate(p.createdAt) + (p.fromIdea ? ' &middot; from brainstorm' : '') + '</p>' +
    '</div>';
  }).join('');
}

// ── Project Detail ───────────────────────────────────────────
function renderProjectDetail(projectId) {
  var p = getProjectById(projectId);
  if (!p) { showListView(); return; }

  document.getElementById('detail-title').textContent = p.goal;
  document.getElementById('detail-why').textContent = p.why || '';

  var meta = document.getElementById('detail-meta');
  var parts = [];
  if (p.skillLevel) parts.push('<span class="badge badge-gray">' + p.skillLevel + '</span>');
  if (p.startDate) parts.push('<span>Start: ' + p.startDate + '</span>');
  if (p.endDate) parts.push('<span>End: ' + p.endDate + '</span>');
  parts.push('<span>' + p.hoursPerWeek + 'h/week</span>');
  meta.innerHTML = parts.join(' &middot; ');

  var pct = calcProgress(p);
  document.getElementById('detail-progress-pct').textContent = pct + '%';
  document.getElementById('detail-progress-fill').style.width = pct + '%';

  renderWeekBlocks(p, 'detail-weeks', true);
}

function renderWeekBlocks(project, containerId, interactive) {
  var container = document.getElementById(containerId);
  if (!project.syllabus || !project.syllabus.weeks || !project.syllabus.weeks.length) {
    container.innerHTML = '<p class="muted" style="text-align:center;padding:40px">No syllabus data.</p>';
    return;
  }

  var progress = project.progress || {};

  container.innerHTML = project.syllabus.weeks.map(function(week, wi) {
    var days = week.days || [];
    var weekDone = days.filter(function(d, di) {
      return d.type !== 'rest' && progress['week' + wi + '_day' + di];
    }).length;
    var weekTotal = days.filter(function(d) { return d.type !== 'rest'; }).length;

    var daysHtml = days.map(function(d, di) {
      var checkHtml = '';
      if (interactive && d.type !== 'rest') {
        var isChecked = progress['week' + wi + '_day' + di];
        checkHtml = '<div class="day-check ' + (isChecked ? 'checked' : '') + '"' +
          ' onclick="event.stopPropagation();toggleDayCheck(\'' + project.id + '\',' + wi + ',' + di + ',this)"></div>';
      }
      return '<div class="day-row">' +
        '<div class="day-type ' + (d.type || 'learn') + '"></div>' +
        '<div class="day-label">' + escapeHtml(d.day || 'Day ' + (di + 1)) + '</div>' +
        '<div class="day-topic">' + escapeHtml(d.topic || '') + '</div>' +
        '<div class="day-duration">' + escapeHtml(d.duration || '') + '</div>' +
        checkHtml +
      '</div>';
    }).join('');

    return '<div class="week-block" id="wb-' + containerId + '-' + wi + '">' +
      '<div class="week-header" onclick="toggleWeek(\'' + containerId + '\',' + wi + ')">' +
        '<div>' +
          '<div class="week-num">Week ' + (week.week || wi + 1) + '</div>' +
          '<div class="week-theme">' + escapeHtml(week.theme || 'Study Week') + '</div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          '<span class="small muted">' + weekDone + '/' + weekTotal + '</span>' +
          '<svg class="week-toggle" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>' +
        '</div>' +
      '</div>' +
      '<div class="week-days">' + daysHtml + '</div>' +
    '</div>';
  }).join('');
}

function toggleWeek(containerId, wi) {
  var block = document.getElementById('wb-' + containerId + '-' + wi);
  if (block) block.classList.toggle('collapsed');
}

function toggleDayCheck(projectId, wi, di, el) {
  var projects = getProjects();
  var p = projects.find(function(pr) { return pr.id === projectId; });
  if (!p) return;
  if (!p.progress) p.progress = {};
  var key = 'week' + wi + '_day' + di;
  p.progress[key] = !p.progress[key];
  saveProjects(projects);

  el.classList.toggle('checked');

  // Update progress display
  var pct = calcProgress(p);
  var pctEl = document.getElementById('detail-progress-pct');
  var fillEl = document.getElementById('detail-progress-fill');
  if (pctEl) pctEl.textContent = pct + '%';
  if (fillEl) fillEl.style.width = pct + '%';

  if (pct === 100) {
    PPP.Notifs.cancel(projectId, 'project');
  }

  // Update week header count
  var weekBlock = el.closest('.week-block');
  if (weekBlock) {
    var checks = weekBlock.querySelectorAll('.day-check');
    var done = weekBlock.querySelectorAll('.day-check.checked').length;
    var countEl = weekBlock.querySelector('.week-header .small.muted');
    if (countEl) countEl.textContent = done + '/' + checks.length;
  }
}

function deleteCurrentProject() {
  if (!currentProjectId) return;
  if (!confirm('Delete this project plan? This cannot be undone.')) return;
  PPP.Notifs.cancel(currentProjectId, 'project');
  var projects = getProjects().filter(function(p) { return p.id !== currentProjectId; });
  saveProjects(projects);
  PPP.Toast.success('Project deleted.');
  showListView();
}

// ── Start New Plan ───────────────────────────────────────────
function startNewPlan(prefillGoal) {
  wizardData = {
    goal: prefillGoal || '',
    why: '',
    skillLevel: '',
    priorExperience: '',
    tools: '',
    startDate: '',
    endDate: '',
    hoursPerWeek: 10,
    unavailable: [],
    syllabus: null,
    fromIdea: null
  };
  generatedSyllabus = null;

  // Set defaults
  var today = new Date();
  var startStr = today.toISOString().split('T')[0];
  var endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 84); // 12 weeks
  var endStr = endDate.toISOString().split('T')[0];

  document.getElementById('wiz-goal').value = wizardData.goal;
  document.getElementById('wiz-why').value = '';
  document.getElementById('wiz-prior').value = '';
  document.getElementById('wiz-tools').value = '';
  document.getElementById('wiz-start').value = startStr;
  document.getElementById('wiz-end').value = endStr;
  document.getElementById('wiz-hours').value = 10;
  document.getElementById('hours-value').textContent = '10 hrs/week';

  // Reset skill selection
  document.querySelectorAll('#level-grid .skill-card').forEach(function(c) { c.classList.remove('selected'); });

  // Reset unavailable
  wizardData.unavailable = [];

  showWizardView();
  buildAvailGrid();
  updateTimelineSuggestion();

  // Restore saved wizard state (only if no prefill)
  if (!prefillGoal) {
    restoreWizardState();
  }
}

// ── Wizard Navigation ────────────────────────────────────────
function wizardNext(step) {
  // Validate current step before moving forward
  if (step > currentStep) {
    if (!validateStep(currentStep)) return;
  }

  // Save current step data
  saveWizardState();

  if (step === 4 && currentStep < 4) {
    // Generate syllabus
    currentStep = 4;
    updateStepper();
    showStepPanel(4);
    generateSyllabus();
    return;
  }

  currentStep = step;
  updateStepper();
  showStepPanel(step);

  // Update timeline suggestion when entering step 3
  if (step === 3) {
    updateTimelineSuggestion();
  }
}

function validateStep(step) {
  if (step === 1) {
    var goal = document.getElementById('wiz-goal').value.trim();
    if (!goal) {
      PPP.Toast.warn('Please describe your goal.');
      document.getElementById('wiz-goal').focus();
      return false;
    }
  }
  if (step === 2) {
    if (!wizardData.skillLevel) {
      PPP.Toast.warn('Please select your skill level.');
      return false;
    }
  }
  if (step === 3) {
    var start = document.getElementById('wiz-start').value;
    var end = document.getElementById('wiz-end').value;
    if (!start || !end) {
      PPP.Toast.warn('Please set both start and end dates.');
      return false;
    }
    if (new Date(end) <= new Date(start)) {
      PPP.Toast.warn('End date must be after start date.');
      return false;
    }
  }
  return true;
}

function updateStepper() {
  document.querySelectorAll('#stepper .step').forEach(function(el) {
    var s = parseInt(el.dataset.step);
    el.classList.remove('active', 'done');
    if (s === currentStep) el.classList.add('active');
    else if (s < currentStep) el.classList.add('done');
  });
}

function showStepPanel(step) {
  document.querySelectorAll('.step-panel').forEach(function(p) { p.classList.remove('active'); });
  var panel = document.getElementById('step-' + step);
  if (panel) panel.classList.add('active');
}

// ── Wizard State Persistence ─────────────────────────────────
function saveWizardState() {
  wizardData.goal = document.getElementById('wiz-goal').value.trim();
  wizardData.why = document.getElementById('wiz-why').value.trim();
  wizardData.priorExperience = document.getElementById('wiz-prior').value.trim();
  wizardData.tools = document.getElementById('wiz-tools').value.trim();
  wizardData.startDate = document.getElementById('wiz-start').value;
  wizardData.endDate = document.getElementById('wiz-end').value;
  wizardData.hoursPerWeek = parseInt(document.getElementById('wiz-hours').value);
  PPP.Store.set('wizard_draft', wizardData);
}

function restoreWizardState() {
  var draft = PPP.Store.get('wizard_draft', null);
  if (!draft || !draft.goal) return;

  if (draft.goal) document.getElementById('wiz-goal').value = draft.goal;
  if (draft.why) document.getElementById('wiz-why').value = draft.why;
  if (draft.priorExperience) document.getElementById('wiz-prior').value = draft.priorExperience;
  if (draft.tools) document.getElementById('wiz-tools').value = draft.tools;
  if (draft.startDate) document.getElementById('wiz-start').value = draft.startDate;
  if (draft.endDate) document.getElementById('wiz-end').value = draft.endDate;
  if (draft.hoursPerWeek) {
    document.getElementById('wiz-hours').value = draft.hoursPerWeek;
    document.getElementById('hours-value').textContent = draft.hoursPerWeek + ' hrs/week';
  }
  if (draft.skillLevel) {
    wizardData.skillLevel = draft.skillLevel;
    document.querySelectorAll('#level-grid .skill-card').forEach(function(c) {
      c.classList.toggle('selected', c.dataset.level === draft.skillLevel);
    });
  }
  if (draft.unavailable && draft.unavailable.length) {
    wizardData.unavailable = draft.unavailable;
    markUnavailableCells();
  }
  // Merge all draft fields
  Object.keys(draft).forEach(function(k) {
    if (draft[k] !== undefined && draft[k] !== null) wizardData[k] = draft[k];
  });
}

// ── Skill Level Selection ────────────────────────────────────
function selectLevel(el) {
  document.querySelectorAll('#level-grid .skill-card').forEach(function(c) { c.classList.remove('selected'); });
  el.classList.add('selected');
  wizardData.skillLevel = el.dataset.level;
  saveWizardState();
}

// ── Availability Grid ────────────────────────────────────────
var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
var DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
var TIMES = [
  { label: 'Morning', sublabel: '8am-12pm', key: 'morning' },
  { label: 'Afternoon', sublabel: '12-5pm', key: 'afternoon' },
  { label: 'Evening', sublabel: '5-9pm', key: 'evening' }
];

function buildAvailGrid() {
  var grid = document.getElementById('avail-grid');
  if (!grid) return;

  var html = '';
  // Header row: empty corner + day names
  html += '<div></div>';
  DAYS.forEach(function(d) {
    html += '<div class="avail-day-header">' + d + '</div>';
  });

  // Time rows
  TIMES.forEach(function(time) {
    html += '<div class="avail-day-header" style="text-align:right;padding-right:8px;font-size:0.7rem">' + time.label + '</div>';
    DAY_KEYS.forEach(function(day) {
      var isUnavail = wizardData.unavailable.some(function(u) { return u.day === day && u.time === time.key; });
      html += '<div class="avail-time-slot ' + (isUnavail ? 'unavailable' : '') + '"' +
        ' data-day="' + day + '" data-time="' + time.key + '"' +
        ' onclick="toggleAvailSlot(this)">' +
        time.sublabel +
      '</div>';
    });
  });

  // Update grid template to account for the label column
  grid.style.gridTemplateColumns = 'auto repeat(7, 1fr)';
  grid.innerHTML = html;
}

function markUnavailableCells() {
  document.querySelectorAll('#avail-grid .avail-time-slot').forEach(function(slot) {
    var day = slot.dataset.day;
    var time = slot.dataset.time;
    var isUnavail = wizardData.unavailable.some(function(u) { return u.day === day && u.time === time; });
    slot.classList.toggle('unavailable', isUnavail);
  });
}

function toggleAvailSlot(el) {
  var day = el.dataset.day;
  var time = el.dataset.time;
  var idx = wizardData.unavailable.findIndex(function(u) { return u.day === day && u.time === time; });

  if (idx >= 0) {
    wizardData.unavailable.splice(idx, 1);
    el.classList.remove('unavailable');
  } else {
    wizardData.unavailable.push({ day: day, time: time });
    el.classList.add('unavailable');
  }
  saveWizardState();
}

// ── Timeline Suggestion ──────────────────────────────────────
function updateTimelineSuggestion() {
  var box = document.getElementById('timeline-suggestion');
  var weeksEl = document.getElementById('suggested-weeks');
  var reasonEl = document.getElementById('timeline-reasoning');

  if (!wizardData.skillLevel) {
    box.style.display = 'none';
    return;
  }

  var suggestedWeeks, reasoning;
  switch (wizardData.skillLevel) {
    case 'beginner':
      suggestedWeeks = '8-12';
      reasoning = 'Research shows spaced learning over 2-3 months leads to 40% better retention. As a beginner, giving yourself time to absorb fundamentals prevents burnout and builds lasting habits.';
      break;
    case 'intermediate':
      suggestedWeeks = '4-8';
      reasoning = 'With your existing foundation, focused practice over 1-2 months can yield strong results. You already have mental models to build on, so the pace can be faster without sacrificing depth.';
      break;
    case 'advanced':
      suggestedWeeks = '2-4';
      reasoning = "You're building on strong skills. Concentrated effort over a few weeks keeps momentum high and lets you push into advanced territory while staying in a flow state.";
      break;
    default:
      box.style.display = 'none';
      return;
  }

  weeksEl.textContent = suggestedWeeks;
  reasonEl.textContent = reasoning;
  box.style.display = '';

  // Auto-set end date based on suggestion midpoint if user hasn't set one
  var startVal = document.getElementById('wiz-start').value;
  var endVal = document.getElementById('wiz-end').value;
  if (startVal) {
    var midWeeks = wizardData.skillLevel === 'beginner' ? 10 :
                   wizardData.skillLevel === 'intermediate' ? 6 : 3;
    var sugEnd = new Date(startVal);
    sugEnd.setDate(sugEnd.getDate() + midWeeks * 7);
    document.getElementById('wiz-end').value = sugEnd.toISOString().split('T')[0];
  }
}

// ── Hours Slider ─────────────────────────────────────────────
function initHoursSlider() {
  var slider = document.getElementById('wiz-hours');
  var display = document.getElementById('hours-value');
  var rec = document.getElementById('study-recommendation');
  if (!slider) return;

  slider.addEventListener('input', function() {
    var v = parseInt(slider.value);
    display.textContent = v + ' hrs/week';
    wizardData.hoursPerWeek = v;

    // Update recommendation text
    if (v <= 5) {
      rec.textContent = 'At this pace, focus on one topic per session. Short, consistent sessions build strong habits over time.';
    } else if (v <= 15) {
      rec.textContent = 'For optimal learning and retention, we recommend 1-2 hour sessions with breaks between them.';
    } else if (v <= 25) {
      rec.textContent = "That's a solid commitment. Mix theory and practice to avoid fatigue, and build in at least one rest day per week.";
    } else {
      rec.textContent = "Intensive pace! Be sure to schedule rest days and vary between learning, practice, and review to prevent burnout.";
    }
  });
}

// ── Gemini API ───────────────────────────────────────────────
async function callGemini(prompt) {
  var key = PPP.User.apiGemini;
  if (!key) return null;
  try {
    var res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7 }
      })
    });
    var data = await res.json();
    return (data.candidates && data.candidates[0] && data.candidates[0].content &&
            data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
            data.candidates[0].content.parts[0].text) || null;
  } catch (e) {
    console.error('Gemini API error:', e);
    return null;
  }
}

// ── Syllabus Generation ──────────────────────────────────────
async function generateSyllabus() {
  saveWizardState();

  var genState = document.getElementById('generating-state');
  var output = document.getElementById('syllabus-output');
  var actions = document.getElementById('syllabus-actions');

  genState.style.display = '';
  output.style.display = 'none';
  actions.style.display = 'none';

  // Calculate weeks
  var startDate = new Date(wizardData.startDate);
  var endDate = new Date(wizardData.endDate);
  var diffMs = endDate - startDate;
  var totalWeeks = Math.max(1, Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)));

  // Build available times list
  var allSlots = [];
  DAY_KEYS.forEach(function(day) {
    TIMES.forEach(function(time) {
      var isUnavail = wizardData.unavailable.some(function(u) { return u.day === day && u.time === time.key; });
      if (!isUnavail) {
        allSlots.push(day + ' ' + time.label);
      }
    });
  });
  var availText = allSlots.length ? allSlots.join(', ') : 'Flexible schedule';

  // Try Gemini first
  var prompt = 'Create a detailed weekly study plan in JSON format for:\n' +
    'Goal: ' + wizardData.goal + '\n' +
    'Skill level: ' + wizardData.skillLevel + '\n' +
    'Duration: ' + totalWeeks + ' weeks\n' +
    'Hours per week: ' + wizardData.hoursPerWeek + '\n' +
    'Available times: ' + availText + '\n' +
    'Prior experience: ' + (wizardData.priorExperience || 'None specified') + '\n' +
    'Why this matters: ' + (wizardData.why || 'Not specified') + '\n\n' +
    'Consider optimal study time (1-2 hour sessions), include rest days, mix theory and practice.\n' +
    'Return ONLY valid JSON with no markdown formatting, no code fences: {"weeks":[{"week":1,"theme":"...","days":[{"day":"Monday","topic":"...","duration":"1h","type":"learn|practice|review|rest"}]}]}\n' +
    'Each week should have 7 days (Monday through Sunday). Assign rest days to unavailable times.';

  var messages = [
    'Analyzing your goal and crafting a week-by-week schedule.',
    'Mapping out your learning phases...',
    'Balancing theory and practice sessions...',
    'Optimizing for your available time slots...',
    'Almost there, finalizing your plan...'
  ];
  var msgIdx = 0;
  var msgEl = document.getElementById('generating-msg');
  var msgInterval = setInterval(function() {
    msgIdx = (msgIdx + 1) % messages.length;
    msgEl.textContent = messages[msgIdx];
  }, 2500);

  var syllabus = null;

  // Try AI generation
  var aiResult = await callGemini(prompt);
  if (aiResult) {
    try {
      // Extract JSON from the response (handle markdown code blocks)
      var jsonStr = aiResult;
      var jsonMatch = aiResult.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
      // Also try to find raw JSON
      var braceMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (braceMatch) jsonStr = braceMatch[0];
      syllabus = JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Failed to parse Gemini response, falling back to template:', e);
    }
  }

  // Fallback: template-based generation
  if (!syllabus) {
    syllabus = generateFallbackSyllabus(totalWeeks);
  }

  clearInterval(msgInterval);

  generatedSyllabus = syllabus;
  genState.style.display = 'none';
  output.style.display = '';
  actions.style.display = 'flex';

  // Render the syllabus in the wizard preview
  var tempProject = { syllabus: syllabus, progress: {} };
  renderWeekBlocks(tempProject, 'wizard-weeks', false);
}

async function regenerateSyllabus() {
  generatedSyllabus = null;
  document.getElementById('syllabus-output').style.display = 'none';
  document.getElementById('syllabus-actions').style.display = 'none';
  await generateSyllabus();
}

// ── Fallback Syllabus Generator ──────────────────────────────
function generateFallbackSyllabus(totalWeeks) {
  var goal = wizardData.goal || 'your project';
  var level = wizardData.skillLevel || 'beginner';

  // Divide into phases based on skill level
  var phases = [];
  if (level === 'beginner') {
    phases.push(
      { name: 'Foundation & Setup', fraction: 0.25, types: ['learn', 'learn', 'practice', 'learn', 'practice', 'review', 'rest'] },
      { name: 'Core Concepts', fraction: 0.3, types: ['learn', 'practice', 'learn', 'practice', 'learn', 'practice', 'rest'] },
      { name: 'Hands-On Practice', fraction: 0.25, types: ['practice', 'learn', 'practice', 'practice', 'learn', 'practice', 'rest'] },
      { name: 'Review & Polish', fraction: 0.2, types: ['review', 'practice', 'review', 'practice', 'review', 'practice', 'rest'] }
    );
  } else if (level === 'intermediate') {
    phases.push(
      { name: 'Quick Review & Gap Analysis', fraction: 0.15, types: ['review', 'learn', 'practice', 'learn', 'practice', 'review', 'rest'] },
      { name: 'Deep Dive', fraction: 0.35, types: ['learn', 'practice', 'learn', 'practice', 'practice', 'review', 'rest'] },
      { name: 'Applied Projects', fraction: 0.35, types: ['practice', 'practice', 'learn', 'practice', 'practice', 'review', 'rest'] },
      { name: 'Advanced Topics & Mastery', fraction: 0.15, types: ['learn', 'practice', 'practice', 'practice', 'review', 'practice', 'rest'] }
    );
  } else {
    phases.push(
      { name: 'Advanced Techniques', fraction: 0.3, types: ['learn', 'practice', 'practice', 'learn', 'practice', 'practice', 'rest'] },
      { name: 'Real-World Application', fraction: 0.4, types: ['practice', 'practice', 'learn', 'practice', 'practice', 'practice', 'rest'] },
      { name: 'Optimization & Polish', fraction: 0.3, types: ['review', 'practice', 'practice', 'review', 'practice', 'practice', 'rest'] }
    );
  }

  var dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Calculate session duration based on hours per week
  var hpw = wizardData.hoursPerWeek || 10;
  var activeDays = 6; // Mon-Sat
  var sessionMins = Math.round((hpw * 60) / activeDays);
  var durationStr = sessionMins >= 60 ? (Math.round(sessionMins / 60 * 10) / 10) + 'h' : sessionMins + 'min';

  var topicTemplates = {
    learn: [
      'Introduction to key concepts of ' + goal,
      'Understanding the fundamentals',
      'Learning core principles and theory',
      'Studying best practices and patterns',
      'Exploring tools and techniques',
      'Reading documentation and tutorials',
      'Watching expert demonstrations',
      'Learning advanced theory'
    ],
    practice: [
      'Hands-on practice with ' + goal,
      'Building a small exercise project',
      'Applying concepts through exercises',
      'Working on a mini-project',
      'Coding/creating exercises',
      'Practicing with real examples',
      'Building something from scratch',
      'Timed practice challenge'
    ],
    review: [
      "Reviewing what you've learned so far",
      'Self-assessment and knowledge check',
      'Revisiting challenging concepts',
      'Review session and notes cleanup',
      'Consolidating key takeaways',
      'Quiz yourself on recent material'
    ],
    rest: [
      'Rest day — recharge and reflect',
      'Rest day — let it sink in'
    ]
  };

  var weeks = [];
  var weekNum = 0;

  phases.forEach(function(phase) {
    var phaseWeeks = Math.max(1, Math.round(totalWeeks * phase.fraction));
    for (var pw = 0; pw < phaseWeeks && weekNum < totalWeeks; pw++) {
      weekNum++;
      var days = dayNames.map(function(dayName, di) {
        var type = phase.types[di];
        var templates = topicTemplates[type];
        var topic = templates[(weekNum + di) % templates.length];
        // Mark rest days for fully unavailable days
        var dayKey = DAY_KEYS[di];
        var allUnavail = TIMES.every(function(t) {
          return wizardData.unavailable.some(function(u) { return u.day === dayKey && u.time === t.key; });
        });
        if (allUnavail || type === 'rest') {
          return { day: dayName, topic: 'Rest day — recharge and reflect', duration: '-', type: 'rest' };
        }
        return { day: dayName, topic: topic, duration: durationStr, type: type };
      });

      weeks.push({
        week: weekNum,
        theme: phase.name + (phaseWeeks > 1 ? ' (' + (pw + 1) + '/' + phaseWeeks + ')' : ''),
        days: days
      });
    }
  });

  // Fill remaining weeks if phases didn't cover all
  while (weeks.length < totalWeeks) {
    weekNum++;
    var days = dayNames.map(function(dayName, di) {
      if (di === 6) return { day: dayName, topic: 'Rest day', duration: '-', type: 'rest' };
      return {
        day: dayName,
        topic: 'Continued practice with ' + goal,
        duration: durationStr,
        type: di % 2 === 0 ? 'practice' : 'learn'
      };
    });
    weeks.push({ week: weekNum, theme: 'Continued Learning', days: days });
  }

  return { weeks: weeks };
}

// ── Save as Project ──────────────────────────────────────────
function saveAsProject() {
  if (!generatedSyllabus) {
    PPP.Toast.error('No syllabus to save.');
    return;
  }

  saveWizardState();

  var project = {
    id: 'proj_' + Date.now(),
    goal: wizardData.goal,
    why: wizardData.why,
    skillLevel: wizardData.skillLevel,
    priorExperience: wizardData.priorExperience,
    tools: wizardData.tools,
    startDate: wizardData.startDate,
    endDate: wizardData.endDate,
    hoursPerWeek: wizardData.hoursPerWeek,
    unavailable: wizardData.unavailable.slice(),
    syllabus: generatedSyllabus,
    progress: {},
    createdAt: Date.now(),
    fromIdea: wizardData.fromIdea || null
  };

  var projects = getProjects();
  projects.unshift(project);
  saveProjects(projects);

  // Clear wizard draft
  PPP.Store.remove('wizard_draft');

  if (PPP.User.notificationsEnabled) {
    PPP.Notifs.schedule(project.id, project.goal, 'project');
  }
  if (project.fromIdea) {
    PPP.Notifs.markProgressed(project.fromIdea);
  }

  PPP.fireConfetti();
  PPP.Toast.success('Project plan saved!');

  // Show the detail view for the new project
  setTimeout(function() { showDetailView(project.id); }, 600);
}

// ── Find Learning Resources ──────────────────────────────────
function findLearningResources() {
  PPP.Store.set('learning_query', wizardData.goal);
  window.location.href = 'learning.html';
}

// ── From Brainstorm ──────────────────────────────────────────
function handleBrainstormEntry() {
  var params = new URLSearchParams(window.location.search);
  if (params.get('from') !== 'brainstorm') return false;

  var ideaId = PPP.Store.get('active_idea', null);
  if (!ideaId) {
    startNewPlan();
    return true;
  }

  var ideas = PPP.Store.get('ideas', []);
  var idea = ideas.find(function(i) { return i.id === ideaId; });
  if (!idea) {
    startNewPlan();
    return true;
  }

  // Pre-fill from the brainstorm idea
  startNewPlan(idea.name);
  wizardData.fromIdea = ideaId;

  // Fill in answers from brainstorm questions as context
  var answers = idea.answers || {};
  var parts = [];
  if (answers[0]) parts.push(answers[0]); // The Spark
  if (answers[2]) parts.push(answers[2]); // The Vision
  if (idea.freeNotes) parts.push(idea.freeNotes);
  if (parts.length) {
    document.getElementById('wiz-why').value = parts.join('\n\n').slice(0, 500);
    wizardData.why = document.getElementById('wiz-why').value;
  }

  // Clear the active_idea so it doesn't re-trigger
  PPP.Store.remove('active_idea');

  return true;
}

// ── Init ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', function() {
  // Check API key warning
  if (!PPP.User.apiGemini) {
    document.getElementById('api-warning').style.display = '';
  }

  // Personalize heading
  var heading = document.getElementById('plans-heading');
  if (heading && PPP.User.name) {
    heading.textContent = 'Your roadmaps, ' + PPP.User.name + '.';
  }

  // Init hours slider
  initHoursSlider();

  // Build avail grid initially
  buildAvailGrid();

  // Check if arriving from brainstorm
  if (handleBrainstormEntry()) return;

  // Default: show project list
  showListView();
});
