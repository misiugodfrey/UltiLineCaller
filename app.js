// Data Model and Persistence
const STORAGE_KEY = 'ulc_state_v1';

/** @typedef {{id:string,name:string,gender:'M'|'W',position:'handler'|'cutter'|'both',pref:'O'|'D'|'either',available:boolean,pointsPlayed:number}} Player */
/** @typedef {{players: Player[], history: {timestamp:number, line:string[], context:'O'|'D', ratio:string}[], nextContext:'O'|'D', nextRatio:string, autoBase?: '4M-3W'|'3M-4W', ui?: { rosterCollapsed?: boolean }}} AppState */

/** @type {AppState} */
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { players: [], history: [], nextContext: 'O', nextRatio: '4M-3W' };
    const parsed = JSON.parse(raw);
    // Backfill defaults
    parsed.players = (parsed.players || []).map(p => ({ available: true, pointsPlayed: 0, ...p }));
    parsed.history = parsed.history || [];
    parsed.nextContext = parsed.nextContext || 'O';
    parsed.nextRatio = parsed.nextRatio || '4M-3W';
    parsed.autoBase = parsed.autoBase || '4M-3W';
    parsed.ui = parsed.ui || { rosterCollapsed: false };
    return parsed;
  } catch (e) {
    console.warn('Failed to load state, starting fresh', e);
    return { players: [], history: [], nextContext: 'O', nextRatio: '4M-3W', autoBase: '4M-3W', ui: { rosterCollapsed: false } };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Utilities
const uid = () => Math.random().toString(36).slice(2, 9);

function byPointsAsc(a, b) { return a.pointsPlayed - b.pointsPlayed; }

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] ||= []).push(item);
    return acc;
  }, {});
}

function compareByContextThenPoints(context) {
  return (a, b) => {
    const prefRank = (p) => p.pref === context ? 0 : (p.pref === 'either' ? 1 : 2);
    const deltaPref = prefRank(a) - prefRank(b);
    if (deltaPref !== 0) return deltaPref;
    return a.pointsPlayed - b.pointsPlayed;
  };
}

// Suggestion Algorithm
function parseRatio(ratio) {
  if (ratio === 'auto') return 'auto';
  const [m, w] = ratio.split('-');
  const men = parseInt(m, 10);
  const women = parseInt(w, 10);
  return { men, women };
}

function flipRatio(r) { return r === '4M-3W' ? '3M-4W' : '4M-3W'; }

function nextAutoRatio(history, base) {
  // Pattern: start with base at point 0, then flip for point 1, then every 2 points thereafter
  // Sequence by point index n: base, flip, flip, base, base, flip, flip, ...
  const n = history.length; // next point index
  if (n === 0) return base;
  const k = Math.ceil(n / 2); // 1 for n=1..2, 2 for n=3..4, 3 for n=5..6, ...
  return (k % 2 === 1) ? flipRatio(base) : base;
}

/**
 * Suggest a line of 7 players given state.nextContext and ratio.
 * Preference: availability, fewest points played, matching pref and position balance.
 */
function suggestLine() {
  const context = /** @type {'O'|'D'} */ (document.getElementById('contextSelect').value);
  const ratioSel = document.getElementById('ratioSelect').value;
  const ratio = ratioSel === 'auto' ? nextAutoRatio(state.history, state.autoBase || '4M-3W') : ratioSel;
  const ratioParsed = parseRatio(ratio);

  const available = state.players.filter(p => p.available);
  const cmp = compareByContextThenPoints(context);
  const men = available.filter(p => p.gender === 'M').sort(cmp);
  const women = available.filter(p => p.gender === 'W').sort(cmp);

  /** @type {Player[]} */
  let chosen = [];

  if (ratioParsed !== 'auto') {
    const needMen = Math.min(ratioParsed.men, men.length);
    const needWomen = Math.min(ratioParsed.women, women.length);
    chosen.push(...men.slice(0, needMen));
    chosen.push(...women.slice(0, needWomen));
  }

  // Fill remaining up to 7 with fewest points, matching context preference first
  const remaining = 7 - chosen.length;
  if (remaining > 0) {
    const remainingPool = available
      .filter(p => !chosen.some(c => c.id === p.id))
      .sort(cmp);
    chosen.push(...remainingPool.slice(0, remaining));
  }

  // If we over/under-filled gender due to availability, allow fewer than 7; UI will warn
  renderLine(chosen, ratio);
}

// Rendering
function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) e.setAttribute(k, String(v));
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    e.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return e;
}

function render() {
  document.getElementById('contextSelect').value = state.nextContext;
  document.getElementById('ratioSelect').value = state.nextRatio;
  renderRoster();
  renderLine([]);
  renderHistory();
}

function renderRoster() {
  const list = document.getElementById('rosterList');
  list.innerHTML = '';
  if (state.players.length === 0) {
    list.append(el('div', { class: 'empty' }, 'No players yet. Add above.'));
    return;
  }
  const sorted = [...state.players].sort((a, b) => a.name.localeCompare(b.name));
  for (const p of sorted) {
    const row = el('div', { class: 'row' },
      el('div', {}, p.name,
        ' ', el('span', { class: `tag ${p.gender}` }, (p.gender === 'M' ? 'MM' : 'WM')),
        ' ', el('span', { class: 'tag' }, p.position),
        ' ', el('span', { class: 'tag' }, p.pref)
      ),
      el('div', { class: 'muted' }, `Pts: ${p.pointsPlayed}`),
      el('label', { class: 'availability' },
        el('input', { type: 'checkbox', checked: p.available ? '' : null, oninput: () => { p.available = !p.available; saveState(); renderRoster(); } }),
        'Available'
      ),
      el('div', { class: 'actions' },
        el('button', { onclick: () => editPlayer(p.id) }, 'Edit'),
        el('button', { class: 'danger', onclick: () => deletePlayer(p.id) }, 'Delete')
      )
    );
    list.append(row);
  }
}

/** @param {Player[]} players */
function renderLine(players, usedRatio) {
  const list = document.getElementById('lineList');
  list.innerHTML = '';
  const menCount = players.filter(p => p.gender === 'M').length;
  const womenCount = players.filter(p => p.gender === 'W').length;
  if (players.length === 0) list.append(el('div', { class: 'empty' }, 'No line yet. Click Suggest.'));
  for (const p of players) {
    const row = el('div', { class: 'row draggable' },
      el('div', {}, p.name, ' ', el('span', { class: `tag ${p.gender}` }, (p.gender === 'M' ? 'MM' : 'WM'))),
      el('div', { class: 'tags' }, el('span', { class: 'tag' }, p.position), el('span', { class: 'tag' }, p.pref)),
      el('div', { class: 'actions' },
        el('button', { onclick: () => replaceInLine(p.id) }, 'Replace'),
        el('button', { class: 'danger', onclick: () => removeFromLine(p.id) }, 'Remove')
      )
    );
    row.dataset.playerId = p.id;
    list.append(row);
  }
  const info = el('div', { class: 'muted' }, `Total ${players.length}/7 • ${menCount}MM-${womenCount}WM` + (usedRatio ? ` • Target ${usedRatio.replace('M','MM').replace('W','WM')}` : ''));
  list.prepend(info);

  currentLine = players.map(p => p.id);
  currentRatio = usedRatio || state.nextRatio;
}

function renderHistory() {
  const list = document.getElementById('historyList');
  list.innerHTML = '';
  if (state.history.length === 0) {
    list.append(el('div', { class: 'empty' }, 'No points recorded yet.'));
    return;
  }
  const recent = [...state.history].slice(-12).reverse();
  for (const h of recent) {
    const names = h.line
      .map(id => state.players.find(p => p.id === id)?.name || '—')
      .join(', ');
    list.append(el('div', { class: 'row ghost' },
      el('div', {}, new Date(h.timestamp).toLocaleTimeString(), ' • ', h.context, ' • ', h.ratio),
      el('div', { class: 'muted' }, names)
    ));
  }
}

// Line editing state
let currentLine = [];
let currentRatio = state.nextRatio;

function replaceInLine(playerId) {
  const dialog = document.getElementById('pickerDialog');
  const list = document.getElementById('pickerList');
  const gSel = document.getElementById('pickerGender');
  const pSel = document.getElementById('pickerPosition');
  gSel.value = 'any';
  pSel.value = 'any';

  function refresh() {
    list.innerHTML = '';
    const g = gSel.value;
    const pos = pSel.value;
    const pool = state.players.filter(p => p.available && !currentLine.includes(p.id) && p.id !== playerId);
    const filtered = pool.filter(p => (g === 'any' || p.gender === g) && (pos === 'any' || p.position === pos || p.position === 'both'))
      .sort(byPointsAsc);
    if (filtered.length === 0) list.append(el('div', { class: 'empty' }, 'No matches'));
    for (const p of filtered) {
      const onPick = () => {
        if (!playerId) {
          if (currentLine.length >= 7) { alert('Line already has 7 players'); return; }
          currentLine = [...currentLine, p.id];
        } else {
          currentLine = currentLine.map(id => id === playerId ? p.id : id);
        }
        renderLine(currentLine.map(id => state.players.find(s => s.id === id)).filter(Boolean), currentRatio);
        dialog.close();
        saveState();
      };
      const btn = el('button', { onclick: onPick }, `${p.name} (${p.pointsPlayed})`);
      list.append(el('div', { class: 'row' }, btn));
    }
  }
  gSel.oninput = refresh;
  pSel.oninput = refresh;
  refresh();
  dialog.showModal();
}

function removeFromLine(playerId) {
  currentLine = currentLine.filter(id => id !== playerId);
  renderLine(currentLine.map(id => state.players.find(s => s.id === id)).filter(Boolean), currentRatio);
}

function confirmPlayed() {
  if (currentLine.length === 0) return;
  const context = /** @type {'O'|'D'} */ (document.getElementById('contextSelect').value);
  const ratioSel = document.getElementById('ratioSelect').value;
  const ratio = ratioSel === 'auto' ? currentRatio : ratioSel;
  for (const id of currentLine) {
    const p = state.players.find(pl => pl.id === id);
    if (p) p.pointsPlayed += 1;
  }
  state.history.push({ timestamp: Date.now(), line: [...currentLine], context, ratio });
  state.nextContext = context === 'O' ? 'D' : 'O';
  state.nextRatio = ratioSel; // keep selection, even if auto
  saveState();
  render();
}

function undoLast() {
  const last = state.history.pop();
  if (!last) return renderHistory();
  for (const id of last.line) {
    const p = state.players.find(pl => pl.id === id);
    if (p) p.pointsPlayed = Math.max(0, p.pointsPlayed - 1);
  }
  saveState();
  render();
}

// Roster CRUD
function addPlayer(e) {
  e.preventDefault();
  const name = document.getElementById('playerName').value.trim();
  const gender = document.getElementById('playerGender').value;
  const position = document.getElementById('playerPosition').value;
  const pref = document.getElementById('playerPref').value;
  if (!name) return;
  state.players.push({ id: uid(), name, gender, position, pref, available: true, pointsPlayed: 0 });
  saveState();
  e.target.reset();
  renderRoster();
}

function editPlayer(id) {
  const p = state.players.find(p => p.id === id);
  if (!p) return;
  const name = prompt('Name', p.name);
  if (name == null) return; // cancel
  const gender = prompt('Gender (M/W or MM/WM)', p.gender === 'M' ? 'MM' : 'WM');
  const position = prompt('Position (handler/cutter/both)', p.position);
  const pref = prompt('Pref (O/D/either)', p.pref);
  p.name = name.trim() || p.name;
  if (gender) {
    const g = gender.toUpperCase();
    if (g === 'MM') p.gender = 'M';
    else if (g === 'WM') p.gender = 'W';
    else if (g === 'M' || g === 'W') p.gender = g;
  }
  if (['handler', 'cutter', 'both'].includes(position)) p.position = position;
  if (['O', 'D', 'either'].includes(pref)) p.pref = pref;
  saveState();
  renderRoster();
}

function deletePlayer(id) {
  if (!confirm('Delete player?')) return;
  state.players = state.players.filter(p => p.id !== id);
  currentLine = currentLine.filter(pid => pid !== id);
  saveState();
  render();
}

// Import/Export
function exportTeam() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  const a = document.createElement('a');
  a.href = dataStr;
  a.download = 'ultimate_line_caller.json';
  a.click();
}

function importTeam(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(String(reader.result));
      if (!obj || !Array.isArray(obj.players)) throw new Error('Invalid file');
      state = loadState(); // ensure defaults
      state.players = obj.players.map(p => ({ available: true, pointsPlayed: 0, ...p }));
      state.history = obj.history || [];
      state.nextContext = obj.nextContext || 'O';
      state.nextRatio = obj.nextRatio || '4M-3W';
      saveState();
      render();
    } catch (e) {
      alert('Failed to import: ' + e.message);
    }
  };
  reader.readAsText(file);
}

// Event bindings
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addPlayerForm').addEventListener('submit', addPlayer);
  document.getElementById('exportBtn').addEventListener('click', exportTeam);
  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importTeam(file);
    e.target.value = '';
  });
  document.getElementById('suggestBtn').addEventListener('click', suggestLine);
  document.getElementById('clearLineBtn').addEventListener('click', () => renderLine([]));
  document.getElementById('confirmBtn').addEventListener('click', confirmPlayed);
  document.getElementById('undoBtn').addEventListener('click', undoLast);
  document.getElementById('addToLineBtn').addEventListener('click', () => replaceInLine('')); // opens picker

  document.getElementById('contextSelect').addEventListener('input', (e) => { state.nextContext = e.target.value; saveState(); });
  document.getElementById('ratioSelect').addEventListener('input', (e) => {
    const val = e.target.value;
    state.nextRatio = val;
    if (val === '4M-3W' || val === '3M-4W') state.autoBase = val;
    saveState();
  });

  // Roster collapsible
  const rosterPanel = document.getElementById('rosterPanel');
  const rosterToggleBtn = document.getElementById('rosterToggleBtn');
  const applyCollapsed = () => {
    rosterPanel.classList.toggle('collapsed', !!state.ui?.rosterCollapsed);
    const expanded = !state.ui?.rosterCollapsed;
    rosterToggleBtn.setAttribute('aria-expanded', String(expanded));
    rosterToggleBtn.textContent = expanded ? 'Collapse' : 'Expand';
  };
  rosterToggleBtn.addEventListener('click', () => {
    state.ui = state.ui || {};
    // Default collapsed on small screens when first used
    if (state.ui.rosterCollapsed == null) state.ui.rosterCollapsed = window.matchMedia('(max-width: 720px)').matches;
    state.ui.rosterCollapsed = !state.ui.rosterCollapsed;
    saveState();
    applyCollapsed();
  });
  applyCollapsed();

  render();
});


