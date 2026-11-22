/* =========================================================
   ИгроЛаборатория — платформа создания игр для детей
   Полностью на русском языке. Без сборки и внешних библиотек.
   ========================================================= */
'use strict';

/* ---------- Базовые утилиты ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const COLS = 25, ROWS = 14, CELL = 32;
const W = COLS * CELL, H = ROWS * CELL;
const STORAGE_KEY = 'igrolab.projects.v1';
const PUB_KEY = 'igrolab.published.v1';

const keys = Object.create(null);
const pressed = Object.create(null);

/* Внутриигровая валюта: коины и магазин предметов */
const COIN_PRICE = 10;
const SHOP_ITEMS = [
  { id: 'heart', em: '❤️', title: 'Лишняя жизнь', desc: 'Сразу +1 жизнь в этой игре' },
  { id: 'shield', em: '🛡️', title: 'Защитный щит', desc: '8 секунд герой не получает урон' },
  { id: 'clock', em: '⏰', title: 'Дополнительное время', desc: '+10 секунд на уровень' },
  { id: 'score', em: '⭐', title: 'Бонус очков', desc: '+100 очков сразу' },
  { id: 'magnet', em: '🧲', title: 'Магнит наград', desc: '10 секунд награды летят к герою', miniOnly: true },
  { id: 'bomb', em: '💣', title: 'Бомба против врагов', desc: 'Уничтожить всех врагов на поле' }
];


/* ---------- Задания в верхней панели ---------- */
const MISSION_REWARD = 4;
const winMetric = e => (e && e.finished ? 1 : 0);
const starMetric = e => {
  if (!e) return 0;
  if (Array.isArray(e.stars)) return e.stars.filter(s => s.got).length;
  if (Array.isArray(e.pickups)) return e.pickups.filter(it => it.eff === 'goal' && it.got).length;
  return 0;
};
const starGoal = e => {
  if (e && Array.isArray(e.stars) && e.stars.length) return e.stars.length;
  if (e && Array.isArray(e.pickups)) {
    const n = e.pickups.filter(it => it.eff === 'goal').length;
    if (n) return n;
  }
  return 5;
};
const MISSION_DEFS = {
  platformer:  { text: 'Собрать все звёзды и дойти до финиша', stars: true, goal: starGoal, metric: starMetric },
  runnerhuman: { text: 'Дойти до финиша в обби с огненными шарами', goal: 1, metric: winMetric },
  collector:   { text: 'Собрать все звёзды и найти выход из лабиринта', stars: true, goal: starGoal, metric: starMetric },
  racer:       { text: 'Набрать 100 очков и прийти к финишу', goal: 100 },
  quiz:        { text: 'Ответить правильно на вопросы викторины', goal: 50 },
  catcher:     { text: 'Поймать яблоки и набрать 100 очков', goal: 100 },
  snake:       { text: 'Вырасти и набрать 100 очков', goal: 100 },
  pong:        { text: 'Выиграть матч в пинг-понг', goal: e => e.target || 7, metric: e => e.scoreP || 0 },
  arkanoid:    { text: 'Разбить кирпичи и набрать 100 очков', goal: 100 },
  shooter:     { text: 'Сбить пришельцев и набрать 100 очков', goal: 100 },
  tictactoe:   { text: 'Выиграть партию в крестики-нолики', goal: 1, metric: e => e.wins || 0 },
  memory:      { text: 'Найти все пары карточек', goal: e => e.pairs || 10, metric: e => e.matched || 0 },
  math:        { text: 'Решить примеры и набрать 100 очков', goal: 100 },
  starraid:    { text: 'Сбить 10 вражеских кораблей', goal: 100 },
  tank:        { text: 'Пройти Батл Сити на 3 жизнях и уничтожить 20 танков', goal: 20, kills: 20, lives: 3, metric: e => e.hits || 0 },
  range:       { text: 'Попасть по мишеням и набрать 100 очков', goal: 100 },
  whack:       { text: 'Ударить кротов и набрать 100 очков', goal: 100 },
  runner:      { text: 'Пробежать дистанцию и набрать 100 очков', goal: 100 },
  reaction:    { text: 'Нажать вовремя и набрать 100 очков', goal: 100 },
  defense:     { text: 'Отразить атаки и набрать 100 очков', goal: 100 },
  farm:        { text: 'Собрать урожай и набрать 100 очков', goal: 100 },
  duel:        { text: 'Победить в поединке героев', goal: 1, metric: winMetric },
  brawl:       { text: 'Выиграть кулачный бой', goal: 1, metric: winMetric },
  zombie:      { text: 'Обороняться и набрать 100 очков', goal: 100 },
  rescue:      { text: 'Спасти друзей и набрать 100 очков', goal: 100 },
  mazelava:    { text: 'Собрать ключи и выбраться из лабиринта', goal: 100 },
  bomber:      { text: 'Взорвать кирпичи и найти выход', goal: 80 },
  towerdef:    { text: 'Защитить крепость от всех волн', goal: 100 },
  survival:    { text: 'Собрать канистры и финишировать', goal: 100 },
  airfight:    { text: 'Сбить самолёты и набрать 100 очков', goal: 100 },
  hockey:      { text: 'Забить шайбы и выиграть матч', goal: 100 },
  fisher:      { text: 'Поймать рыбу и набрать 100 очков', goal: 100 },
  gardener:    { text: 'Собрать урожай и набрать 100 очков', goal: 100 },
  station:     { text: 'Починить станцию и собрать энергию', goal: 100 },
  royale:      { text: 'Победить соперников и остаться в круге', goal: 100 }
};
function currentMission(p) {
  const d = MISSION_DEFS[p && p.template];
  return d ? Object.assign({ reward: MISSION_REWARD }, d)
           : { text: 'Выиграть в этой игре', reward: MISSION_REWARD, goal: 1, metric: winMetric };
}
function missionGoal(def, e, p) {
  return Math.max(1, typeof def.goal === 'function' ? def.goal(e, p) : def.goal);
}
function missionValue(def, e) {
  if (!e) return 0;
  const fn = def.metric || (x => x.score || 0);
  const v = Number(fn(e)) || 0;
  return Math.max(0, v);
}
function missionDone(p, e, win) {
  if (!win || !p) return false;
  const def = currentMission(p);
  if (def.kills && (e.hits || 0) < def.kills) return false;
  if (def.lives && (e.lives || 0) < def.lives) return false;
  if (def.stars) return missionValue(def, e) >= missionGoal(def, e, p);
  return true;
}
function renderMission() {
  const bar = $('#missionBar');
  if (!bar || !state.project) return;
  const p = state.project, def = currentMission(p), e = state.engine;
  const goal = missionGoal(def, e, p);
  const done = !!(p.missions && p.missions[p.template]);
  const val = done ? goal : Math.min(goal, missionValue(def, e));
  $('#missionText').textContent = def.text;
  $('#missionCount').textContent = `${val} / ${goal}`;
  $('#missionFill').style.width = (goal ? val / goal * 100 : 0) + '%';
  $('#missionReward').textContent = done ? '✔ Выполнено' : `+${def.reward} 🪙`;
  bar.classList.toggle('done', done);
  bar.classList.toggle('playing', state.mode === 'play');
}
function missionHudHtml() {
  if (!state.project || !state.engine) return '';
  const def = currentMission(state.project), e = state.engine;
  const goal = missionGoal(def, e, state.project);
  const done = !!(state.project.missions && state.project.missions[state.project.template]);
  const val = done ? goal : Math.min(goal, missionValue(def, e));
  return `<span class="hud-pill mission-hud">${done ? '✔' : '📋'} ${def.text} · ${val}/${goal}</span>`;
}

const DIFF = {
  easy:   { speed: 0.92, traffic: 0.85, time: 78, quizTime: 18, label: 'Лёгкая' },
  normal: { speed: 1.18, traffic: 1.25, time: 48, quizTime: 13, label: 'Средняя' },
  hard:   { speed: 1.48, traffic: 1.75, time: 32, quizTime: 9,  label: 'Трудная' }
};
function diffOf(p) { return DIFF[(p && p.settings && p.settings.difficulty) || 'normal'] || DIFF.normal; }
/* Новые жанры: по 3 игры в каждом */
const SHOOTER_IDS = ['starraid', 'tank', 'range'];
const ARCADE_IDS  = ['whack', 'runner', 'reaction'];
const STRATEGY_IDS = ['defense', 'farm', 'duel'];
const ACTION_IDS  = ['brawl', 'zombie', 'rescue'];
const GENRE_IDS = SHOOTER_IDS.concat(ARCADE_IDS, STRATEGY_IDS, ACTION_IDS);
/* В этих играх управляют кликом по полю — экранные кнопки только мешают */
const MINI_IDS = ['mazelava', 'bomber', 'towerdef', 'survival', 'airfight', 'hockey', 'fisher', 'gardener', 'station', 'royale'];
const MINI_LABELS = {
  mazelava: '🔑 ключей', bomber: '🧱 кирпичей', towerdef: '👾 соперников', survival: '⛽ канистр',
  airfight: '✈️ самолётов', hockey: '🏒 голов', fisher: '🐟 рыбы', gardener: '🌻 урожая',
  station: '🔋 энергии', royale: '👑 соперников'
};
/* В этих играх управляют кликом — экранные кнопки не нужны */
const TOUCHLESS_IDS = ['range', 'whack', 'reaction', 'defense', 'farm', 'duel', 'towerdef', 'gardener', 'station'];

const state = {
  screen: 'gallery',
  project: null,
  engine: null,
  mode: 'edit',
  tool: 'wall',
  dirty: false,
  saveTimer: null,
  painting: false,
  newItemEm: '🍎',
  newItemName: '',
  newItemEffect: 'points25'
};

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}
function uid() { return 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hasGrid(p) { return !!p && (p.template === 'platformer' || p.template === 'runnerhuman' || p.template === 'collector'); }

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
function drawEmoji(ctx, emoji, x, y, size) {
  ctx.save();
  ctx.font = `${size}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji || '❓', x, y);
  ctx.restore();
}
function shade(hex, amt) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#5158a8';
  const n = parseInt(m[1], 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}
/* ---------- Общая графика: фоны, свечение, частицы ---------- */
let visualClock = 0;
function hash01(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const VISUAL_MOTIFS = {
  platformer: 'stars', runnerhuman: 'stars', collector: 'bubbles', racer: 'road', quiz: 'question',
  catcher: 'leaves', snake: 'dots', pong: 'dots', arkanoid: 'stars',
  shooter: 'stars', tictactoe: 'dots', memory: 'stars', math: 'dots',
  starraid: 'stars', tank: 'grid', range: 'dots', whack: 'leaves',
  runner: 'road', reaction: 'dots', defense: 'grid', farm: 'leaves',
  duel: 'dots', brawl: 'stars', zombie: 'leaves', rescue: 'leaves'
};
function drawBackdrop(ctx, p, opts = {}) {
  const base = opts.top || (p && p.settings && p.settings.bg) || '#20234a';
  const accent = opts.accent || (p && p.settings && p.settings.accent) || '#ffd166';
  const motif = opts.motif || (p && VISUAL_MOTIFS[p.template]) || 'dots';
  const bottom = opts.bottom || shade(base, -38);
  const t = visualClock;
  const g = ctx.createLinearGradient(0, 0, W * .35, H);
  g.addColorStop(0, shade(base, 30));
  g.addColorStop(.55, base);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const glows = [
    [W * (.2 + .05 * Math.sin(t * .23)), H * .18, H * .55, accent, .13],
    [W * (.82 + .04 * Math.cos(t * .19)), H * .82, H * .48, '#7cf3ff', .10],
    [W * .55, H * (.15 + .05 * Math.sin(t * .31)), H * .42, '#ff7ad9', .07]
  ];
  for (const [x, y, r, col, a] of glows) {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, col);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.045)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();
  ctx.save();
  for (let i = 0; i < 26; i++) {
    const sx = hash01(i + 1) * W;
    const speed = 8 + hash01(i + 51) * 22;
    const raw = (hash01(i + 101) * H - t * speed) % (H + 60);
    const y = raw < -30 ? raw + H + 60 : raw;
    const r = 1.2 + hash01(i + 151) * 2.6;
    ctx.globalAlpha = .10 + hash01(i + 201) * .18;
    ctx.fillStyle = i % 3 === 0 ? accent : '#ffffff';
    ctx.strokeStyle = ctx.fillStyle;
    if (motif === 'bubbles') {
      ctx.beginPath(); ctx.arc(sx, y, r * 2.4, 0, 7); ctx.lineWidth = 1; ctx.stroke();
    } else if (motif === 'leaves') {
      ctx.beginPath(); ctx.ellipse(sx, y, r * 3, r * 1.6, t * .2 + i, 0, 7); ctx.fill();
    } else if (motif === 'road') {
      ctx.fillRect(sx, y, 2, r * 5);
    } else if (motif === 'question' || motif === 'dots') {
      ctx.fillRect(sx, y, r * 2, r * 2);
    } else {
      ctx.beginPath(); ctx.arc(sx, y, r, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}
function drawSceneFinish(ctx) {
  const vg = ctx.createRadialGradient(W / 2, H * .45, H * .18, W / 2, H * .5, H * .9);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(6,4,28,.26)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  const sg = ctx.createLinearGradient(0, 0, 0, 80);
  sg.addColorStop(0, 'rgba(255,255,255,.10)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, 80);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.10)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.restore();
}
const FX = {
  parts: [],
  clear() { this.parts.length = 0; },
  burst(x, y, color, n = 14) {
    for (let i = 0; i < n; i++) this.parts.push({
      x, y, vx: rand(-140, 140), vy: rand(-180, 60),
      life: rand(.35, .8), max: .8, size: rand(2, 5), color, grav: 260, conf: false
    });
  },
  celebrate() {
    const colors = ['#ffd166', '#ff6b81', '#7cf3ff', '#8affc1', '#c792ea', '#fff'];
    for (let i = 0; i < 90; i++) this.parts.push({
      x: rand(0, W), y: rand(-H * .4, 0), vx: rand(-45, 45), vy: rand(60, 190),
      life: rand(1.6, 3.2), max: 3.2, size: rand(3, 7),
      color: colors[i % colors.length], grav: 40, conf: true, rot: rand(0, 7), vr: rand(-6, 6)
    });
  },
  update(dt) {
    for (const q of this.parts) {
      q.life -= dt;
      q.vy += q.grav * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      if (q.conf) q.rot += q.vr * dt;
    }
    this.parts = this.parts.filter(q => q.life > 0 && q.y < H + 30);
  },
  draw(ctx) {
    if (!this.parts.length) return;
    ctx.save();
    for (const q of this.parts) {
      ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5);
      ctx.fillStyle = q.color;
      if (q.conf) {
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.fillRect(-q.size, -q.size * .5, q.size * 2, q.size);
        ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill();
      }
    }
    ctx.restore();
  }
};

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

let audioCtx = null, activeBeeps = 0;
function beep(freq = 600, dur = 0.06) {
  if (!state.project || state.project.settings.sound === false) return;
  if (activeBeeps >= 24) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.055, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
    activeBeeps++;
    o.onended = () => {
      activeBeeps = Math.max(0, activeBeeps - 1);
      try { o.disconnect(); g.disconnect(); } catch (e) { /* ignored */ }
    };
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* звук не критичен */ }
}

let toastTimer = null;
function showToast(text, type = '') {
  const el = $('#toast');
  el.textContent = text;
  el.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 2600);
}

/* ---------- Голос: распознавание команд и озвучка правил ---------- */
function updateVoiceChip(text, listening = false) {
  const el = $('#voiceChip');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('listening', listening);
}
function tapKey(code, ms = 420) {
  keys[code] = true;
  pressed[code] = true;
  setTimeout(() => { keys[code] = false; }, ms);
}
/* ---------- Сенсорное управление ---------- */
function isTouchDevice() {
  return (window.matchMedia && matchMedia('(pointer: coarse)').matches) ||
    ('ontouchstart' in window) || window.innerWidth <= 900;
}
function updateTouchControls() {
  const el = $('#touchControls');
  const fire = $('#touchFire');
  const p = state.project;
  const need = state.mode === 'play' && isTouchDevice() && !(p && TOUCHLESS_IDS.includes(p.template));
  if (el) el.classList.toggle('hidden', !need);
  if (fire) fire.classList.toggle('hidden', !(need && p && p.template === 'runnerhuman'));
}
function setVirtualKey(code, down) {
  if (down && !keys[code]) pressed[code] = true;
  keys[code] = down;
}
function bindTouchControls() {
  document.querySelectorAll('#touchControls .touch-btn').forEach(btn => {
    const code = btn.dataset.key;
    const release = () => { btn.classList.remove('hold'); setVirtualKey(code, false); };
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      btn.classList.add('hold');
      setVirtualKey(code, true);
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignored */ }
    });
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });
}
/* ---------- Полный экран ---------- */
function isFullscreen() {
  const stage = $('#gameStage');
  return !!stage && (document.fullscreenElement === stage || stage.classList.contains('fake-fullscreen'));
}
function syncFullscreenUI() {
  const stage = $('#gameStage');
  if (stage && document.fullscreenElement === stage) {
    stage.classList.remove('fake-fullscreen');
    delete stage.dataset.fsToken;
  }
  const active = isFullscreen();
  document.body.classList.toggle('fullscreen-mode', active);
  const btn = $('#btnFullscreen');
  if (btn) btn.textContent = active ? '✕ Выйти' : '⛶ На весь экран';
}
function exitFullscreen() {
  const stage = $('#gameStage');
  if (!stage) return;
  delete stage.dataset.fsToken;
  if (document.fullscreenElement === stage) {
    document.exitFullscreen().catch(() => {});
  }
  stage.classList.remove('fake-fullscreen');
  syncFullscreenUI();
}
function toggleFullscreen() {
  if (!state.project || state.mode !== 'play') return;
  if (isFullscreen()) { exitFullscreen(); return; }
  const stage = $('#gameStage');
  if (!stage) return;
  const token = String(Date.now()) + Math.random();
  stage.dataset.fsToken = token;
  const fallback = () => {
    if (stage.dataset.fsToken !== token) return;
    delete stage.dataset.fsToken;
    stage.classList.add('fake-fullscreen');
    syncFullscreenUI();
  };
  // Некоторые мобильные браузеры «успешно» отвечают, но режим не включается —
  // в этом случае через секунду всё равно разворачиваем поле на весь окно.
  setTimeout(() => {
    if (stage.dataset.fsToken !== token) return;
    if (document.fullscreenElement !== stage) fallback();
    else { delete stage.dataset.fsToken; syncFullscreenUI(); }
  }, 1200);
  const done = () => {
    if (stage.dataset.fsToken !== token) return;
    if (document.fullscreenElement === stage) { delete stage.dataset.fsToken; syncFullscreenUI(); }
    else fallback();
  };
  if (stage.requestFullscreen) {
    try {
      const result = stage.requestFullscreen();
      if (result && typeof result.then === 'function') result.then(done).catch(fallback);
      else done();
    } catch (err) { fallback(); }
  } else {
    fallback();
  }
}
const Voice = {
  rec: null,
  active: false,
  denied: false,
  supported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
  start() {
    if (!this.supported() || !state.project || !state.project.settings.voice || this.active || this.denied) return false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.rec = new SR();
    this.rec.lang = 'ru-RU';
    this.rec.continuous = true;
    this.rec.interimResults = false;
    this.rec.maxAlternatives = 1;
    this.rec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) this.handle(e.results[i][0].transcript.trim().toLowerCase());
      }
    };
    this.rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        this.denied = true;
        showToast('Разреши доступ к микрофону — и голос заработает 🎤', 'warn');
        this.stop();
      }
    };
    this.rec.onend = () => {
      if (this.active) { try { this.rec.start(); } catch (err) { /* ignored */ } }
    };
    try {
      this.rec.start();
      this.active = true;
      updateVoiceChip('🎤 слушаю...', true);
      return true;
    } catch (err) {
      showToast('Не получилось включить микрофон', 'warn');
      return false;
    }
  },
  stop() {
    this.active = false;
    if (this.rec) { try { this.rec.stop(); } catch (err) { /* ignored */ } this.rec = null; }
    updateVoiceChip(state.project && state.project.settings.voice ? '🎤 микрофон выключен' : '🎤 голос выключен');
  },
  handle(text) {
    if (!text) return;
    updateVoiceChip(`🎤 «${text.slice(0, 18)}»`, true);
    if (/влево|лево|лёво|^a$/.test(text)) tapKey('ArrowLeft');
    else if (/вправо|право|^d$/.test(text)) tapKey('ArrowRight');
    else if (/вверх|прыжок|прыгай|прыгни|^w$|^space$/.test(text)) tapKey('Space', 280);
    else if (/вниз|низ|^s$/.test(text)) tapKey('ArrowDown');
    else if (/огонь|огнен|фаер|бросок|шар|^j$|^f$/.test(text)) tapKey('KeyJ');
    else if (/стоп|остановись|хват/.test(text)) { for (const k in keys) keys[k] = false; }
  }
};
const Speech = {
  supported() { return 'speechSynthesis' in window; },
  speak(text) {
    if (!this.supported() || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      u.rate = 0.95;
      u.pitch = 1.08;
      speechSynthesis.speak(u);
    } catch (e) { /* озвучка не критична */ }
  },
  stop() { if (this.supported()) { try { speechSynthesis.cancel(); } catch (e) { /* ignored */ } } }
};
function rulesText(p) {
  const t = TEMPLATES[p.template];
  return `${t.title}. ${t.hint.replace(/^[💡\s]+/, '')} Удачи!`;
}

/* ---------- Шаблоны и уровни по умолчанию ---------- */
const TEMPLATES = {
  platformer: {
    id: 'platformer', title: 'Прыгающий герой', emoji: '🏃', color: '#efeaff',
    tag: 'Платформер', desc: 'Прыгай по платформам, обходи злодеев и собирай все звёзды. Настоящая игра с гравитацией!',
    features: ['Прыжки и гравитация', 'Редактор уровня', 'Звёзды и враги'],
    canvasTitle: 'Редактор платформера',
    canvasSubtitle: 'Расставляй платформы, звёзды и врагов — а затем нажми «Играть»',
    hint: '💡 Управление в игре: ← → или A D — двигаться, Пробел / ↑ / W — прыгать.'
  },
  runnerhuman: {
    id: 'runnerhuman', title: 'Бегущий человек', emoji: '🔥', color: '#fff0e3',
    tag: 'Обби-платформер', desc: 'Полоса препятствий как в Roblox Studio: десятки платформ, движущиеся площадки, контрольные точки и шипы. Беги, прыгай и бросай огненные шары, как Марио!',
    features: ['Огненные шары', 'Обби-уровень', 'Контрольные точки'],
    canvasTitle: 'Обби-редактор: Бегущий человек',
    canvasSubtitle: 'Собери полосу препятствий: платформы, трамплины, шипы, движущиеся площадки и финиш',
    hint: '💡 ← → или A D — бег, Пробел / ↑ / W — прыжок, J или F — огненный шар. На телефоне — кнопки «Действие» и «Огонь».'
  },
  collector: {
    id: 'collector', title: 'Собери звёзды', emoji: '🌟', color: '#fff2d9',
    tag: 'Аркада', desc: 'Бегай по лабиринту, собирай звёзды и убегай от вездесущих монстриков. Успей до конца таймера!',
    features: ['Лабиринт', 'Таймер', 'Редактор уровня'],
    canvasTitle: 'Редактор лабиринта',
    canvasSubtitle: 'Нарисуй стены и разложи звёзды — получится свой лабиринт',
    hint: '💡 Управление в игре: стрелки или WASD — двигаться во все стороны. Собирай все звёзды!'
  },
  racer: {
    id: 'racer', title: 'Турбо-гонки', emoji: '🏎️', color: '#dff3ff',
    tag: 'Гонки', desc: 'Лети по шоссе и объезжай машины. Чем дальше едешь, тем больше очков! Настрой машину и трафик.',
    features: ['Динамичная езда', 'Настройка машины', 'Гонка за очками'],
    canvasTitle: 'Настройка гонки',
    canvasSubtitle: 'Выбери машину, цвет дороги и количество соперников',
    hint: '💡 Управление в игре: ← → или A D — руль. Объезжай машины, чтобы не разбиться.'
  },
  quiz: {
    id: 'quiz', title: 'Умная викторина', emoji: '🧠', color: '#e5f8e9',
    tag: 'Викторина', desc: 'Придумай свои вопросы и варианты ответов. Друзья будут удивлены, какие ты умный(ая)!',
    features: ['Свои вопросы', '4 варианта ответа', 'Счёт и результат'],
    canvasTitle: 'Редактор викторины',
    canvasSubtitle: 'Пиши вопросы слева — здесь появится предварительный вид',
    hint: '💡 В игре выбирай ответ кликом. За каждый правильный ответ — 10 очков.'
  },
  catcher: {
    id: 'catcher', title: 'Лови яблоки', emoji: '🍎', color: '#ffe6e6',
    tag: 'Аркада', desc: 'Держи корзину под падающими яблоками! Золотые звёзды дают много очков, а бомбы лучше не ловить.',
    features: ['Ловля предметов', 'Бомбы и сюрпризы', 'Рекорд очков'],
    canvasTitle: 'Настройка ловли',
    canvasSubtitle: 'Выбери корзину и настрой, как часто будут падать предметы',
    hint: '💡 Управление в игре: ← → или A D — двигать корзину. Лови 🍎 и ⭐, избегай 💣!'
  },
  snake: {
    id: 'snake', title: 'Змейка', emoji: '🐍', color: '#e8f8e9',
    tag: 'Классика', desc: 'Управляй змейкой и съедай яблоки! После каждого яблока змейка растёт. Не врезайся в стену и в саму себя.',
    features: ['Растущая змейка', 'Счёт и рекорд', 'Разная скорость'],
    canvasTitle: 'Настройка змейки',
    canvasSubtitle: 'Выбери скорость, цвет змейки и любимое лакомство',
    hint: '💡 Управление: стрелки или WASD. Съедай 🍎 — змейка станет длиннее. Не трогай стены и свой хвост!'
  },
  pong: {
    id: 'pong', title: 'Пинг-Понг', emoji: '🏓', color: '#e9f0ff',
    tag: 'Спорт', desc: 'Отбивай мячик ракеткой и забивай гол сопернику-компьютеру! Тот, кто наберёт нужное число очков, побеждает.',
    features: ['Соперник-компьютер', 'Счёт до победы', 'Разная сложность'],
    canvasTitle: 'Настройка матча',
    canvasSubtitle: 'Настрой скорость мяча, ракетку и число очков до победы',
    hint: '💡 Управление: ↑ ↓ или W S — двигать ракетку. Не дай мячу пролететь мимо!'
  },
  arkanoid: {
    id: 'arkanoid', title: 'Разбей кирпичи', emoji: '🧱', color: '#fff0e3',
    tag: 'Аркада', desc: 'Держи платформу и отбивай шарик, чтобы разбить все кирпичики. За каждый кирпич — очки!',
    features: ['Разбивание кирпичей', 'Отскоки шарика', 'Три жизни'],
    canvasTitle: 'Настройка кирпичей',
    canvasSubtitle: 'Выбери цвета кирпичей, скорость и количество рядов',
    hint: '💡 Управление: ← → или A D — двигать платформу. Отбивай шарик и разбивай все кирпичи!'
  },
  shooter: {
    id: 'shooter', title: 'Космический шутер', emoji: '🚀', color: '#e6e9ff',
    tag: 'Космос', desc: 'Лети на космическом корабле и стреляй по злым пришельцам, прежде чем они долетят до Земли!',
    features: ['Стрельба', 'Пришельцы и звёзды', 'Счёт и жизни'],
    canvasTitle: 'Настройка космоса',
    canvasSubtitle: 'Выбери корабль, скорость и сложность битвы',
    hint: '💡 Управление: ← → или A D — лететь, Пробел — стрелять. Сбивай 👾 и собирай звёзды!'
  },
  tictactoe: {
    id: 'tictactoe', title: 'Крестики-нолики', emoji: '⭕', color: '#f0eaff',
    tag: 'Настолка', desc: 'Ты против компьютера! Ходи по очереди и постарайся первым выстроить три свои значка в ряд.',
    features: ['Игра против компьютера', 'Три уровня ума', 'Клик по клетке'],
    canvasTitle: 'Настройка игры',
    canvasSubtitle: 'Выбери, кто ходит первым, и насколько умным будет соперник',
    hint: '💡 Кликай по свободной клетке, чтобы поставить свой знак. Три в ряд — победа!'
  },
  memory: {
    id: 'memory', title: 'Игра в память', emoji: '🃏', color: '#ffe9f2',
    tag: 'Память', desc: 'Переворачивай карточки и находи пары одинаковых картинок. Чем меньше ходов — тем лучше результат!',
    features: ['Пары картинок', 'Счёт ходов', 'Разное поле'],
    canvasTitle: 'Настройка памяти',
    canvasSubtitle: 'Выбери сколько пар найти и какие картинки будут на карточках',
    hint: '💡 Кликай по карточке, чтобы открыть её. Найди две одинаковые — они останутся открытыми!'
  },
  math: {
    id: 'math', title: 'Математическая гонка', emoji: '🧮', color: '#e7f7f7',
    tag: 'Обучение', desc: 'Решай примеры как можно быстрее! За правильный ответ — очки, за ошибку — минус жизнь. Стань чемпионом счёта!',
    features: ['Сложение и вычитание', 'Таймер', 'Счёт и жизни'],
    canvasTitle: 'Настройка примеров',
    canvasSubtitle: 'Выбери действия, число примеров и время на ответ',
    hint: '💡 Решай пример и кликай правильный ответ. За правильный — 10 очков, за ошибку — минус жизнь.'
  },

  /* ---------- ШУТЕРЫ ---------- */
  starraid: {
    id: 'starraid', title: 'Звёздный рейд', emoji: '🚀', color: '#e3e8ff',
    tag: 'Шутер', desc: 'Лети сквозь звёздное поле и сбивай вражеские корабли. Двигайся стрелками и стреляй пробелом!',
    features: ['Стрельба', 'Волги врагов', 'Счёт и жизни'],
    canvasTitle: 'Настройка рейда', canvasSubtitle: 'Выбери скорость, жизни и сколько врагов нужно сбить',
    hint: '💡 ← → или A D — руль, Пробел — стрельба. Сбивай 👾 и не дай им долететь до низа.'
  },
  tank: {
    id: 'tank', title: 'Батл Сити', emoji: '🛡️', color: '#e6f3df',
    tag: 'Танки', desc: 'Настоящий Battle City! Веди танк по лабиринту, разрушай кирпичные стены и защищай базу 🦅 от вражеских танков.',
    features: ['Лабиринт из стен', 'База, которую нужно беречь', 'Три карты боя'],
    canvasTitle: 'Настройка Батл Сити', canvasSubtitle: 'Выбери карту, скорость танка, жизни и сколько врагов уничтожить',
    hint: '💡 Стрелки или WASD — езда и поворот башни, Пробел — выстрел. Не дай врагам разрушить базу 🦅 внизу поля!'
  },
  range: {
    id: 'range', title: 'Меткий тир', emoji: '🎯', color: '#fff0df',
    tag: 'Шутер', desc: 'Попадай по появляющимся мишеням как можно точнее. Тренируй глазомер и реакцию!',
    features: ['Прицельная стрельба', 'Таймер', 'Рекорд очков'],
    canvasTitle: 'Настройка тира', canvasSubtitle: 'Выбери сколько мишеней поразить и время на стрельбу',
    hint: '💡 Кликай или нажимай пальцем по мишени 🎯. Промах отнимает очко.'
  },

  /* ---------- АРКАДА ---------- */
  whack: {
    id: 'whack', title: 'Бей кротов', emoji: '🔨', color: '#f2e8ff',
    tag: 'Аркада', desc: 'Кроты выглядывают из норок — успей ударить молотком, пока они не спрятались!',
    features: ['Быстрая реакция', '9 норок', 'Весёлые кроты'],
    canvasTitle: 'Настройка кротов', canvasSubtitle: 'Настрой скорость кротов, время и сколько нужно поймать',
    hint: '💡 Кликай по кроту 🐹, когда он вылезет. Не пропускай слишком много!'
  },
  runner: {
    id: 'runner', title: 'Бегун', emoji: '🏃', color: '#e4f7ef',
    tag: 'Аркада', desc: 'Герой бежит сам — прыгай через препятствия и собирай монетки. Сколько сможешь пробежать?',
    features: ['Бесконечный бег', 'Прыжки', 'Монеты и очки'],
    canvasTitle: 'Настройка бега', canvasSubtitle: 'Выбери скорость, жизни и дистанцию до победы',
    hint: '💡 Пробел, ↑ или W — прыжок. Перепрыгивай 📦 и собирай 🪙.'
  },
  reaction: {
    id: 'reaction', title: 'Быстрая реакция', emoji: '⚡', color: '#fff6d8',
    tag: 'Аркада', desc: 'Нажимай на кнопку, как только она загорится! Проверь, насколько быстро ты реагируешь.',
    features: ['Скорость реакции', 'Случайные места', 'Рекорд'],
    canvasTitle: 'Настройка реакции', canvasSubtitle: 'Настрой цель по очкам и сколько попыток даётся',
    hint: '💡 Жди зелёную кнопку «ЖМИ!» и нажимай её пальцем или мышью.'
  },

  /* ---------- СТРАТЕГИИ ---------- */
  defense: {
    id: 'defense', title: 'Защита замка', emoji: '🏰', color: '#e8ecff',
    tag: 'Стратегия', desc: 'Строй башни на траве и не подпускай врагов к замку. Продумай, где поставить защиту!',
    features: ['Постройка башен', 'Волги врагов', 'Ограниченный бюджет'],
    canvasTitle: 'Настройка защиты', canvasSubtitle: 'Настрой жизни замка, бюджет и сколько врагов отразить',
    hint: '💡 Кликай по траве, чтобы построить башню за 14 монет. Башни сами стреляют по врагам.'
  },
  farm: {
    id: 'farm', title: 'Умная ферма', emoji: '🌾', color: '#eaf7df',
    tag: 'Стратегия', desc: 'Сажай семена, поливай грядки и собирай урожай. Управляй водой и зарабатывай монеты!',
    features: ['Грядки', 'Полив и урожай', 'Таймер'],
    canvasTitle: 'Настройка фермы', canvasSubtitle: 'Выбери время, цель по урожаю и сколько воды даётся',
    hint: '💡 Клик по пустой грядке — посадить, по спелой — собрать урожай. Вода постепенно восстанавливается.'
  },
  duel: {
    id: 'duel', title: 'Поединок героев', emoji: '⚔️', color: '#ffe9e6',
    tag: 'Стратегия', desc: 'Пошаговый бой: выбирай атаку, защиту или лечение и думай, что сделает соперник!',
    features: ['Пошаговый бой', 'Атака / защита / лечение', 'Полоса здоровья'],
    canvasTitle: 'Настройка поединка', canvasSubtitle: 'Настрой прочность героя, урон и количество раундов',
    hint: '💡 Нажимай кнопки внизу поля: «Атака», «Защита» или «Лечение». Победи соперника!'
  },

  /* ---------- ЭКШЕН ---------- */
  brawl: {
    id: 'brawl', title: 'Кулачный бой', emoji: '🥊', color: '#ffece0',
    tag: 'Экшен', desc: 'Настоящий бой на ринге! Ударяй соперника, блокируй его удары и побеждай.',
    features: ['Движение и удары', 'Блок', 'Таймер боя'],
    canvasTitle: 'Настройка боя', canvasSubtitle: 'Настрой скорость, прочность и время раунда',
    hint: '💡 ← → — движение, Пробел — удар, ↓ — блок. Сбей сопернику все очки здоровья!'
  },
  zombie: {
    id: 'zombie', title: 'Оборона от зомби', emoji: '🧟', color: '#e2efe4',
    tag: 'Экшен', desc: 'Зомби идут со всех сторон! Бегай по кладбищу и стреляй, пока не кончатся жизни.',
    features: ['Оборона', 'Стрельба вверх', 'Нарастающая волна'],
    canvasTitle: 'Настройка обороны', canvasSubtitle: 'Настрой скорость, жизни и сколько зомби нужно победить',
    hint: '💡 ← → — движение, Пробел — стрельба. Не подпускай зомби к себе!'
  },
  rescue: {
    id: 'rescue', title: 'Спаси друзей', emoji: '🕊️', color: '#e7f5ff',
    tag: 'Экшен', desc: 'Бегай по парку, спасай друзей и обходи опасности. Спаси всех — и ты герой!',
    features: ['Спасение', 'Опасности', 'Счёт и жизни'],
    canvasTitle: 'Настройка спасения', canvasSubtitle: 'Настрой скорость, жизни и сколько друзей нужно спасти',
    hint: '💡 Стрелки или WASD — бег. Собирай 🧒, избегай 🔥.'
  },
  mazelava: {
    id: 'mazelava', title: 'Лавовый лабиринт', emoji: '🔥', color: '#ffe6dc',
    tag: 'Лабиринт', desc: 'Собирай ключи и обходи раскалённую лаву. Успей до того, как кончится время!',
    features: ['Ключи', 'Опасная лава', 'Таймер'],
    canvasTitle: 'Настройка лабиринта', canvasSubtitle: 'Выбери число ключей, время и скорость героя',
    hint: '💡 Стрелки или WASD — движение. Собирай 🔑 и не наступай на 🔥.'
  },
  bomber: {
    id: 'bomber', title: 'Бомбовый квартал', emoji: '💣', color: '#ffe9d6',
    tag: 'Аркада', desc: 'Ставь бомбы, взрывай кирпичи и врагов — и найди выход из квартала!',
    features: ['Бомбы', 'Разрушаемые стены', 'Выход'],
    canvasTitle: 'Настройка бомбового квартала', canvasSubtitle: 'Настрой число кирпичей, время и жизни',
    hint: '💡 Стрелки или WASD — движение, Пробел — поставить бомву. Убегай от взрыва!'
  },
  towerdef: {
    id: 'towerdef', title: 'Защита крепости', emoji: '🏹', color: '#e4f0ff',
    tag: 'Стратегия', desc: 'Кликай по полю и строй башни. Останови врагов, пока они не дошли до крепости!',
    features: ['Башни', 'Волны врагов', 'Клик по полю'],
    canvasTitle: 'Настройка защиты', canvasSubtitle: 'Настрой число волн, время и прочность крепости',
    hint: '💡 Просто кликай по полю, чтобы построить башню. Башни стреляют сами.'
  },
  survival: {
    id: 'survival', title: 'Гонка на выживание', emoji: '🏎️', color: '#e6f7ef',
    tag: 'Гонки', desc: 'Лети на машине между камнями и собирай канистры с топливом. Ни одного столкновения!',
    features: ['Препятствия', 'Топливо', 'Реакция'],
    canvasTitle: 'Настройка гонки', canvasSubtitle: 'Настрой число канистр, время и скорость',
    hint: '💡 Стрелки или WASD — движение. Собирай ⛽ и объезжай 🪨.'
  },
  airfight: {
    id: 'airfight', title: 'Воздушный бой', emoji: '✈️', color: '#e2ecff',
    tag: 'Шутер', desc: 'Веди самолёт и сбивай вражеские борта. За каждый сбитый — монетки!',
    features: ['Стрельба', 'Вражеские самолёты', 'Монетки'],
    canvasTitle: 'Настройка воздушного боя', canvasSubtitle: 'Настрой число целей, время и скорость',
    hint: '💡 Стрелки или WASD — полёт, Пробел — стрельба. Сбивай ✈️ и собирай 🪙.'
  },
  hockey: {
    id: 'hockey', title: 'Аркадный хоккей', emoji: '🏒', color: '#e7f4ff',
    tag: 'Спорт', desc: 'Отбивай шайбу и забивай голы компьютерному вратарю. Кто быстрее наберёт нужное число?!',
    features: ['Шайба', 'Вратарь-компьютер', 'Счёт'],
    canvasTitle: 'Настройка хоккея', canvasSubtitle: 'Настрой число голов, время и скорости',
    hint: '💡 ↑ ↓ или W S — двигать клюшку. Отбивай шайбу в ворота справа.'
  },
  fisher: {
    id: 'fisher', title: 'Ловля рыбы', emoji: '🎣', color: '#e2f6fb',
    tag: 'Аркада', desc: 'Опускай крючок и лови рыбу. Но берегись:bomb — они отнимают жизни!',
    features: ['Крючок', 'Рыбы', 'Ловушки'],
    canvasTitle: 'Настройка рыбалки', canvasSubtitle: 'Настрой улов, время и число жизней',
    hint: '💡 ← → или A D — двигать удочку, Пробел — опустить крючок. Лови 🐟, избегай 💣.'
  },
  gardener: {
    id: 'gardener', title: 'Волшебный сад', emoji: '🌻', color: '#e9f8e5',
    tag: 'Симулятор', desc: 'Сажай семечки, поливай их и собирай урожай. Успевай удалять сорняки!',
    features: ['Грядки', 'Рост растений', 'Сорняки'],
    canvasTitle: 'Настройка сада', canvasSubtitle: 'Настрой число растений, время и жизни',
    hint: '💡 Кликай по грядке: посадить → полить → собрать. Сорняки тоже можно убрать кликом.'
  },
  station: {
    id: 'station', title: 'Космическая станция', emoji: '🛰️', color: '#e6e8ff',
    tag: 'Экшен', desc: 'Кислород заканчивается! Собирай энергии и чини течи, чтобы выжить.',
    features: ['Кислород', 'Течи', 'Починка'],
    canvasTitle: 'Настройка станции', canvasSubtitle: 'Настрой число модулей, время и жизни',
    hint: '💡 Кликай по 🔋, чтобы собрать энергию, и по 💨, чтобы заделать течь.'
  },
  royale: {
    id: 'royale', title: 'Королевская битва', emoji: '👑', color: '#f5e8ff',
    tag: 'Баттл', desc: 'Стреляй по соперникам и оставайся в безопасной зоне, пока она не станет крошечной!',
    features: ['Безопасная зона', 'Боты', 'Последний герой'],
    canvasTitle: 'Настройка битвы', canvasSubtitle: 'Настрой число соперников, время и жизни',
    hint: '💡 Стрелки или WASD — движение, Пробел — стрельба по ближайшему сопернику. Не выходи из круга!'
  }

};

const TIPS = {
  platformer: [
    'Сначала поставь 🚩 старт, затем добавь ⭐ звёзды.',
    'Платформы должны быть под звёздами, иначе герой не достанет их.',
    'Проверь игру кнопкой «Играть» — так сразу видно, что нужно исправить.'
  ],
  runnerhuman: [
    'Размести 🚩 старт, потом строй лестницу из платформ с шагами не выше 3 клеток.',
    '↔️ ездит влево-вправо, ↕️ — вверх-вниз: ставь их там, где нужен переход.',
    '📍 контрольная точка возвращает героя к месту после гибели. Не забудь 🏁 финиш!',
    'Стреляй огненными шарами кнопкой J / F или 🔥 на телефоне — так легче справиться с 👾.'
  ],
  collector: [
    'Закрась крайние клетки стенами, чтобы герой не убежал.',
    'Оставь проходы шириной хотя бы 2 клетки — так играть интереснее.',
    'Монстры движутся сами. Сделай им объезд, чтобы было веселее.'
  ],
  racer: [
    'Трудная сложность = больше машин и выше скорость.',
    'Кнопка «Звук» включает весёлые сигналы.',
    'Попробуй побить свой рекорд — просто нажми «Играть снова».'
  ],
  quiz: [
    'Пиши короткие и понятные вопросы.',
    'Все 4 варианта должны быть правдоподобными — так интереснее.',
    'Кружком рядом с ответом отмечай правильный вариант.'
  ],
  catcher: [
    'Ставь корзину под яблоками — так очков будет больше.',
    'Бомбы отнимают одну жизнь. Старайся их объезжать.',
    'Со временем предметы падают быстрее — это и есть интерес!'
  ],
  snake: [
    'Сначала потренируйся на лёгкой скорости — так легче не врезаться.',
    'Змейка становится длиннее с каждым яблоком. Думай на ход вперёд!',
    'Кнопка «Играть снова» появится после проигрыша — попробуй побить рекорд.'
  ],
  pong: [
    'Следи за мячом глазами, а не за ракеткой соперника.',
    'На трудной сложности компьютер почти не ошибается — это вызов!',
    'Чем больше очков до победы, тем длиннее матч.'
  ],
  arkanoid: [
    'Старайся отбивать шарик краем платформы — так траектория интереснее.',
    'Нижние кирпичи разбивать удобнее, когда шарик идёт наискосок.',
    'Не теряй жизни: шарик можно подловить в самый последний момент.'
  ],
  shooter: [
    'Стреляй короткими очередями — так точнее.',
    'Собирай звёзды: они дают много очков.',
    'На трудной сложности пришельцы летят быстрее — будь внимателен!'
  ],
  tictactoe: [
    'Захвати центр — оттуда удобнее сделать три в ряд.',
    'Блокируй соперника, если у него уже два знака в ряд.',
    'На лёгкой сложности компьютер иногда ошибается — это шанс победить!'
  ],
  memory: [
    'Запоминай не только картинку, но и место, где она была.',
    'Начинай с 6 пар, а потом попробуй 10 — станет сложнее.',
    'Меньше ходов — лучше результат. Постарайся побить свой рекорд!'
  ],
  math: [
    'Сначала считай в уме, потом выбирай ответ — так быстрее.',
    'На трудной сложности примеры сложнее, но и очков больше.',
    'Ошибка отнимает жизнь, поэтому не торопись без нужды.'
  ],
  starraid: [
    'Держи корабль ближе к центру — так быстрее доберёшься до всех врагов.',
    'Стреляй длинной очередью, но не забывай уворачиваться.',
    'Каждый сбитый враг даёт 10 очков — набери свою цель!'
  ],
  tank: [
    'Главное — беречь базу 🦅 внизу поля: враги стреляют по ней.',
    'Кирпичные стены можно пробить, а стальные — нет. Пробивай проходы сам.',
    'Стреляй первым: пока враг едет к базе, его уже можно подбить.'
  ],
  range: [
    'Целься в центр мишени — так попасть легче.',
    'Промах отнимает очко, поэтому не трать клики зря.',
    'Короткое время делает игру сложнее — попробуй и его!'
  ],
  whack: [
    'Смотри сразу на все норки — крот появляется в случайной.',
    'Не бей по пустой норке: это считается промахом.',
    'Лёгкая сложность даёт больше времени на удар.'
  ],
  runner: [
    'Прыгай заранее, а не в самый последний момент.',
    'Монетки дают очки, но ради них можно и споткнуться.',
    'Чем больше дистанция, тем дольше бег — тренируйся!'
  ],
  reaction: [
    'Не нажимай раньше времени — это считается ошибкой.',
    'Смотри на всю площадь поля: кнопка появляется в разных местах.',
    'Чем быстрее нажатие, тем больше очков.'
  ],
  defense: [
    'Ставь башни рядом с дорогой — так они дольше стреляют по врагам.',
    'Не строй башни на самой дороге.',
    'Накапливай монеты: позже можно поставить больше башен.'
  ],
  farm: [
    'Поливай грядки сразу после посадки.',
    'Спелый урожай не ждёт — собирай его вовремя.',
    'Вода восстанавливается сама, просто подожди немного.'
  ],
  duel: [
    'Если соперник часто атакует — ставь защиту.',
    'Лечение помогает, когда здоровья осталось мало.',
    'Атака — самый верный способ победить, но не забывай о защите.'
  ],
  brawl: [
    'Блок помогает уменьшить урон от удара.',
    'Подходи к сопернику вплотную перед ударом.',
    'Не стой в углу — там удобно зажать тебя.'
  ],
  zombie: [
    'Стреляй по ближайшим зомби — они опаснее всего.',
    'Двигайся постоянно, чтобы зомби не окружили тебя.',
    'На трудной сложности зомби появляются чаще.'
  ],
  rescue: [
    'Сначала спасай друзей, которые ближе к опасности.',
    'Огонь отнимает жизнь — обходи его сторонкой.',
    'Спасённый друг даёт много очков!'
  ],
  mazelava: [
    'Ключи лежат в свободных проходах — обходи стены, а не проламывай их.',
    'Лава отнимает жизнь. Обходи её по краю или беги быстрее.',
    'Собранный 🔑 даёт 2 коина, а победа — ещё 10.'
  ],
  bomber: [
    'Ставь бомбу рядом с кирпичом и сразу отбегай на две клетки.',
    'Взрыв срабатывает через полторы секунды — успей скрыться!',
    'Когда разрушишь нужное число кирпичей, беги к 🚪.'
  ],
  towerdef: [
    'Ставь башни рядом с дорогой врагов — так они стреляют чаще.',
    'Всего можно построить 6 башен. Выбирай места для перекрёстков!',
    'Каждый подбитый враг приносит 1 монетку.'
  ],
  survival: [
    'Держись середины — там больше места для маневра.',
    'Канистра ⛽ даёт 2 коина и засчитывается в цель.',
    'На трудной сложности камни летят быстрее.'
  ],
  airfight: [
    'Стреляй очередями: нажми и удерживай Пробел.',
    'Сбитый самолёт даёт 2 коина, случайная монетка — ещё 2.',
    'Не подпускай врагов вниз — пропущенный отнимает жизнь.'
  ],
  hockey: [
    'Бей по шайбе краем клюшки — так она летит сильнее.',
    'Гол даёт 3 коина и новую шайбу.',
    'Вратарь следит за шайбой, но иногда ошибается — используй это!'
  ],
  fisher: [
    'Наводи удочку на рыбу и жми Пробел — крючок опустится сам.',
    'Рыба даёт 2 коина, а бомба отнимает жизнь.',
    'Пойманную рыбу заменяет новая — лови сколько угодно!'
  ],
  gardener: [
    'Клик по пустой грядке — посадить, ещё клик — полить.',
    'Через несколько секунд появится 🌻 — кликни, чтобы собрать.',
    'Сорняки растут сами. Убирай их кликом, пока не отняли жизнь.'
  ],
  station: [
    'Кислород тает на глазах — успевай кликать по 🔋.',
    'Течи 💨 тоже важно чинить: если лопнет, станция потеряет жизнь.',
    'Каждая собранная энергия даёт 2 коина.'
  ],
  royale: [
    'Пуля летит в ближайшего бота — просто жми Пробел.',
    'Круг сужается: возвращайся к центру, иначе теряй жизни.',
    'Боты тоже гибнут в лаве за кругом — это твои очки!'
  ]

};

/* Предметы, которые можно расставить на уровне */
const ITEM_EMOJI = {
  star: '⭐', enemy: '👾', coin: '🪙', gem: '💎',
  heart: '❤️', spike: '🔺', tramp: '🌀', finish: '🏁'
};
const ITEMS = {
  wall:   { em: '🧱', label: 'Платформа', desc: 'По этой платформе герой ходит и прыгает.' },
  star:   { em: '⭐', label: 'Звезда', desc: 'Собери все звёзды, чтобы выиграть уровень!' },
  coin:   { em: '🪙', label: 'Монетка', desc: 'Каждая монетка даёт 25 очков.' },
  gem:    { em: '💎', label: 'Кристалл', desc: 'Кристалл даёт целых 100 очков!' },
  heart:  { em: '❤️', label: 'Сердце', desc: 'Добавляет герою одну жизнь.' },
  spike:  { em: '🔺', label: 'Шипы', desc: 'Опасные шипы! Не наступай на них.' },
  tramp:  { em: '🌀', label: 'Трамплин', desc: 'Подбрасывает героя намного выше обычного.' },
  finish: { em: '🏁', label: 'Финиш', desc: 'Дойди до флага — и уровень пройден!' },
  enemy:  { em: '👾', label: 'Враг', desc: 'Опасный монстрик. Не касайся его!' },
  start:  { em: '🚩', label: 'Старт', desc: 'Здесь появляется герой в начале игры.' },
  mover:  { em: '↔️', label: 'Движущаяся платформа', desc: 'Ездит влево-вправо. Герой стоит на ней и едет вместе с ней.' },
  moverv: { em: '↕️', label: 'Подъёмная платформа', desc: 'Ездит вверх-вниз. Помогает добраться до высоких мест.' },
  checkpoint: { em: '📍', label: 'Контрольная точка', desc: 'После гибели герой возрождается здесь, а не в начале.' },
  erase:  { em: '🧽', label: 'Ластик', desc: 'Стирай лишние предметы, чтобы освободить место.' }
};

/* Поведение встроенных предметов и помощники для своих предметов */
const BUILTIN_EFFECT = {
  wall: 'solid', star: 'goal', coin: 'points25', gem: 'points100',
  heart: 'life', spike: 'hurt', tramp: 'tramp', finish: 'finish',
  enemy: 'enemy', start: 'start',
  mover: 'mover', moverv: 'mover', checkpoint: 'checkpoint', erase: 'erase'
};
const PICKUP_EFFECTS = ['points10', 'points25', 'points50', 'points100', 'life', 'hurt', 'tramp', 'finish', 'goal'];
const POINTS = { points10: 10, points25: 25, points50: 50, points100: 100 };
const ITEM_EFFECTS = [
  ['points10', '＋10 очков'], ['points25', '＋25 очков'],
  ['points50', '＋50 очков'], ['points100', '＋100 очков'],
  ['life', '＋1 жизнь'], ['hurt', 'Отнимает жизнь'],
  ['goal', 'Цель — собрать все'], ['finish', 'Финиш — сразу победа'],
  ['tramp', 'Трамплин'], ['decor', 'Просто украшение']
];
function customKind(id) { return 'c:' + id; }
function getItem(p, kind) {
  if (typeof kind === 'string' && kind.indexOf('c:') === 0) {
    const c = ((p && p.customItems) || []).find(x => x.id === kind.slice(2));
    if (!c) return null;
    return {
      em: c.em || '❓', label: c.label || 'Мой предмет',
      desc: (ITEM_EFFECTS.find(e => e[0] === c.effect) || ['', 'Мой предмет'])[1],
      effect: c.effect || 'points25', custom: true, id: c.id
    };
  }
  const base = ITEMS[kind];
  if (!base) return null;
  return { em: base.em, label: base.label, desc: base.desc, effect: BUILTIN_EFFECT[kind] || 'decor', custom: false, id: kind };
}
function isPickupKind(p, kind) {
  const def = getItem(p, kind);
  return !!def && PICKUP_EFFECTS.indexOf(def.effect) !== -1;
}

function emptyGrid() { return Array.from({ length: ROWS }, () => Array(COLS).fill('')); }

function defaultPlatformerLevel() {
  const grid = emptyGrid();
  for (let x = 0; x < COLS; x++) grid[12][x] = 'wall';
  const seg = (a, b, y) => { for (let x = a; x <= b; x++) grid[y][x] = 'wall'; };
  seg(7, 10, 9); seg(14, 17, 8); seg(20, 22, 10);
  [[8, 7], [15, 6], [21, 8], [5, 10], [18, 7]].forEach(([x, y]) => { grid[y][x] = 'star'; });
  [[9, 8], [16, 7], [21, 9]].forEach(([x, y]) => { grid[y][x] = 'coin'; });
  grid[9][22] = 'gem';
  grid[10][10] = 'heart';
  grid[11][18] = 'spike';
  grid[11][4] = 'tramp';
  grid[11][24] = 'finish';
  [[12, 11], [23, 11]].forEach(([x, y]) => { grid[y][x] = 'enemy'; });
  return { grid, start: { cx: 2, cy: 11 } };
}
function defaultRunnerHumanLevel() {
  const grid = emptyGrid();
  const seg = (a, b, y) => { for (let x = a; x <= b; x++) grid[y][x] = 'wall'; };
  // Земля с разрывами — настоящая полоса препятствий
  seg(0, 7, 12); seg(11, 15, 12); seg(19, 24, 12);
  // Основной маршрут вверх
  seg(6, 9, 10); seg(9, 12, 8); seg(13, 16, 7);
  seg(17, 20, 6); seg(20, 23, 5); seg(22, 24, 4);
  // Дополнительные ветки с наградами
  seg(2, 4, 10); seg(2, 4, 8); seg(15, 17, 4); seg(5, 7, 6);
  // Движущиеся платформы как в Roblox Studio
  grid[11][9] = 'mover'; grid[10][18] = 'moverv'; grid[8][19] = 'mover';
  // Контрольные точки
  grid[11][12] = 'checkpoint'; grid[6][14] = 'checkpoint'; grid[3][22] = 'checkpoint';
  // Награды и опасности
  [[7, 9], [10, 7], [15, 6], [18, 5], [21, 4], [3, 9], [6, 5]]
    .forEach(([x, y]) => { grid[y][x] = 'coin'; });
  grid[3][16] = 'gem';
  grid[11][13] = 'heart';
  grid[11][3] = 'tramp';
  grid[11][5] = 'spike'; grid[11][14] = 'spike'; grid[9][8] = 'spike';
  [[6, 11], [13, 11], [21, 11]].forEach(([x, y]) => { grid[y][x] = 'enemy'; });
  grid[3][23] = 'finish';
  return { grid, start: { cx: 2, cy: 11 } };
}
function defaultLevelFor(templateId) {
  return templateId === 'platformer' ? defaultPlatformerLevel()
    : templateId === 'runnerhuman' ? defaultRunnerHumanLevel()
    : defaultCollectorLevel();
}
function defaultCollectorLevel() {
  const grid = emptyGrid();
  for (let x = 0; x < COLS; x++) { grid[0][x] = 'wall'; grid[ROWS - 1][x] = 'wall'; }
  for (let y = 0; y < ROWS; y++) { grid[y][0] = 'wall'; grid[y][COLS - 1] = 'wall'; }
  [[6, 3], [7, 3], [8, 3], [6, 4], [6, 5], [15, 2], [15, 3], [15, 4],
   [11, 8], [12, 8], [13, 8], [19, 9], [20, 9], [4, 10], [5, 10]]
    .forEach(([x, y]) => { grid[y][x] = 'wall'; });
  [[3, 3], [10, 2], [18, 4], [22, 7], [9, 11], [17, 11], [3, 8]]
    .forEach(([x, y]) => { grid[y][x] = 'star'; });
  [[5, 5], [14, 6], [20, 3]].forEach(([x, y]) => { grid[y][x] = 'coin'; });
  grid[10][21] = 'gem';
  grid[4][4] = 'heart';
  [[10, 10], [16, 6]].forEach(([x, y]) => { grid[y][x] = 'spike'; });
  grid[2][22] = 'finish';
  [[12, 5], [20, 11], [7, 7]].forEach(([x, y]) => { grid[y][x] = 'enemy'; });
  return { grid, start: { cx: 2, cy: 2 } };
}
function defaultQuestions() {
  return [
    { text: 'Сколько планет в Солнечной системе?', answers: ['7', '8', '9', '10'], correct: 1 },
    { text: 'Как называется наша галактика?', answers: ['Млечный Путь', 'Андромеда', 'Треугольник', 'Орион'], correct: 0 },
    { text: 'Какое животное умеет менять цвет?', answers: ['Лев', 'Хамелеон', 'Слон', 'Пингвин'], correct: 1 },
    { text: 'Сколько цветов в радуге?', answers: ['5', '6', '7', '8'], correct: 2 },
    { text: 'Что вырастает из желудя?', answers: ['Яблоня', 'Дуб', 'Берёза', 'Сосна'], correct: 1 },
    { text: 'Чему равно 7 × 8?', answers: ['48', '54', '56', '64'], correct: 2 },
    { text: 'Какой океан самый большой?', answers: ['Атлантический', 'Тихий', 'Индийский', 'Северный Ледовитый'], correct: 1 },
    { text: 'Сколько минут в трёх часах?', answers: ['120', '150', '180', '240'], correct: 2 }
  ];
}

function createProject(templateId) {
  const t = TEMPLATES[templateId];
  const p = {
    id: uid(),
    template: templateId,
    name: t.title + ' — моя игра',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    settings: {
      bg: templateId === 'collector' ? '#1d3b2a' : '#20234a',
      accent: '#ffd166',
      hero: '🚀',
      difficulty: 'normal',
      speed: 1,
      lives: 2,
      sound: true,
      road: '#3b3f52',
      car: '🚗',
      basket: '🧺',
      traffic: 1,
      voice: false,
      narrate: true
    }
  };
  p.coins = 0;
  p.firstWin = false;
  p.purchases = {};
  p.missions = {};
  const extras = {
    runnerhuman: { hero: '🧑' },
    snake:     { snakeColor: '#38c172', food: '🍎' },
    pong:      { paddle: '#5ac8fa', target: 7 },
    arkanoid:  { rows: 5, paddleColor: '#ffd166' },
    shooter:   { ship: '🚀', fireRate: 1 },
    tank:      { layout: 1, lives: 3 },
    tictactoe: { smart: 'hard', first: false, mark: '❌' },
    memory:    { pairs: 10, deck: 'animals' },
    mazelava:  { target: 6, seconds: 60, hero: '🔦' },
    bomber:    { target: 8, seconds: 75, hero: '🧑' },
    towerdef:  { target: 8, seconds: 90, hero: '🏹' },
    survival:  { target: 6, seconds: 60, hero: '🏎️' },
    airfight:  { target: 8, seconds: 60, hero: '✈️' },
    hockey:    { target: 5, seconds: 90, hero: '🏒' },
    fisher:    { target: 8, seconds: 60, hero: '🎣' },
    gardener:  { target: 6, seconds: 90, hero: '🌱' },
    station:   { target: 6, seconds: 75, hero: '👨‍🚀' },
    royale:    { target: 6, seconds: 75, hero: '🧑' },
    math:      { ops: ['+', '-'], count: 12, seconds: 10 }
  };
  if (extras[templateId]) Object.assign(p.settings, extras[templateId]);
  if (GENRE_IDS.includes(templateId)) {
    Object.assign(p.settings, { speed: 1, lives: 2, count: 10, seconds: 60, target: 10, hero: '🚀' });
    if (extras[templateId]) Object.assign(p.settings, extras[templateId]);
  }
  if (templateId === 'platformer') p.level = defaultPlatformerLevel();
  if (templateId === 'runnerhuman') p.level = defaultRunnerHumanLevel();
  if (templateId === 'collector') p.level = defaultCollectorLevel();
  if (templateId === 'quiz') p.questions = defaultQuestions();
  return p;
}

/* ---------- Хранилище ---------- */
function loadProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(x => x && TEMPLATES[x.template]) : [];
  } catch (e) { return []; }
}
function loadPublished() {
  try {
    const raw = localStorage.getItem(PUB_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(x => x && TEMPLATES[x.template]) : [];
  } catch (e) { return []; }
}
function publishProject() {
  if (!state.project) { showToast('Сначала открой игру', 'warn'); return; }
  saveProject(true);
  const list = loadPublished();
  const copy = JSON.parse(JSON.stringify(state.project));
  copy.publishedAt = Date.now();
  const i = list.findIndex(x => x.id === copy.id);
  if (i >= 0) list[i] = copy; else list.unshift(copy);
  try {
    localStorage.setItem(PUB_KEY, JSON.stringify(list));
  } catch (e) { showToast('Не получилось опубликовать 😕', 'warn'); return; }
  renderPublished();
  showToast('Игра появилась в галерее! 🌟', 'ok');
}
function saveProject(silent = false) {
  if (!state.project) return;
  state.project.updatedAt = Date.now();
  const list = loadProjects();
  const copy = JSON.parse(JSON.stringify(state.project));
  const i = list.findIndex(x => x.id === copy.id);
  if (i >= 0) list[i] = copy; else list.unshift(copy);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    showToast('Не получилось сохранить в браузере 😕', 'warn');
    return;
  }
  state.dirty = false;
  $('#saveStatus').textContent = '● Всё сохранено';
  $('#saveStatus').classList.remove('dirty');
  if (!silent) showToast('Игра сохранена! 💾', 'ok');
  if (state.screen === 'gallery') { renderSaved(); updateCoinChip(); }
}
function markDirty() {
  state.dirty = true;
  $('#saveStatus').textContent = '● Есть изменения…';
  $('#saveStatus').classList.add('dirty');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveProject(true), 1000);
}

/* ---------- Коины и магазин ---------- */
function normalizeProgress(p) {
  if (!p) return;
  if (p.template === 'tank' && p.settings) {
    p.settings.lives = Math.max(3, Number(p.settings.lives) || 3);
    p.settings.count = Math.max(20, Number(p.settings.count) || 20);
  }
  p.coins = Math.max(0, Math.floor(Number(p.coins) || 0));
  p.firstWin = !!p.firstWin;
  p.purchases = (p.purchases && typeof p.purchases === 'object') ? p.purchases : {};
  p.missions = (p.missions && typeof p.missions === 'object') ? p.missions : {};
}
function getCoins(p = state.project) { return p ? Math.max(0, Math.floor(Number(p.coins) || 0)) : 0; }
function getTotalCoins() {
  return loadProjects().reduce((sum, p) => sum + getCoins(p), 0);
}
function updateCoinChip() {
  const el = $('#coinChip');
  if (!el) return;
  if (state.project) {
    el.textContent = '🪙 ' + getCoins();
    el.title = 'Коины в открытой игре';
  } else {
    el.textContent = '🪙 ' + getTotalCoins();
    el.title = 'Всего коинов во всех сохранённых играх';
  }
}
function addCoins(n, reason) {
  const p = state.project;
  if (!p || !n) return;
  normalizeProgress(p);
  p.coins = getCoins(p) + Math.max(0, Math.floor(n));
  updateCoinChip();
  if (reason) showToast(`🪙 +${n} — ${reason}`, 'ok');
  markDirty();
}
function spendCoins(n) {
  const p = state.project;
  if (!p || getCoins(p) < n) return false;
  p.coins = getCoins(p) - n;
  updateCoinChip();
  markDirty();
  return true;
}
function openShop() {
  const p = state.project;
  if (!p) return;
  normalizeProgress(p);
  const coins = getCoins(p);
  const mini = typeof MINI_IDS !== 'undefined' && MINI_IDS.includes(p.template);
  const items = SHOP_ITEMS.filter(it => !it.miniOnly || mini);
  openModal(`
    <h3>🛒 Магазин предметов</h3>
    <p class="modal-sub">Коины даются за 🪙 и 💎, а также за победы. Каждый предмет стоит ${COIN_PRICE} 🪙. Покупка действует в этой игре.</p>
    <div class="coin-balance">🪙 <b>${coins}</b> коинов</div>
    <div class="shop-grid">${items.map(it => `
      <button class="shop-item ${coins < COIN_PRICE ? 'poor' : ''}" data-buy="${it.id}" ${coins < COIN_PRICE ? 'disabled' : ''}>
        <span class="shop-emoji">${it.em}</span>
        <b>${it.title}</b>
        <small>${it.desc}</small>
        <span class="shop-price">${COIN_PRICE} 🪙</span>
      </button>`).join('')}</div>
    <div class="modal-actions"><button class="btn btn-primary" data-modal="close">Вернуться в игру 🎮</button></div>`);
}

/* ---------- Движки игр ---------- */
class BaseEngine {
  constructor(p) { this.p = p; this.onFinish = () => {}; }
  reset() {}
  setPlaying(on) {}
  update(dt) {}
  draw(ctx) {}
  getHud() { return ''; }
  buy(id) {
    if (id === 'heart') {
      if (typeof this.hearts === 'number') this.hearts++;
      else if (typeof this.lives === 'number') this.lives++;
      else if (this.p && this.p.settings) this.p.settings.lives = (this.p.settings.lives || 2) + 1;
    } else if (id === 'score') {
      this.score = (this.score || 0) + 100;
    } else if (id === 'clock') {
      for (const field of ['timeLeft', 'limit', 'remaining', 'qLeft']) {
        if (typeof this[field] === 'number') this[field] += 10;
      }
      if (this.data && typeof this.data.oxygen === 'number') this.data.oxygen += 10;
    } else if (id === 'bomb') {
      for (const field of ['enemies', 'foes', 'targets', 'mobs', 'zombies']) {
        if (Array.isArray(this[field])) this[field].forEach(e => { e.dead = true; });
      }
      if (Array.isArray(this.ents)) {
        this.ents.forEach(e => { if (e.kind === 'enemy' || e.kind === 'bot' || e.kind === 'bombfish') e.dead = true; });
      }
    } else if (id === 'shield') {
      this.shield = 8;
    } else if (id === 'magnet') {
      this.magnet = 10;
    }
    this.wrapEffects();
  }
  wrapEffects() {
    if (this._fxWrapped) return;
    this._fxWrapped = true;
    const original = this.update.bind(this);
    this.update = dt => {
      if (this.shield > 0) {
        this.shield = Math.max(0, this.shield - dt);
        if (typeof this.hurt === 'function' && !this._shieldHurt) {
          const hurt = this.hurt.bind(this);
          this.hurt = (...args) => { if (this.shield > 0) return; return hurt(...args); };
          this._shieldHurt = true;
        }
      }
      if (this.magnet > 0) this.magnet = Math.max(0, this.magnet - dt);
      original(dt);
    };
  }
  destroy() {}
}

class GridEngine extends BaseEngine {
  constructor(p) { super(p); this.reset(); }
  reset() {
    this.grid = this.p.level.grid.map(row => row.slice());
    this.start = { ...this.p.level.start };
    this.taken = new Set();
    this.pickups = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const kind = this.grid[y][x];
        if (kind === 'star' || !isPickupKind(this.p, kind)) continue;
        this.pickups.push({ x, y, kind, eff: getItem(this.p, kind).effect, key: x + ',' + y, got: false });
      }
    }
  }
  take(pickup) {
    if (pickup.got) return false;
    pickup.got = true;
    this.taken.add(pickup.key);
    const gain = { points10: 1, points25: 2, points50: 3, points100: 5, goal: 2, life: 1 }[pickup.eff] || 0;
    if (gain) addCoins(gain);
    return true;
  }
  itemAt(x, y) { return this.pickups.find(it => !it.got && it.x === x && it.y === y); }
  checkGoals(message) {
    const stars = this.stars || [];
    const customGoals = this.pickups.filter(it => it.eff === 'goal');
    if (!stars.length && !customGoals.length) return false;
    if (stars.every(st => st.got) && customGoals.every(it => it.got)) {
      this.finish(true, message || 'Все цели собраны! 🎉');
      return true;
    }
    return false;
  }
  syncProject() {
    this.p.level.grid = this.grid.map(row => row.slice());
    this.p.level.start = { ...this.start };
    markDirty();
  }
  paint(cx, cy, tool) {
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return;
    if (tool === 'start') {
      if (this.start.cx !== cx || this.start.cy !== cy) {
        this.start = { cx, cy };
        this.syncProject();
      }
      return;
    }
    const val = tool === 'erase' ? '' : tool;
    if (this.grid[cy][cx] !== val) {
      this.grid[cy][cx] = val;
      this.syncProject();
    }
  }
  isSolid(cx, cy, allowFall = false) {
    if (cx < 0 || cx >= COLS || cy < 0) return true;
    if (cy >= ROWS) return !allowFall;
    return this.grid[cy][cx] === 'wall';
  }
  resolveAxis(ent, axis, delta, allowFall = false) {
    if (!delta) return;
    ent[axis] += delta;
    const left = Math.floor(ent.x / CELL);
    const right = Math.floor((ent.x + ent.w - 0.001) / CELL);
    const top = Math.floor(ent.y / CELL);
    const bottom = Math.floor((ent.y + ent.h - 0.001) / CELL);
    for (let cy = top; cy <= bottom; cy++) {
      for (let cx = left; cx <= right; cx++) {
        if (!this.isSolid(cx, cy, allowFall)) continue;
        if (axis === 'x') {
          ent.x = delta > 0 ? cx * CELL - ent.w : (cx + 1) * CELL;
          ent.vx = 0;
        } else {
          ent.y = delta > 0 ? cy * CELL - ent.h : (cy + 1) * CELL;
          ent.vy = 0;
          if (delta > 0) ent.onGround = true;
        }
      }
    }
  }
  drawStatic(ctx, showGrid) {
    drawBackdrop(ctx, this.p);

    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 30; i++) {
      const x = (i * 179 + 37) % W, y = (i * 97 + 23) % H;
      ctx.beginPath(); ctx.arc(x, y, i % 3 === 0 ? 1.8 : 1.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = this.grid[y][x];
        if (!v || v === 'mover' || v === 'moverv' || v === 'checkpoint') continue;
        const px = x * CELL, py = y * CELL;
        if (v === 'wall') {
          roundRect(ctx, px + 1, py + 1, CELL - 2, CELL - 2, 7);
          ctx.fillStyle = shade(this.p.settings.bg, 48);
          ctx.fill();
          roundRect(ctx, px + 4, py + 4, CELL - 8, 5, 3);
          ctx.fillStyle = 'rgba(255,255,255,.16)';
          ctx.fill();
        } else {
          const def = getItem(this.p, v);
          if (def && def.em) {
            const hiddenInPlay = v === 'star' || v === 'enemy';
            const takenAway = def.effect !== 'decor' && this.taken.has(x + ',' + y);
            if (showGrid || (!hiddenInPlay && !takenAway)) {
              const size = def.effect === 'finish' ? 28 : (v === 'enemy' ? 25 : 24);
              drawEmoji(ctx, def.em, px + CELL / 2, py + CELL / 2, size);
            }
          }
        }
      }
    }

    if (showGrid) {
      const sx = this.start.cx * CELL + CELL / 2;
      const sy = this.start.cy * CELL + CELL / 2;
      drawEmoji(ctx, '🚩', sx - 12, sy, 18);
      drawEmoji(ctx, this.p.settings.hero, sx + 8, sy, 25);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.09)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath(); ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, H); ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(W, y * CELL + 0.5); ctx.stroke();
      }
      ctx.restore();
    }
  }
}

class PlatformerEngine extends GridEngine {
  constructor(p) { super(p); }
  reset() {
    super.reset();
    this.hero = {
      x: this.start.cx * CELL + 3, y: this.start.cy * CELL - 30,
      w: 26, h: 30, vx: 0, vy: 0, onGround: false
    };
    this.stars = []; this.enemies = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.grid[y][x] === 'star') this.stars.push({ x, y, got: false });
        if (this.grid[y][x] === 'enemy') {
          this.enemies.push({ x: x * CELL + 2, y: y * CELL + 4, w: 28, h: 28, vx: (Math.random() < .5 ? -1 : 1) * 92 });
        }
      }
    }
    this.hearts = this.p.settings.lives;
    this.score = 0; this.time = 0; this.invuln = 0; this.finished = false;
  }
  update(dt) {
    if (this.finished) return;
    const s = this.p.settings, diff = DIFF[s.difficulty] || DIFF.normal;
    const spd = 225 * s.speed * diff.speed;
    const h = this.hero;

    if (keys.ArrowLeft || keys.KeyA) h.vx = -spd;
    else if (keys.ArrowRight || keys.KeyD) h.vx = spd;
    else h.vx = 0;

    if ((pressed.Space || pressed.ArrowUp || pressed.KeyW) && h.onGround) {
      h.vy = -600;
      h.onGround = false;
      beep(680, .07);
    }
    h.vy = Math.min(h.vy + 1650 * dt, 900);
    h.onGround = false;
    this.resolveAxis(h, 'x', h.vx * dt, true);
    this.resolveAxis(h, 'y', h.vy * dt, true);
    if (h.x < 0) h.x = 0;
    if (h.x + h.w > W) h.x = W - h.w;

    for (const e of this.enemies) {
      const step = e.vx * dt * s.speed * diff.speed;
      const ahead = Math.floor((e.x + (step > 0 ? e.w + 2 : -2)) / CELL);
      const ownRow = Math.floor((e.y + e.h / 2) / CELL);
      const below = Math.floor((e.y + e.h + 4) / CELL);
      const noFloor = below >= ROWS || this.grid[below][ahead] !== 'wall';
      if (noFloor || this.isSolid(ahead, ownRow, false) || e.x + step < 0 || e.x + step + e.w > W) e.vx *= -1;
      e.x += e.vx * dt * s.speed * diff.speed;
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.time += dt;

    for (const st of this.stars) {
      if (st.got) continue;
      const sx = st.x * CELL + CELL / 2, sy = st.y * CELL + CELL / 2;
      if (Math.abs(h.x + h.w / 2 - sx) < 21 && Math.abs(h.y + h.h / 2 - sy) < 23) {
        st.got = true; this.score += 10; beep(880, .09);
      }
    }
    for (const it of this.pickups) {
      if (it.got) continue;
      const ix = it.x * CELL + CELL / 2, iy = it.y * CELL + CELL / 2;
      if (Math.abs(h.x + h.w / 2 - ix) > 22 || Math.abs(h.y + h.h / 2 - iy) > 24) continue;
      const eff = it.eff;
      if (eff === 'hurt') {
        if (this.invuln <= 0) { this.take(it); this.hurt(); }
        continue;
      }
      if (eff === 'finish') {
        this.finish(true, `Ты дошёл до финиша за ${Math.floor(this.time)} секунд!`);
        return;
      }
      this.take(it);
      if (POINTS[eff]) { this.score += POINTS[eff]; beep(980, .08); }
      else if (eff === 'life') { this.hearts++; beep(760, .14); showToast('❤️ +1 жизнь!', 'ok'); }
      else if (eff === 'tramp') { h.vy = -820; h.onGround = false; beep(520, .12); }
      else if (eff === 'goal') { beep(880, .09); }
    }
    if (this.checkGoals(`Все цели собраны! Ты молодец! ⏱ ${Math.floor(this.time)} с.`)) return;
    if (this.invuln <= 0) {
      for (const e of this.enemies) {
        if (aabb(h, e)) { this.hurt(); break; }
      }
    }
    if (h.y > H + 10) this.hurt();
  }
  hurt() {
    this.hearts--;
    this.invuln = 0.9;
    beep(220, .16);
    if (this.hearts <= 0) {
      this.finish(false, 'У героя закончились жизни. Но ты почти справился(ась)!');
      return;
    }
    this.hero.x = this.start.cx * CELL + 3;
    this.hero.y = this.start.cy * CELL - 30;
    this.hero.vx = this.hero.vy = 0;
  }
  finish(win, msg) { this.finished = true; this.onFinish(win, msg); }
  draw(ctx) {
    this.drawStatic(ctx, state.mode === 'edit');
    if (state.mode !== 'play') return;
    for (const st of this.stars) {
      if (!st.got) drawEmoji(ctx, '⭐', st.x * CELL + CELL / 2, st.y * CELL + CELL / 2, 24);
    }
    for (const e of this.enemies) drawEmoji(ctx, '👾', e.x + e.w / 2, e.y + e.h / 2, 27);
    if (this.invuln <= 0 || Math.floor(this.time * 12) % 2 === 0) {
      drawEmoji(ctx, this.p.settings.hero, this.hero.x + this.hero.w / 2, this.hero.y + this.hero.h / 2, 27);
    }
  }
  getHud() {
    return `<span class="hud-pill">♥ ${'♥'.repeat(Math.max(0, this.hearts))}</span>` +
           `<span class="hud-pill">⭐ ${this.score}</span>` +
           `<span class="hud-pill">⏱ ${Math.floor(this.time)} с</span>`;
  }
}

/* «Бегущий человек» — обби-платформер с огненными шарами */
class RunnerHumanEngine extends GridEngine {
  constructor(p) { super(p); }
  reset() {
    super.reset();
    this.hero = { x: this.start.cx * CELL + 3, y: this.start.cy * CELL - 30,
      w: 26, h: 30, vx: 0, vy: 0, onGround: false, facing: 1 };
    this.enemies = []; this.movers = []; this.checkpoints = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const kind = this.grid[y][x];
        if (kind === 'enemy') {
          this.enemies.push({ x: x * CELL + 2, y: y * CELL + 4, w: 28, h: 28,
            vx: (Math.random() < .5 ? -1 : 1) * 92, dead: false });
        } else if (kind === 'mover' || kind === 'moverv') {
          this.movers.push({ baseX: x * CELL, baseY: y * CELL + 18,
            x: x * CELL, y: y * CELL + 18, w: CELL, h: 14, dx: 0,
            axis: kind === 'moverv' ? 'y' : 'x', phase: (x + y) * 0.7 });
        } else if (kind === 'checkpoint') {
          this.checkpoints.push({ x, y, got: false });
        }
      }
    }
    this.checkpoint = null;
    this.fireballs = []; this.fireCd = 0;
    this.hearts = this.p.settings.lives;
    this.score = 0; this.time = 0; this.invuln = 0; this.finished = false;
  }
  update(dt) {
    if (this.finished) return;
    const s = this.p.settings, diff = diffOf(this.p), h = this.hero;
    const spd = 225 * s.speed * diff.speed;

    if (keys.ArrowLeft || keys.KeyA) { h.vx = -spd; h.facing = -1; }
    else if (keys.ArrowRight || keys.KeyD) { h.vx = spd; h.facing = 1; }
    else h.vx = 0;
    if ((pressed.Space || pressed.ArrowUp || pressed.KeyW) && h.onGround) {
      h.vy = -600; h.onGround = false; beep(680, .07);
    }
    h.vy = Math.min(h.vy + 1650 * dt, 900);
    const prevBottom = h.y + h.h;
    h.onGround = false;
    this.resolveAxis(h, 'x', h.vx * dt, true);
    this.resolveAxis(h, 'y', h.vy * dt, true);

    for (const m of this.movers) {
      const off = Math.sin(this.time * 1.15 * diff.speed + m.phase) * (m.axis === 'x' ? 72 : 56);
      const nx = m.axis === 'x' ? m.baseX + off : m.baseX;
      const ny = m.axis === 'y' ? m.baseY + off : m.baseY;
      m.dx = nx - m.x; m.x = nx; m.y = ny;
      const overlapX = h.x + h.w > m.x + 2 && h.x < m.x + m.w - 2;
      if (overlapX && h.vy >= 0 && prevBottom <= m.y + 10 && h.y + h.h >= m.y) {
        h.y = m.y - h.h; h.vy = 0; h.onGround = true;
        h.x = clamp(h.x + m.dx, 0, W - h.w);
      }
    }

    this.fireCd = Math.max(0, this.fireCd - dt);
    if ((keys.KeyJ || keys.KeyF || keys.KeyK) && this.fireCd <= 0 && this.fireballs.length < 5) {
      this.fireballs.push({ x: h.x + h.w / 2 + h.facing * 13, y: h.y + 13,
        vx: h.facing * 360 * s.speed, vy: -130, life: 2.2, bounce: 0 });
      this.fireCd = 0.3 / diff.speed;
      beep(940, .06); FX.burst(h.x + h.w / 2, h.y + 13, '#ff9f43', 4);
    }
    for (const b of this.fireballs) {
      b.life -= dt;
      b.vy = Math.min(b.vy + 700 * dt, 520);
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.vy > 0 && this.isSolid(Math.floor(b.x / CELL), Math.floor((b.y + 8) / CELL), false)) {
        b.y = Math.floor((b.y + 8) / CELL) * CELL - 8; b.vy = -260; b.bounce++;
      }
      if (b.bounce > 3) b.life = 0;
      for (const e of this.enemies) {
        if (e.dead || !aabb({ x: b.x - 6, y: b.y - 6, w: 12, h: 12 }, e)) continue;
        e.dead = true; b.life = 0; this.score += 50;
        FX.burst(e.x + e.w / 2, e.y + e.h / 2, '#ff9f43', 12);
        beep(520, .12); showToast('🔥 Враг повержен! +50 очков', 'ok');
      }
    }
    this.fireballs = this.fireballs.filter(b => b.life > 0 && b.x > -20 && b.x < W + 20);

    for (const e of this.enemies) {
      if (e.dead) continue;
      const step = e.vx * dt * s.speed * diff.speed;
      const ahead = Math.floor((e.x + (step > 0 ? e.w + 2 : -2)) / CELL);
      const ownRow = Math.floor((e.y + e.h / 2) / CELL);
      const below = Math.floor((e.y + e.h + 4) / CELL);
      const noFloor = below >= ROWS || this.grid[below][ahead] !== 'wall';
      if (noFloor || this.isSolid(ahead, ownRow, false) || e.x + step < 0 || e.x + step + e.w > W) e.vx *= -1;
      e.x += e.vx * dt * s.speed * diff.speed;
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.time += dt;

    for (const cp of this.checkpoints) {
      if (cp.got) continue;
      if (Math.abs(h.x + h.w / 2 - (cp.x * CELL + CELL / 2)) < 20 &&
          Math.abs(h.y + h.h / 2 - (cp.y * CELL + CELL / 2)) < 24) {
        cp.got = true;
        this.checkpoint = { cx: cp.x, cy: cp.y };
        beep(760, .14);
        FX.burst(cp.x * CELL + CELL / 2, cp.y * CELL + CELL / 2, '#38c172', 8);
        showToast('📍 Контрольная точка сохранена!', 'ok');
      }
    }
    for (const it of this.pickups) {
      if (it.got) continue;
      const ix = it.x * CELL + CELL / 2, iy = it.y * CELL + CELL / 2;
      if (Math.abs(h.x + h.w / 2 - ix) > 22 || Math.abs(h.y + h.h / 2 - iy) > 24) continue;
      const eff = it.eff;
      if (eff === 'hurt') {
        if (this.invuln <= 0) { this.take(it); this.hurt(); }
        continue;
      }
      if (eff === 'finish') {
        this.finish(true, `Ты дошёл до финиша за ${Math.floor(this.time)} секунд!`);
        return;
      }
      this.take(it);
      if (POINTS[eff]) { this.score += POINTS[eff]; beep(980, .08); }
      else if (eff === 'life') { this.hearts++; beep(760, .14); showToast('❤️ +1 жизнь!', 'ok'); }
      else if (eff === 'tramp') { h.vy = -820; h.onGround = false; beep(520, .12); }
      else if (eff === 'goal') { beep(880, .09); }
    }
    if (this.invuln <= 0) {
      for (const e of this.enemies) {
        if (!e.dead && aabb(h, e)) { this.hurt(); break; }
      }
    }
    if (h.y > H + 10) this.hurt();
  }
  hurt() {
    this.hearts--;
    this.invuln = 1;
    beep(220, .16);
    if (this.hearts <= 0) {
      this.finish(false, 'У Бегущего человека закончились жизни. Попробуй ещё раз!');
      return;
    }
    const pt = this.checkpoint || this.start;
    this.hero.x = pt.cx * CELL + 3;
    this.hero.y = pt.cy * CELL - 30;
    this.hero.vx = this.hero.vy = 0;
    showToast(this.checkpoint ? '📍 Возрождение у контрольной точки' : '🚩 Возрождение на старте', 'warn');
  }
  finish(win, msg) { this.finished = true; this.onFinish(win, msg); }
  draw(ctx) {
    this.drawStatic(ctx, state.mode !== 'play');
    for (const m of this.movers) {
      roundRect(ctx, m.x, m.y, m.w, m.h, 6);
      ctx.fillStyle = shade(this.p.settings.accent, -20);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      roundRect(ctx, m.x + 3, m.y + 2, m.w - 6, 3, 2);
      ctx.fill();
      drawEmoji(ctx, m.axis === 'x' ? '↔️' : '↕️', m.x + m.w / 2, m.y + m.h / 2, 14);
    }
    for (const cp of this.checkpoints) {
      const px = cp.x * CELL + CELL / 2, py = cp.y * CELL + CELL / 2;
      if (cp.got) {
        ctx.save(); ctx.strokeStyle = '#38c172'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, 15, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      }
      drawEmoji(ctx, '📍', px, py, cp.got ? 26 : 22);
    }
    if (state.mode !== 'play') return;
    for (const e of this.enemies) {
      if (!e.dead) drawEmoji(ctx, '👾', e.x + e.w / 2, e.y + e.h / 2, 27);
    }
    for (const b of this.fireballs) {
      ctx.save(); ctx.shadowColor = '#ff9f43'; ctx.shadowBlur = 14;
      drawEmoji(ctx, '🔥', b.x, b.y, 21);
      ctx.restore();
    }
    if (this.invuln <= 0 || Math.floor(this.time * 12) % 2 === 0) {
      drawEmoji(ctx, this.p.settings.hero, this.hero.x + this.hero.w / 2, this.hero.y + this.hero.h / 2, 28);
    }
  }
  getHud() {
    return `<span class="hud-pill">♥ ${'♥'.repeat(Math.max(0, this.hearts))}</span>` +
           `<span class="hud-pill">⭐ ${this.score}</span>` +
           `<span class="hud-pill">🔥 ${this.fireballs.length}</span>` +
           `<span class="hud-pill">⏱ ${Math.floor(this.time)} с</span>`;
  }
}

class CollectorEngine extends GridEngine {
  constructor(p) { super(p); }
  reset() {
    super.reset();
    this.hero = { x: this.start.cx * CELL + 3, y: this.start.cy * CELL + 3, w: 26, h: 26, vx: 0, vy: 0 };
    this.stars = []; this.enemies = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.grid[y][x] === 'star') this.stars.push({ x, y, got: false });
        if (this.grid[y][x] === 'enemy') {
          this.enemies.push({
            x: x * CELL + 3, y: y * CELL + 3, w: 26, h: 26,
            dir: Math.floor(Math.random() * 4), timer: rand(0.5, 1.3)
          });
        }
      }
    }
    const diff = DIFF[this.p.settings.difficulty] || DIFF.normal;
    this.hearts = this.p.settings.lives;
    this.score = 0;
    this.timeLeft = diff.time;
    this.invuln = 0;
    this.finished = false;
  }
  update(dt) {
    if (this.finished) return;
    const s = this.p.settings, ed = diffOf(this.p);
    const spd = 205 * s.speed * ed.speed;
    let dx = 0, dy = 0;
    if (keys.ArrowLeft || keys.KeyA) dx = -1;
    if (keys.ArrowRight || keys.KeyD) dx = 1;
    if (keys.ArrowUp || keys.KeyW) dy = -1;
    if (keys.ArrowDown || keys.KeyS) dy = 1;
    if (dx && dy) { dx *= 0.707; dy *= 0.707; }
    this.resolveAxis(this.hero, 'x', dx * spd * dt);
    this.resolveAxis(this.hero, 'y', dy * spd * dt);

    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    for (const e of this.enemies) {
      e.timer -= dt;
      if (e.timer <= 0) { e.dir = Math.floor(Math.random() * 4); e.timer = rand(0.5, 1.2); }
      const [mx, my] = dirs[e.dir];
      const ox = e.x, oy = e.y;
      this.resolveAxis(e, 'x', mx * 88 * ed.speed * s.speed * dt);
      this.resolveAxis(e, 'y', my * 88 * ed.speed * s.speed * dt);
      if (Math.abs(e.x - ox) < 0.01 && Math.abs(e.y - oy) < 0.01) { e.dir = (e.dir + 1) % 4; e.timer = rand(0.3, 0.8); }
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.timeLeft -= dt;

    for (const st of this.stars) {
      if (st.got) continue;
      const sx = st.x * CELL + CELL / 2, sy = st.y * CELL + CELL / 2;
      if (Math.abs(this.hero.x + 13 - sx) < 21 && Math.abs(this.hero.y + 13 - sy) < 21) {
        st.got = true; this.score += 10; beep(880, .09);
      }
    }
    for (const it of this.pickups) {
      if (it.got) continue;
      const ix = it.x * CELL + CELL / 2, iy = it.y * CELL + CELL / 2;
      if (Math.abs(this.hero.x + 13 - ix) > 22 || Math.abs(this.hero.y + 13 - iy) > 22) continue;
      const eff = it.eff;
      if (eff === 'hurt') {
        if (this.invuln <= 0) { this.take(it); this.hurt(); }
        continue;
      }
      if (eff === 'finish') {
        this.finish(true, `Ты нашёл(ла) выход! Осталось ${Math.max(0, Math.ceil(this.timeLeft))} секунд.`);
        return;
      }
      this.take(it);
      if (POINTS[eff]) { this.score += POINTS[eff]; beep(980, .08); }
      else if (eff === 'life') { this.hearts++; beep(760, .14); showToast('❤️ +1 жизнь!', 'ok'); }
      else if (eff === 'goal') { beep(880, .09); }
    }
    if (this.checkGoals(`Все цели собраны! Осталось ${Math.max(0, Math.ceil(this.timeLeft))} секунд.`)) return;
    if (this.invuln <= 0) {
      for (const e of this.enemies) {
        if (aabb(this.hero, e)) { this.hurt(); break; }
      }
    }
    if (this.timeLeft <= 0) this.finish(false, 'Время вышло! Попробуй быстрее 🏃');
  }
  hurt() {
    this.hearts--;
    this.invuln = 0.9;
    beep(220, .16);
    if (this.hearts <= 0) { this.finish(false, 'У героя закончились жизни'); return; }
    this.hero.x = this.start.cx * CELL + 3;
    this.hero.y = this.start.cy * CELL + 3;
  }
  finish(win, msg) { this.finished = true; this.onFinish(win, msg); }
  draw(ctx) {
    this.drawStatic(ctx, state.mode === 'edit');
    if (state.mode !== 'play') return;
    for (const st of this.stars) {
      if (!st.got) drawEmoji(ctx, '⭐', st.x * CELL + CELL / 2, st.y * CELL + CELL / 2, 24);
    }
    for (const e of this.enemies) {
      drawEmoji(ctx, '👾', e.x + e.w / 2, e.y + e.h / 2, 26);
    }
    if (this.invuln <= 0 || Math.floor(this.timeLeft * 12) % 2 === 0) {
      drawEmoji(ctx, this.p.settings.hero, this.hero.x + this.hero.w / 2, this.hero.y + this.hero.h / 2, 26);
    }
  }
  getHud() {
    return `<span class="hud-pill">♥ ${'♥'.repeat(Math.max(0, this.hearts))}</span>` +
           `<span class="hud-pill">⭐ ${this.score}</span>` +
           `<span class="hud-pill">⏱ ${Math.max(0, Math.ceil(this.timeLeft))} с</span>`;
  }
}

class RacerEngine extends BaseEngine {
  constructor(p) { super(p); this.reset(); }
  reset() {
    this.player = { x: W / 2 - 24, y: H - 96, w: 48, h: 76 };
    this.cars = [];
    this.spawnTimer = 0.8;
    this.score = 0;
    this.dist = 0;
    this.hearts = this.p.settings.lives;
    this.finished = false;
    this.invuln = 0;
    this.time = 0;
  }
  spawnCar() {
    const s = this.p.settings;
    const emojiList = ['🚙', '🚕', '🚓', '🚌'];
    const w = 42, h = 70;
    let x = rand(140, W - 140 - w);
    for (const c of this.cars) {
      if (Math.abs(c.x - x) < 60 && Math.abs(c.y) < 130) x = rand(140, W - 140 - w);
    }
    this.cars.push({ x, y: -h - 10, w, h, emoji: emojiList[Math.floor(Math.random() * emojiList.length)] });
  }
  update(dt) {
    if (this.finished) return;
    const s = this.p.settings, diff = DIFF[s.difficulty] || DIFF.normal;
    const steer = 360 * s.speed;
    if (keys.ArrowLeft || keys.KeyA) this.player.x -= steer * dt;
    if (keys.ArrowRight || keys.KeyD) this.player.x += steer * dt;
    this.player.x = clamp(this.player.x, 142, W - 142 - this.player.w);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnCar();
      this.spawnTimer = rand(0.55, 1.05) / (diff.traffic * s.traffic) / s.speed;
    }
    const roadSpeed = (290 + this.dist * 0.48) * s.speed * diff.speed;
    for (const c of this.cars) c.y += roadSpeed * dt;
    this.cars = this.cars.filter(c => c.y < H + 100);
    this.dist += roadSpeed * dt / 10;
    this.score = Math.floor(this.dist);
    this.time += dt;
    this.invuln = Math.max(0, this.invuln - dt);

    if (this.invuln <= 0) {
      for (const c of this.cars) {
        const box = { x: c.x + 6, y: c.y + 6, w: c.w - 12, h: c.h - 12 };
        if (aabb(this.player, box)) {
          this.hearts--;
          this.invuln = 1.0;
          beep(190, .18);
          c.y = H + 200;
          if (this.hearts <= 0) this.finish(false, `Пробег: ${this.score} м. Ещё раз — и получится лучше!`);
          break;
        }
      }
    }
  }
  finish(win, msg) { this.finished = true; this.onFinish(win, msg); }
  draw(ctx) {
    const s = this.p.settings;
    drawBackdrop(ctx, this.p, { top: '#3ba55d', bottom: '#1f6b42', motif: 'road' });
    ctx.fillStyle = shade('#3ba55d', -24);
    for (let y = (this.dist * 3) % 64 - 64; y < H; y += 64) ctx.fillRect(0, y, 60, 32), ctx.fillRect(W - 60, y, 60, 32);

    ctx.fillStyle = s.road;
    ctx.fillRect(120, 0, W - 240, H);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(120, 0, 6, H);
    ctx.fillRect(W - 126, 0, 6, H);
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    const off = (this.dist * 6) % 80;
    for (let y = -80 + off; y < H; y += 80) {
      ctx.fillRect(W / 2 - 4, y, 8, 44);
    }

    if (state.mode === 'edit') {
      ctx.save();
      ctx.globalAlpha = .55;
      drawEmoji(ctx, s.car, W / 2, H - 96, 62);
      ctx.globalAlpha = .35;
      drawEmoji(ctx, '🚙', W / 2 - 120, 150, 56);
      drawEmoji(ctx, '🚕', W / 2 + 120, 270, 56);
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Предпросмотр трассы — нажми «Играть»', W / 2, 42);
      return;
    }

    for (const c of this.cars) drawEmoji(ctx, c.emoji, c.x + c.w / 2, c.y + c.h / 2, 60);
    if (this.invuln <= 0 || Math.floor(this.time * 12) % 2 === 0) {
      drawEmoji(ctx, s.car, this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, 66);
    }
  }
  getHud() {
    return `<span class="hud-pill">♥ ${'♥'.repeat(Math.max(0, this.hearts))}</span>` +
           `<span class="hud-pill">🏁 ${this.score} м</span>` +
           `<span class="hud-pill">${(DIFF[this.p.settings.difficulty] || DIFF.normal).label}</span>`;
  }
}

class QuizEngine extends BaseEngine {
  constructor(p, layer) { super(p); this.layer = layer; this.timer = null; this.timeout = null; this.qTime = 12; this.qLeft = 12; this.questions = []; }
  reset() {
    clearTimeout(this.timer); clearTimeout(this.timeout);
    this.layer.innerHTML = '';
    this.qTime = diffOf(this.p).quizTime; this.qLeft = this.qTime;
    this.index = 0; this.score = 0; this.answered = false; this.finished = false;
    this.questions = this.p.questions.filter(q => q.text.trim() && q.answers.some(a => a.trim()));
  }
  setPlaying(on) {
    this.layer.classList.toggle('active', on);
    if (!on) { clearTimeout(this.timeout); clearTimeout(this.timer); this.timer = null; this.timeout = null; this.layer.innerHTML = ''; return; }
    if (!this.questions.length) {
      this.layer.innerHTML = `<div class="quiz-card">
        <div class="quiz-question">❓ Пока нет вопросов</div>
        <p style="font-size:13px;color:#676a86;margin:0">Добавь хотя бы один вопрос с ответом в панели слева — и викторина заработает.</p>
      </div>`;
      return;
    }
    this.renderQuestion();
  }
  renderQuestion() {
    if (this.index >= this.questions.length) {
      this.finished = true;
      this.onFinish(true, `Правильных ответов: ${this.score / 10} из ${this.questions.length}. Отличная работа!`);
      return;
    }
    const q = this.questions[this.index];
    this.qLeft = this.qTime;
    clearTimeout(this.timeout);
    this.timeout = setTimeout(() => { if (!this.answered && !this.finished) this.choose(-1); }, this.qTime * 1000);
    this.layer.innerHTML = `
      <div class="quiz-card">
        <div class="quiz-top">
          <span>❓ Вопрос ${this.index + 1} из ${this.questions.length}</span>
          <span>⭐ ${this.score} очков</span>
        </div>
        <div class="quiz-question">${esc(q.text)}</div>
        <div class="quiz-answers">
          ${q.answers.map((a, i) => a.trim()
            ? `<button class="quiz-answer" data-qa="${i}"><span class="letter">${'АБВГ'[i] || i + 1}</span>${esc(a)}</button>`
            : '').join('')}
        </div>
        <div class="quiz-feedback" id="quizFeedback"></div>
      </div>`;
  }
  choose(i) {
    if (this.answered || this.finished) return;
    const q = this.questions[this.index];
    clearTimeout(this.timeout);
    const ok = i === q.correct;
    this.answered = true;
    if (ok) { this.score += 10; beep(880, .1); } else beep(210, .16);
    $$('.quiz-answer', this.layer).forEach(b => {
      const idx = +b.dataset.qa;
      b.disabled = true;
      if (idx === q.correct) b.classList.add('right');
      else if (idx === i) b.classList.add('wrong');
    });
    const fb = $('#quizFeedback', this.layer);
    if (fb) fb.textContent = ok ? '✅ Верно! Ты молодец!' : `❌ Правильный ответ: ${q.answers[q.correct] || '—'}`;
    this.timer = setTimeout(() => {
      if (this.finished) return;
      this.index++;
      this.answered = false;
      this.renderQuestion();
    }, 950);
  }
  update(dt) {
    if (this.finished || this.answered || state.mode !== 'play') return;
    this.qLeft = Math.max(0, this.qLeft - dt);
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p, { accent: '#ffd166', motif: 'question' });
    ctx.save();
    ctx.globalAlpha = state.mode === 'edit' ? .18 : .1;
    ctx.font = 'bold 90px "Trebuchet MS", sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    for (let i = 0; i < 12; i++) ctx.fillText('?', 60 + (i * 173) % (W - 120), 80 + (i * 97) % (H - 120));
    ctx.restore();
    if (state.mode === 'edit') {
      ctx.fillStyle = 'rgba(255,255,255,.94)';
      roundRect(ctx, W / 2 - 250, H / 2 - 58, 500, 116, 20); ctx.fill();
      ctx.fillStyle = '#232246';
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px "Trebuchet MS", sans-serif';
      ctx.fillText('🧠 Твоя викторина', W / 2, H / 2 - 12);
      ctx.font = '15px "Trebuchet MS", sans-serif';
      ctx.fillStyle = '#676a86';
      ctx.fillText(`Вопросов: ${this.p.questions.length} · нажми «Играть», чтобы проверить`, W / 2, H / 2 + 24);
    }
  }
  getHud() {
    return `<span class="hud-pill">⭐ ${this.score}</span>` +
           `<span class="hud-pill">Вопрос ${Math.min(this.index + 1, this.questions.length)}/${this.questions.length}</span>` +
           `<span class="hud-pill">⏱ ${Math.ceil(this.qLeft)} с</span>`;
  }
  destroy() { clearTimeout(this.timer); clearTimeout(this.timeout); this.layer.innerHTML = ''; this.layer.classList.remove('active'); }
}

class CatcherEngine extends BaseEngine {
  constructor(p) { super(p); this.reset(); }
  reset() {
    this.player = { x: W / 2 - 36, y: H - 58, w: 72, h: 44 };
    this.items = [];
    this.spawnTimer = 0.5;
    this.score = 0;
    this.time = 0;
    this.hearts = this.p.settings.lives;
    this.finished = false;
  }
  update(dt) {
    if (this.finished) return;
    const s = this.p.settings, diff = DIFF[s.difficulty] || DIFF.normal;
    const move = 370 * s.speed;
    if (keys.ArrowLeft || keys.KeyA) this.player.x -= move * dt;
    if (keys.ArrowRight || keys.KeyD) this.player.x += move * dt;
    this.player.x = clamp(this.player.x, 26, W - 26 - this.player.w);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const r = Math.random();
      const type = r < 0.58 ? 'apple' : (r < 0.86 ? 'bomb' : 'star');
      this.items.push({ x: rand(45, W - 45), y: -34, w: 30, h: 30, type, vy: rand(0, 60) });
      this.spawnTimer = rand(0.42, 0.85) / (diff.traffic * s.traffic);
    }
    const fall = (195 + this.time * 2.4) * s.speed * diff.speed;
    for (const it of this.items) {
      it.y += (fall + it.vy) * dt;
      const box = { x: it.x + 4, y: it.y + 4, w: it.w - 8, h: it.h - 8 };
      if (it.y < H && aabb(box, this.player)) {
        if (it.type === 'bomb') {
          this.hearts--;
          beep(180, .18);
          if (this.hearts <= 0) {
            this.finish(false, `Ты набрал(а) ${this.score} очков! Бомбы попадались часто — попробуй ещё раз.`);
            return;
          }
        } else if (it.type === 'star') { this.score += 50; beep(990, .1); }
        else { this.score += 10; beep(760, .08); }
        it.y = H + 100;
      }
    }
    this.items = this.items.filter(it => it.y < H + 50);
    this.time += dt;
  }
  finish(win, msg) { this.finished = true; this.onFinish(win, msg); }
  draw(ctx) {
    const s = this.p.settings;
    drawBackdrop(ctx, this.p, { accent: '#ffd166', motif: 'leaves' });
    drawEmoji(ctx, '☁️', 110, 70, 42);
    drawEmoji(ctx, '☁️', 650, 110, 34);
    drawEmoji(ctx, '🌳', 60, H - 30, 62);
    drawEmoji(ctx, '🌳', W - 60, H - 30, 62);
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.fillRect(0, H - 16, W, 16);

    for (const it of this.items) {
      const em = it.type === 'bomb' ? '💣' : (it.type === 'star' ? '🌟' : '🍎');
      drawEmoji(ctx, em, it.x + it.w / 2, it.y + it.h / 2, 30);
    }
    drawEmoji(ctx, s.basket, this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, 56);

    if (state.mode === 'edit') {
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      roundRect(ctx, W / 2 - 190, 32, 380, 52, 14); ctx.fill();
      ctx.fillStyle = '#232246';
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
      ctx.fillText('🍎 Предпросмотр — нажми «Играть»', W / 2, 64);
    }
  }
  getHud() {
    return `<span class="hud-pill">♥ ${'♥'.repeat(Math.max(0, this.hearts))}</span>` +
           `<span class="hud-pill">🍎 ${this.score}</span>` +
           `<span class="hud-pill">⏱ ${Math.floor(this.time)} с</span>`;
  }
}

function drawEditCard(ctx, emoji, title, subtitle) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,.94)';
  roundRect(ctx, W / 2 - 265, H / 2 - 65, 530, 130, 20); ctx.fill();
  drawEmoji(ctx, emoji, W / 2, H / 2 - 24, 46);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#232246';
  ctx.font = 'bold 19px "Trebuchet MS", sans-serif';
  ctx.fillText(title, W / 2, H / 2 + 18);
  ctx.fillStyle = '#676a86';
  ctx.font = '13px "Trebuchet MS", sans-serif';
  ctx.fillText(subtitle, W / 2, H / 2 + 42);
  ctx.restore();
}
class ArcadeEngine extends BaseEngine {
  constructor(p) { super(p); this.reset(); }
  finish(win, msg) { this.finished = true; this.onFinish(win, msg); }
  backdrop(ctx, top, bottom) {
    drawBackdrop(ctx, this.p, { top: top || undefined, bottom: bottom || undefined });
  }
}

class SnakeEngine extends ArcadeEngine {
  reset() {
    this.cols = 32; this.rows = 16; this.cell = 24;
    this.ox = Math.floor((W - this.cols * this.cell) / 2);
    this.oy = Math.floor((H - this.rows * this.cell) / 2);
    this.snake = [{ x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }];
    this.dir = { x: 1, y: 0 }; this.nextDir = { x: 1, y: 0 };
    this.score = 0; this.lives = this.p.settings.lives || 3;
    this.acc = 0; this.finished = false;
    this.step = 0.15 / ((this.p.settings.speed || 1) * diffOf(this.p).speed);
    this.placeFood();
  }
  placeFood() {
    for (let i = 0; i < 300; i++) {
      const f = { x: Math.floor(rand(0, this.cols)), y: Math.floor(rand(0, this.rows)) };
      if (!this.snake.some(s => s.x === f.x && s.y === f.y)) { this.food = f; return; }
    }
    this.food = { x: 0, y: 0 };
  }
  update(dt) {
    if (this.finished) return;
    if ((keys.ArrowLeft || keys.KeyA) && this.dir.x !== 1) this.nextDir = { x: -1, y: 0 };
    else if ((keys.ArrowRight || keys.KeyD) && this.dir.x !== -1) this.nextDir = { x: 1, y: 0 };
    else if ((keys.ArrowUp || keys.KeyW) && this.dir.y !== 1) this.nextDir = { x: 0, y: -1 };
    else if ((keys.ArrowDown || keys.KeyS) && this.dir.y !== -1) this.nextDir = { x: 0, y: 1 };
    this.acc += dt;
    if (this.acc < this.step) return;
    this.acc = 0;
    this.dir = this.nextDir;
    const head = { x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y };
    const wall = head.x < 0 || head.y < 0 || head.x >= this.cols || head.y >= this.rows;
    const self = this.snake.slice(0, -1).some(s => s.x === head.x && s.y === head.y);
    if (wall || self) { this.crash(); return; }
    this.snake.unshift(head);
    if (head.x === this.food.x && head.y === this.food.y) {
      this.score += 10; beep(880, .08); this.placeFood();
    } else this.snake.pop();
  }
  crash() {
    beep(190, .2);
    this.lives--;
    if (this.lives <= 0) {
      this.finish(false, `Змейка съела ${this.score / 10} лакомств! Попробуй ещё раз.`);
      return;
    }
    this.snake = [{ x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }];
    this.dir = this.nextDir = { x: 1, y: 0 };
    this.placeFood();
    showToast('Ой! Осталось ' + this.lives + ' ♥', 'warn');
  }
  draw(ctx) {
    this.backdrop(ctx);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1;
    for (let x = 0; x <= this.cols; x++) {
      ctx.beginPath(); ctx.moveTo(this.ox + x * this.cell + .5, this.oy);
      ctx.lineTo(this.ox + x * this.cell + .5, this.oy + this.rows * this.cell); ctx.stroke();
    }
    for (let y = 0; y <= this.rows; y++) {
      ctx.beginPath(); ctx.moveTo(this.ox, this.oy + y * this.cell + .5);
      ctx.lineTo(this.ox + this.cols * this.cell, this.oy + y * this.cell + .5); ctx.stroke();
    }
    ctx.restore();
    drawEmoji(ctx, this.p.settings.food,
      this.ox + this.food.x * this.cell + this.cell / 2,
      this.oy + this.food.y * this.cell + this.cell / 2, 23);
    this.snake.forEach((seg, i) => {
      roundRect(ctx, this.ox + seg.x * this.cell + 2, this.oy + seg.y * this.cell + 2,
        this.cell - 4, this.cell - 4, 7);
      ctx.fillStyle = i === 0 ? shade(this.p.settings.snakeColor, 35) : this.p.settings.snakeColor;
      ctx.fill();
      if (i === 0) {
        ctx.fillStyle = '#232246';
        const ex = this.ox + seg.x * this.cell + (this.dir.x > 0 ? 16 : 8);
        const ey = this.oy + seg.y * this.cell + (this.dir.y > 0 ? 16 : 8);
        ctx.beginPath(); ctx.arc(ex, this.oy + seg.y * this.cell + 9, 2.2, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(this.ox + seg.x * this.cell + 9, ey, 2.2, 0, 7); ctx.fill();
      }
    });
    if (state.mode === 'edit') drawEditCard(ctx, '🐍', 'Настрой свою змейку', 'Нажми «Играть», чтобы начать. Стрелки или WASD — движение');
  }
  getHud() {
    return `<span class="hud-pill">♥ ${'♥'.repeat(Math.max(0, this.lives))}</span>` +
           `<span class="hud-pill">🍎 ${this.score / 10}</span>` +
           `<span class="hud-pill">🐍 ${this.snake.length}</span>`;
  }
}

class PongEngine extends ArcadeEngine {
  reset() {
    const s = this.p.settings;
    this.target = clamp(+s.target || 7, 1, 20);
    this.pw = { x: 34, y: H / 2 - 34, w: 14, h: 68 };
    this.aw = { x: W - 48, y: H / 2 - 34, w: 14, h: 68 };
    this.scoreP = 0; this.scoreA = 0; this.finished = false;
    this.serve(Math.random() < .5 ? 1 : -1);
  }
  serve(dir) {
    const s = this.p.settings, diff = DIFF[s.difficulty] || DIFF.normal;
    const sp = 360 * s.speed * diff.speed;
    this.ball = { x: W / 2, y: H / 2, r: 8, vx: sp * (dir || 1) * .8, vy: rand(-sp * .45, sp * .45) };
  }
  update(dt) {
    if (this.finished) return;
    const s = this.p.settings;
    const mv = 410 * s.speed * dt;
    if (keys.ArrowUp || keys.KeyW) this.pw.y -= mv;
    if (keys.ArrowDown || keys.KeyS) this.pw.y += mv;
    this.pw.y = clamp(this.pw.y, 8, H - 8 - this.pw.h);
    const aiSp = Math.round(380 * diffOf(this.p).speed * s.speed);
    const goal = this.ball.y - this.aw.h / 2;
    this.aw.y += clamp(goal - this.aw.y, -aiSp * dt, aiSp * dt);
    this.aw.y = clamp(this.aw.y, 8, H - 8 - this.aw.h);
    const b = this.ball;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
    if (b.y + b.r > H) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }
    const box = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
    if (aabb(box, this.pw) && b.vx < 0) {
      b.x = this.pw.x + this.pw.w + b.r;
      b.vx = Math.min(Math.abs(b.vx) * 1.05, 760);
      b.vy = ((b.y - (this.pw.y + this.pw.h / 2)) / (this.pw.h / 2)) * 430 * s.speed;
      beep(640, .05);
    }
    if (aabb(box, this.aw) && b.vx > 0) {
      b.x = this.aw.x - b.r;
      b.vx = -Math.min(Math.abs(b.vx) * 1.05, 760);
      b.vy = ((b.y - (this.aw.y + this.aw.h / 2)) / (this.aw.h / 2)) * 430 * s.speed;
      beep(520, .05);
    }
    if (b.x + b.r < 0) { this.scoreA++; beep(230, .16); this.checkPoint(); }
    else if (b.x - b.r > W) { this.scoreP++; beep(760, .16); this.checkPoint(); }
  }
  checkPoint() {
    if (this.scoreP >= this.target) this.finish(true, `Победа! ${this.scoreP}:${this.scoreA} — ты настоящий чемпион!`);
    else if (this.scoreA >= this.target) this.finish(false, `Компьютер победил ${this.scoreA}:${this.scoreP}. Ещё разок?`);
    else this.serve(this.scoreP >= this.scoreA ? 1 : -1);
  }
  draw(ctx) {
    this.backdrop(ctx);
    ctx.save();
    ctx.setLineDash([10, 14]);
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2, 10); ctx.lineTo(W / 2, H - 10); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = this.p.settings.paddle;
    roundRect(ctx, this.pw.x, this.pw.y, this.pw.w, this.pw.h, 7); ctx.fill();
    ctx.fillStyle = this.p.settings.accent;
    roundRect(ctx, this.aw.x, this.aw.y, this.aw.w, this.aw.h, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = 'bold 62px "Trebuchet MS", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillText(this.scoreP, W / 2 - 70, 90);
    ctx.fillText(this.scoreA, W / 2 + 70, 90);
    ctx.restore();
    if (state.mode === 'edit') drawEditCard(ctx, '🏓', 'Настрой матч', `Победа до ${this.target} очков. ↑ ↓ или W S — ракетка`);
  }
  getHud() {
    return `<span class="hud-pill">Ты ${this.scoreP}</span>` +
           `<span class="hud-pill">Компьютер ${this.scoreA}</span>` +
           `<span class="hud-pill">До победы ${this.target}</span>`;
  }
}

class ArkanoidEngine extends ArcadeEngine {
  reset() {
    const s = this.p.settings, diff = DIFF[s.difficulty] || DIFF.normal;
    this.pad = { x: W / 2 - 48, y: H - 30, w: 96, h: 14 };
    this.ball = { x: W / 2, y: H - 50, r: 6, vx: rand(-.5, .5) * 300, vy: -300 };
    this.speed = 370 * s.speed * diff.speed;
    this.score = 0; this.lives = s.lives || 3; this.stuck = true; this.finished = false;
    const rows = clamp(+s.rows || 5, 2, 8), cols = 10, bw = 68, gap = 7;
    const bx = (W - (cols * bw + (cols - 1) * gap)) / 2;
    const palette = ['#ff6b81', '#ff9f43', '#ffd166', '#38c172', '#5ac8fa', '#c792ea', '#ff7eb6'];
    this.bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.bricks.push({ x: bx + c * (bw + gap), y: 52 + r * 32, w: bw, h: 24,
          color: palette[r % palette.length], alive: true });
      }
    }
  }
  update(dt) {
    if (this.finished) return;
    const s = this.p.settings;
    const mv = 420 * s.speed * dt;
    if (keys.ArrowLeft || keys.KeyA) this.pad.x -= mv;
    if (keys.ArrowRight || keys.KeyD) this.pad.x += mv;
    this.pad.x = clamp(this.pad.x, 8, W - 8 - this.pad.w);
    if (this.stuck) {
      this.ball.x = this.pad.x + this.pad.w / 2;
      this.ball.y = this.pad.y - this.ball.r - 1;
      if (pressed.Space || pressed.ArrowUp || pressed.KeyW) {
        this.stuck = false;
        this.ball.vx = rand(-.55, .55) * this.speed;
        this.ball.vy = -this.speed;
        beep(700, .06);
      }
      return;
    }
    const b = this.ball;
    const len = Math.hypot(b.vx, b.vy) || 1;
    b.vx = b.vx / len * this.speed; b.vy = b.vy / len * this.speed;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
    const box = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
    if (b.vy > 0 && aabb(box, this.pad)) {
      b.y = this.pad.y - b.r;
      b.vy = -Math.abs(b.vy);
      b.vx += ((b.x - (this.pad.x + this.pad.w / 2)) / (this.pad.w / 2)) * 150;
      beep(610, .05);
    }
    for (const br of this.bricks) {
      if (!br.alive || !aabb(box, br)) continue;
      br.alive = false; this.score += 10; beep(820, .05);
      const overlapX = Math.min(b.x + b.r - br.x, br.x + br.w - (b.x - b.r));
      const overlapY = Math.min(b.y + b.r - br.y, br.y + br.h - (b.y - b.r));
      if (overlapX < overlapY) b.vx *= -1; else b.vy *= -1;
      break;
    }
    if (b.y - b.r > H) {
      this.lives--;
      beep(200, .18);
      if (this.lives <= 0) this.finish(false, `Ты разбил(а) ${this.score / 10} кирпичей! Попробуй ещё раз.`);
      else { this.stuck = true; showToast('Осталось ' + this.lives + ' ♥', 'warn'); }
    }
    if (this.bricks.every(br => !br.alive)) {
      this.finish(true, `Все кирпичи разбиты! Твой счёт: ${this.score}.`);
    }
  }
  draw(ctx) {
    this.backdrop(ctx);
    for (const br of this.bricks) {
      if (!br.alive) continue;
      ctx.fillStyle = br.color;
      roundRect(ctx, br.x, br.y, br.w, br.h, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      roundRect(ctx, br.x + 4, br.y + 4, br.w - 8, 4, 2); ctx.fill();
    }
    ctx.fillStyle = this.p.settings.paddleColor;
    roundRect(ctx, this.pad.x, this.pad.y, this.pad.w, this.pad.h, 7); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, Math.PI * 2); ctx.fill();
    if (this.stuck && state.mode === 'play') {
      ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.textAlign = 'center';
      ctx.font = '15px "Trebuchet MS", sans-serif';
      ctx.fillText('Нажми Пробел, чтобы запустить шарик', W / 2, H - 60);
    }
    if (state.mode === 'edit') drawEditCard(ctx, '🧱', 'Настрой кирпичи', '← → или A D — платформа, Пробел — запуск шарика');
  }
  getHud() {
    return `<span class="hud-pill">♥ ${'♥'.repeat(Math.max(0, this.lives))}</span>` +
           `<span class="hud-pill">🧱 ${this.score / 10}</span>` +
           `<span class="hud-pill">Осталось ${this.bricks.filter(b => b.alive).length}</span>`;
  }
}

class ShooterEngine extends ArcadeEngine {
  reset() {
    const s = this.p.settings, diff = DIFF[s.difficulty] || DIFF.normal;
    this.ship = { x: W / 2 - 22, y: H - 64, w: 44, h: 44 };
    this.bullets = []; this.drops = []; this.score = 0;
    this.lives = s.lives || 3; this.fireCd = 0; this.finished = false; this.dir = 1;
    this.stars = Array.from({ length: 65 }, () => ({
      x: rand(0, W), y: rand(0, H), r: rand(.6, 1.9), sp: rand(25, 95)
    }));
    this.aliens = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        this.aliens.push({ x: 80 + c * 88, y: 54 + r * 54, w: 40, h: 36,
          alive: true, em: r === 0 ? '👽' : '👾' });
      }
    }
    this.alienSpeed = Math.round(95 * diffOf(this.p).speed * s.speed);
  }
  update(dt) {
    if (this.finished) return;
    const s = this.p.settings;
    const mv = 390 * s.speed * dt;
    if (keys.ArrowLeft || keys.KeyA) this.ship.x -= mv;
    if (keys.ArrowRight || keys.KeyD) this.ship.x += mv;
    this.ship.x = clamp(this.ship.x, 12, W - 12 - this.ship.w);
    this.fireCd -= dt;
    if (keys.Space && this.fireCd <= 0) {
      this.bullets.push({ x: this.ship.x + this.ship.w / 2, y: this.ship.y, r: 4 });
      this.fireCd = 0.32 / (s.fireRate || 1);
      beep(920, .04);
    }
    for (const st of this.stars) {
      st.y += st.sp * dt;
      if (st.y > H) { st.y = 0; st.x = rand(0, W); }
    }
    const alive = this.aliens.filter(a => a.alive);
    for (const a of alive) {
      a.x += this.dir * this.alienSpeed * dt;
      if (a.x < 25 || a.x + a.w > W - 25) { this.dir *= -1; break; }
    }
    for (const a of alive) {
      a.y += 12 * dt;
      if (a.y + a.h >= this.ship.y) {
        a.alive = false; this.lives--; beep(180, .2);
        if (this.lives <= 0) { this.finish(false, 'Пришельцы добрались до Земли! Следующий раз получится лучше.'); return; }
        showToast('Осталось ' + this.lives + ' ♥', 'warn');
      }
    }
    for (const b of this.bullets) {
      b.y -= 640 * dt;
      const bbox = { x: b.x - b.r, y: b.y - b.r, w: b.r * 2, h: b.r * 2 };
      for (const a of this.aliens) {
        if (!a.alive || !aabb(bbox, a)) continue;
        a.alive = false; b.y = -50; this.score += 20; beep(1050, .07);
        if (Math.random() < .12) this.drops.push({ x: a.x + a.w / 2, y: a.y, w: 22, h: 22 });
        break;
      }
    }
    this.bullets = this.bullets.filter(b => b.y > -20);
    for (const d of this.drops) {
      d.y += 120 * dt;
      if (aabb(d, this.ship)) { d.y = H + 50; this.score += 50; beep(1200, .12); }
    }
    this.drops = this.drops.filter(d => d.y < H + 30);
    if (!this.aliens.some(a => a.alive)) {
      this.finish(true, `Все пришельцы повержены! Твой счёт: ${this.score}.`);
    }
  }
  draw(ctx) {
    this.backdrop(ctx);
    ctx.save(); ctx.fillStyle = '#fff';
    for (const st of this.stars) { ctx.globalAlpha = .3 + st.r * .3; ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 7); ctx.fill(); }
    ctx.restore();
    for (const a of this.aliens) if (a.alive) drawEmoji(ctx, a.em, a.x + a.w / 2, a.y + a.h / 2, 34);
    ctx.fillStyle = '#7cf3ff';
    for (const b of this.bullets) { roundRect(ctx, b.x - b.r, b.y - 10, b.r * 2, 14, 3); ctx.fill(); }
    for (const d of this.drops) drawEmoji(ctx, '🌟', d.x, d.y + 10, 22);
    drawEmoji(ctx, this.p.settings.ship, this.ship.x + this.ship.w / 2, this.ship.y + this.ship.h / 2, 44);
    if (state.mode === 'edit') drawEditCard(ctx, '🚀', 'Настрой космический бой', '← → — лететь, Пробел — стрелять. Сбивай всех пришельцев!');
  }
  getHud() {
    return `<span class="hud-pill">♥ ${'♥'.repeat(Math.max(0, this.lives))}</span>` +
           `<span class="hud-pill">⭐ ${this.score}</span>` +
           `<span class="hud-pill">👾 ${this.aliens.filter(a => a.alive).length}</span>`;
  }
}

class TicTacToeEngine extends ArcadeEngine {
  reset() {
    const s = this.p.settings;
    this.board = Array(9).fill('');
    this.human = s.mark === '⭕' ? '⭕' : '❌';
    this.ai = this.human === '❌' ? '⭕' : '❌';
    this.turn = s.first ? 'human' : 'ai';
    this.wins = 0; this.losses = 0; this.finished = false;
    this.winLine = null;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.turn === 'ai' && state && state.mode === 'play') this.scheduleAi();
  }
  destroy() { if (this.timer) clearTimeout(this.timer); }
  cellRect(i) {
    const size = 112, gap = 10, total = size * 3 + gap * 2;
    const ox = (W - total) / 2, oy = (H - total) / 2;
    return { x: ox + (i % 3) * (size + gap), y: oy + Math.floor(i / 3) * (size + gap), w: size, h: size };
  }
  onClick(x, y) {
    if (this.finished || this.turn !== 'human') return;
    for (let i = 0; i < 9; i++) {
      const r = this.cellRect(i);
      if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
      if (this.board[i]) return;
      this.board[i] = this.human;
      beep(700, .06);
      if (this.checkEnd()) return;
      this.turn = 'ai';
      this.scheduleAi();
      return;
    }
  }
  scheduleAi() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (this.finished || state.mode !== 'play') return;
      const move = this.aiMove();
      if (move >= 0) {
        this.board[move] = this.ai;
        beep(480, .06);
      }
      if (this.checkEnd()) return;
      this.turn = 'human';
    }, 280);
  }
  checkEnd() {
    const line = this.winner(this.board);
    if (line) {
      this.winLine = line;
      if (this.board[line[0]] === this.human) {
        this.wins++;
        this.finish(true, 'Ура! У тебя три в ряд — ты победил(а)! 🎉');
      } else {
        this.losses++;
        this.finish(false, 'Компьютер собрал три в ряд. Давай ещё раз!');
      }
      return true;
    }
    if (!this.board.includes('')) {
      this.finish(false, 'Ничья! Очень неплохая партия.');
      return true;
    }
    return false;
  }
  winner(b) {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return lines.find(l => b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) || null;
  }
  emptyCells(b) { const a = []; for (let i = 0; i < 9; i++) if (!b[i]) a.push(i); return a; }
  aiMove() {
    const smart = this.p.settings.smart;
    const free = this.emptyCells(this.board);
    if (!free.length) return -1;
    if (smart === 'easy' || (smart === 'normal' && Math.random() < .10)) return free[Math.floor(rand(0, free.length))];
    for (const mark of [this.ai, this.human]) {
      for (const i of free) {
        const copy = this.board.slice(); copy[i] = mark;
        if (this.winner(copy)) return i;
      }
    }
    if (smart === 'hard') {
      let best = -1000, move = free[0];
      for (const i of free) {
        const copy = this.board.slice(); copy[i] = this.ai;
        const score = this.minimax(copy, false);
        if (score > best) { best = score; move = i; }
      }
      return move;
    }
    if (!this.board[4]) return 4;
    return free[Math.floor(rand(0, free.length))];
  }
  minimax(b, isAi) {
    const line = this.winner(b);
    if (line) return b[line[0]] === this.ai ? 10 : -10;
    if (!b.includes('')) return 0;
    let best = isAi ? -1000 : 1000;
    for (const i of this.emptyCells(b)) {
      b[i] = isAi ? this.ai : this.human;
      const s = this.minimax(b, !isAi);
      b[i] = '';
      best = isAi ? Math.max(best, s) : Math.min(best, s);
    }
    return best;
  }
  draw(ctx) {
    this.backdrop(ctx);
    ctx.save();
    ctx.strokeStyle = this.p.settings.accent; ctx.lineWidth = 9; ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const r = this.cellRect(i);
      roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 3; ctx.stroke();
      if (this.board[i]) drawEmoji(ctx, this.board[i], r.x + r.w / 2, r.y + r.h / 2, 68);
    }
    if (this.winLine) {
      const a = this.cellRect(this.winLine[0]), b = this.cellRect(this.winLine[2]);
      ctx.strokeStyle = '#38c172'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(a.x + a.w / 2, a.y + a.h / 2);
      ctx.lineTo(b.x + b.w / 2, b.y + b.h / 2); ctx.stroke();
    }
    ctx.restore();
    if (state.mode === 'edit') drawEditCard(ctx, '⭕', 'Настрой игру', 'Ты ходишь кликом по клетке. Собери три значка в ряд!');
  }
  getHud() {
    return `<span class="hud-pill">Ты ${this.wins}</span>` +
           `<span class="hud-pill">Компьютер ${this.losses}</span>` +
           `<span class="hud-pill">${this.turn === 'human' ? 'Твой ход' : 'Ход компьютера'}</span>`;
  }
}

class MemoryEngine extends ArcadeEngine {
  reset() {
    const s = this.p.settings;
    this.pairs = clamp(+s.pairs || 10, 4, 12);
    const sets = {
      animals: ['🐶','🐱','🦊','🐻','🐼','🦁','🐸','🐵','🐯','🐷','🦄','🐨'],
      food: ['🍎','🍌','🍇','🍓','🍒','🍉','🥕','🍕','🍔','🍩','🍑','🥑'],
      space: ['🚀','🪐','⭐','🌙','☀️','🌍','🛸','👽','🌌','🔭','☄️','🌠']
    };
    const emojis = (sets[s.deck] || sets.animals).slice(0, this.pairs);
    const deck = emojis.concat(emojis).sort(() => Math.random() - .5);
    this.cards = deck.map(em => ({ em, flipped: false, matched: false }));
    this.cols = this.pairs <= 6 ? 4 : 5;
    this.rows = Math.ceil(this.cards.length / this.cols);
    this.cw = 76; this.ch = 76; this.gap = 8;
    this.ox = (W - (this.cols * this.cw + (this.cols - 1) * this.gap)) / 2;
    this.oy = (H - (this.rows * this.ch + (this.rows - 1) * this.gap)) / 2;
    this.first = null; this.second = null; this.lock = false;
    this.moves = 0; this.matched = 0; this.finished = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }
  destroy() { if (this.timer) clearTimeout(this.timer); }
  cardRect(i) {
    return { x: this.ox + (i % this.cols) * (this.cw + this.gap),
      y: this.oy + Math.floor(i / this.cols) * (this.ch + this.gap), w: this.cw, h: this.ch };
  }
  onClick(x, y) {
    if (this.finished || this.lock || state.mode !== 'play') return;
    for (let i = 0; i < this.cards.length; i++) {
      const r = this.cardRect(i);
      if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
      const card = this.cards[i];
      if (card.flipped || card.matched) return;
      card.flipped = true; beep(760, .05);
      if (!this.first) { this.first = card; return; }
      this.second = card; this.moves++; this.lock = true;
      this.timer = setTimeout(() => {
        if (this.first.em === this.second.em) {
          this.first.matched = this.second.matched = true;
          this.matched++; beep(1050, .1);
          if (this.matched === this.pairs) {
            this.finish(true, `Все пары найдены! Ты сделал(а) ${this.moves} ходов.`);
          }
        } else {
          this.first.flipped = this.second.flipped = false;
          beep(300, .1);
        }
        this.first = this.second = null; this.lock = false;
      }, 780);
      return;
    }
  }
  draw(ctx) {
    this.backdrop(ctx);
    for (let i = 0; i < this.cards.length; i++) {
      const r = this.cardRect(i), c = this.cards[i];
      ctx.fillStyle = c.matched ? 'rgba(56,193,114,.35)' : (c.flipped ? '#ffffff' : 'rgba(255,255,255,.18)');
      roundRect(ctx, r.x, r.y, r.w, r.h, 12); ctx.fill();
      ctx.strokeStyle = c.matched ? '#38c172' : 'rgba(255,255,255,.35)';
      ctx.lineWidth = 2; ctx.stroke();
      if (c.flipped || c.matched) drawEmoji(ctx, c.em, r.x + r.w / 2, r.y + r.h / 2, 40);
      else {
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.textAlign = 'center';
        ctx.font = 'bold 40px "Trebuchet MS", sans-serif';
        ctx.fillText('?', r.x + r.w / 2, r.y + r.h / 2 + 2);
      }
    }
    if (state.mode === 'edit') drawEditCard(ctx, '🃏', 'Настрой память', `Найди ${this.pairs} пар. Кликай по карточкам и запоминай картинки!`);
  }
  getHud() {
    return `<span class="hud-pill">👣 ${this.moves}</span>` +
           `<span class="hud-pill">🃏 ${this.matched}/${this.pairs}</span>` +
           `<span class="hud-pill">🃏 ${this.lock ? 'Подожди...' : 'Ищи пары!'}</span>`;
  }
}

class MathEngine extends ArcadeEngine {
  reset() {
    const s = this.p.settings;
    this.total = clamp(+s.count || 8, 3, 20);
    this.limit = clamp(+s.seconds || 12, 5, 30);
    this.ops = (s.ops && s.ops.length) ? s.ops.slice() : ['+', '-'];
    this.score = 0; this.index = 0; this.lives = s.lives || 3;
    this.timeLeft = this.limit; this.finished = false;
    this.question = this.makeQuestion();
  }
  makeQuestion() {
    const d = diffOf(this.p);
    const max = Math.round(42 * d.speed);
    const op = this.ops[Math.floor(rand(0, this.ops.length))];
    let a = Math.floor(rand(1, max)) + 1;
    let b = Math.floor(rand(1, Math.min(max, 20))) + 1;
    let sign = op, ans;
    if (op === '+') ans = a + b;
    else if (op === '-') { if (a < b) { const t = a; a = b; b = t; } ans = a - b; }
    else if (op === '×') { b = Math.min(b, 12); ans = a * b; }
    else { sign = ':'; ans = b; a = b * (Math.floor(rand(1, 12)) + 1); }
    const opts = new Set([ans]);
    while (opts.size < 4) {
      const d = ans + Math.floor(rand(-3, 4));
      if (d >= 0) opts.add(d);
    }
    const options = Array.from(opts).sort(() => Math.random() - .5);
    return { text: `${a} ${sign} ${b} = ?`, options, answer: ans };
  }
  optionRect(i) {
    const bw = 165, bh = 66, gap = 14;
    const ox = (W - (bw * 2 + gap)) / 2, oy = 268;
    return { x: ox + (i % 2) * (bw + gap), y: oy + Math.floor(i / 2) * (bh + gap), w: bw, h: bh };
  }
  next() {
    this.index++;
    if (this.lives <= 0) { this.finish(false, `Правильных ответов: ${this.score / 10}. Попробуй ещё раз!`); return; }
    if (this.index >= this.total) {
      this.finish(true, `Все примеры решены! Правильных: ${this.score / 10} из ${this.total}.`);
      return;
    }
    this.timeLeft = this.limit;
    this.question = this.makeQuestion();
  }
  onClick(x, y) {
    if (this.finished || state.mode !== 'play') return;
    for (let i = 0; i < 4; i++) {
      const r = this.optionRect(i);
      if (x < r.x || x > r.x + r.w || y < r.y || y > r.y + r.h) continue;
      if (this.question.options[i] === this.question.answer) {
        this.score += 10; beep(920, .09);
      } else {
        this.lives--; beep(230, .15);
        showToast('Не совсем так. Попробуй следующий!', 'warn');
      }
      this.next();
      return;
    }
  }
  update(dt) {
    if (this.finished || state.mode !== 'play') return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.lives--; beep(230, .15);
      this.next();
    }
  }
  draw(ctx) {
    this.backdrop(ctx);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 74px "Trebuchet MS", sans-serif';
    ctx.fillText(this.question.text, W / 2, 175);
    const barW = 420;
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    roundRect(ctx, W / 2 - barW / 2, 210, barW, 12, 6); ctx.fill();
    ctx.fillStyle = this.timeLeft < 4 ? '#ff6b81' : this.p.settings.accent;
    roundRect(ctx, W / 2 - barW / 2, 210, barW * clamp(this.timeLeft / this.limit, 0, 1), 12, 6); ctx.fill();
    ctx.font = '15px "Trebuchet MS", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText('Выбери ответ кликом', W / 2, 252);
    for (let i = 0; i < 4; i++) {
      const r = this.optionRect(i);
      ctx.fillStyle = 'rgba(255,255,255,.94)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 14); ctx.fill();
      ctx.fillStyle = '#232246';
      ctx.font = 'bold 32px "Trebuchet MS", sans-serif';
      ctx.fillText(this.question.options[i], r.x + r.w / 2, r.y + r.h / 2 + 2);
      ctx.fillStyle = this.p.settings.accent;
      ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
      ctx.fillText('АБВГ'[i], r.x + 14, r.y + 20);
    }
    ctx.restore();
    if (state.mode === 'edit') drawEditCard(ctx, '🧮', 'Настрой примеры', `Всего ${this.total} примеров, по ${this.limit} секунд на каждый.`);
  }
  getHud() {
    return `<span class="hud-pill">⭐ ${this.score / 10}</span>` +
           `<span class="hud-pill">❓ ${Math.min(this.index + 1, this.total)}/${this.total}</span>` +
           `<span class="hud-pill">♥ ${'♥'.repeat(Math.max(0, this.lives))}</span>` +
           `<span class="hud-pill">⏱ ${Math.max(0, Math.ceil(this.timeLeft))} с</span>`;
  }
}

/* =========================================================
   НОВЫЕ ЖАНРЫ: шутеры, аркада, стратегии, экшен
   ========================================================= */
class GenreEngine extends ArcadeEngine {
  get dm() { return DIFF[this.p.settings.difficulty] || DIFF.normal; }
  get spd() { return (this.p.settings.speed || 1) * this.dm.speed; }
  get goal() { return this.p.template === 'tank' ? 20 : Math.max(3, Math.round((this.p.settings.count || 10) * this.dm.traffic)); }
  get limit() { return Math.round((this.p.settings.seconds || 60) * this.dm.time / 60); }
  pill(icon, value) { return `<span class="hud-pill">${icon} ${value}</span>`; }
  heartHud() { return this.pill('♥', '♥'.repeat(Math.max(0, this.lives))); }
  scoreHud() { return this.pill('⭐', this.score || 0); }
  goalHud(icon) { return this.pill(icon, (this.hits || 0) + '/' + this.goal); }
  timeHud() { return this.pill('⏱', Math.max(0, Math.ceil(this.time)) + ' с'); }
  edit(ctx, emoji, title, sub) { if (state.mode === 'edit') drawEditCard(ctx, emoji, title, sub); }
  bar(ctx, x, y, w, h, ratio, color) {
    ctx.fillStyle = 'rgba(255,255,255,.2)'; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = color; roundRect(ctx, x, y, w * clamp(ratio, 0, 1), h, h / 2); ctx.fill();
  }
  stars(ctx, n) {
    ctx.save(); ctx.fillStyle = '#fff';
    for (let i = 0; i < (n || 45); i++) {
      ctx.globalAlpha = .2 + (i % 5) / 9;
      ctx.fillRect((i * 137.5) % W, (i * 79.3) % H, 2, 2);
    }
    ctx.restore();
  }
  button(ctx, r, label, color) {
    ctx.fillStyle = color || this.p.settings.accent;
    roundRect(ctx, r.x, r.y, r.w, r.h, 14); ctx.fill();
    ctx.fillStyle = '#232246';
    ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + 1);
  }
}

/* ---------- Шутер 1: Звёздный рейд ---------- */
class StarRaidEngine extends GenreEngine {
  reset() {
    this.score = 0; this.lives = this.p.settings.lives || 3; this.hits = 0;
    this.time = this.limit; this.finished = false;
    this.ship = { x: W / 2, y: H - 60 };
    this.bullets = []; this.foes = []; this.spawn = .5; this.fire = 0;
  }
  update(dt) {
    if (this.finished) return;
    const s = this.ship;
    if (keys.ArrowLeft || keys.KeyA) s.x -= 260 * dt;
    if (keys.ArrowRight || keys.KeyD) s.x += 260 * dt;
    if (keys.ArrowUp || keys.KeyW) s.y -= 200 * dt;
    if (keys.ArrowDown || keys.KeyS) s.y += 200 * dt;
    s.x = clamp(s.x, 26, W - 26); s.y = clamp(s.y, 120, H - 30);
    this.fire -= dt;
    if ((pressed.Space || keys.Space) && this.fire <= 0) {
      this.bullets.push({ x: s.x, y: s.y - 22 }); this.fire = .2; beep(880, .04);
    }
    for (const b of this.bullets) b.y -= 520 * dt;
    this.bullets = this.bullets.filter(b => b.y > -10);
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.foes.push({ x: rand(40, W - 40), y: -24, phase: rand(0, 6) });
      this.spawn = rand(.5, 1.0) / this.dm.traffic;
    }
    for (const f of this.foes) {
      f.y += 95 * this.spd * dt; f.phase += dt * 2;
      f.x = clamp(f.x + Math.sin(f.phase) * 26 * dt, 24, W - 24);
      for (const b of this.bullets) {
        if (!b.dead && !f.dead && Math.hypot(b.x - f.x, b.y - f.y) < 24) {
          b.dead = true; f.dead = true; this.hits++; this.score += 10; beep(520, .07); break;
        }
      }
      if (!f.dead && f.y > H + 20) { f.dead = true; this.lives--; beep(180, .18); }
    }
    this.foes = this.foes.filter(f => !f.dead);
    this.bullets = this.bullets.filter(b => !b.dead);
    this.time -= dt;
    if (this.hits >= this.goal) this.finish(true, 'Все враги сбиты!');
    else if (this.lives <= 0) this.finish(false, 'Корабль повреждён');
    else if (this.time <= 0) this.finish(false, 'Время вышло');
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p); this.stars(ctx);
    for (const f of this.foes) drawEmoji(ctx, '👾', f.x, f.y, 34);
    ctx.fillStyle = this.p.settings.accent;
    for (const b of this.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill(); }
    drawEmoji(ctx, this.p.settings.hero || '🚀', this.ship.x, this.ship.y, 46);
    this.edit(ctx, '🚀', 'Звёздный рейд', `Сбей ${this.goal} врагов за ${this.limit} секунд.`);
  }
  getHud() { return this.goalHud('👾') + this.scoreHud() + this.heartHud() + this.timeHud(); }
}

/* ---------- Шутер 2: Батл Сити (Battle City) ---------- */
class BattleCityEngine extends GenreEngine {
  reset() {
    this.score = 0; this.hits = 0; this.lives = this.p.settings.lives || 3;
    this.time = this.limit; this.finished = false;
    this.grid = this.buildGrid(this.p.settings.layout || 1);
    this.base = { x: 400, y: 432, alive: true };
    this.player = this.makeTank(304, 400, 'up', 'player');
    this.player.inv = 0.9;
    this.foes = []; this.bullets = [];
    this.spawn = .8; this.fire = 0;
    this.maxFoes = 6;
  }
  buildGrid(layout) {
    const g = Array.from({ length: 14 }, () => Array(25).fill(0));
    const put = (c, r, t) => { if (r >= 0 && r < 14 && c >= 0 && c < 25) g[r][c] = t; };
    const rect = (c1, r1, c2, r2, t) => {
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) put(c, r, t);
    };
    if (layout === 1) {
      rect(2, 2, 4, 3, 1); rect(9, 2, 11, 2, 1); rect(13, 2, 15, 2, 1); rect(20, 2, 22, 3, 1);
      rect(6, 4, 6, 5, 2); rect(18, 4, 18, 5, 2);
      rect(2, 6, 4, 7, 1); rect(10, 6, 14, 6, 1); rect(20, 6, 22, 7, 1);
      rect(1, 9, 2, 10, 3); rect(22, 9, 23, 10, 3);
      rect(7, 9, 8, 10, 4); rect(16, 9, 17, 10, 4);
      rect(11, 8, 13, 8, 1);
    } else if (layout === 2) {
      rect(1, 2, 3, 2, 2); rect(21, 2, 23, 2, 2);
      rect(5, 2, 5, 4, 1); rect(19, 2, 19, 4, 1);
      rect(8, 3, 10, 3, 1); rect(14, 3, 16, 3, 1);
      rect(2, 5, 6, 5, 1); rect(18, 5, 22, 5, 1);
      rect(8, 6, 8, 8, 3); rect(16, 6, 16, 8, 3);
      rect(11, 5, 13, 5, 2);
      rect(4, 9, 6, 10, 4); rect(18, 9, 20, 10, 4);
    } else {
      rect(3, 2, 7, 2, 1); rect(17, 2, 21, 2, 1);
      rect(3, 3, 3, 5, 1); rect(21, 3, 21, 5, 1);
      rect(6, 4, 10, 4, 2); rect(14, 4, 18, 4, 2);
      rect(11, 3, 13, 3, 1);
      rect(1, 7, 4, 7, 3); rect(20, 7, 23, 7, 3);
      rect(8, 7, 10, 8, 1); rect(14, 7, 16, 8, 1);
      rect(6, 10, 7, 10, 4); rect(17, 10, 18, 10, 4);
    }
    rect(12, 12, 12, 12, 1); rect(11, 13, 11, 13, 1); rect(13, 13, 13, 13, 1);
    return g;
  }
  makeTank(x, y, dir, kind) {
    return {
      x, y, dir, kind, hp: kind === 'armored' ? 3 : 1,
      speed: kind === 'fast' ? 125 : 78,
      cool: rand(.5, 1.3), turn: rand(.6, 1.4)
    };
  }
  tile(c, r) {
    if (c < 0 || c >= 25 || r < 0 || r >= 14) return 2;
    return this.grid[r][c];
  }
  dirVec(d) {
    return d === 'up' ? [0, -1] : d === 'down' ? [0, 1] : d === 'left' ? [-1, 0] : [1, 0];
  }
  canMove(x, y, self) {
    if (x < 16 || x > W - 16 || y < 16 || y > H - 16) return false;
    for (const dx of [-12, 12]) for (const dy of [-12, 12]) {
      const t = this.tile(Math.floor((x + dx) / 32), Math.floor((y + dy) / 32));
      if (t === 1 || t === 2 || t === 3) return false;
    }
    if (this.base.alive && Math.abs(x - this.base.x) < 32 && Math.abs(y - this.base.y) < 32) return false;
    for (const t of this.foes.concat([this.player])) {
      if (t && t !== self && Math.hypot(t.x - x, t.y - y) < 27) return false;
    }
    return true;
  }
  moveTank(t, dt) {
    const [dx, dy] = this.dirVec(t.dir);
    const nx = t.x + dx * t.speed * this.spd * dt;
    const ny = t.y + dy * t.speed * this.spd * dt;
    if (this.canMove(nx, ny, t)) { t.x = nx; t.y = ny; return true; }
    return false;
  }
  shoot(t, friend) {
    const [dx, dy] = this.dirVec(t.dir);
    this.bullets.push({ x: t.x + dx * 20, y: t.y + dy * 20,
      vx: dx * 400, vy: dy * 400, friend, life: 1.5 });
    beep(friend ? 720 : 420, .04);
  }
  killPlayer() {
    this.lives--; beep(150, .18);
    if (this.lives <= 0) return;
    this.player = this.makeTank(304, 400, 'up', 'player');
    this.player.inv = 1.6;
  }
  update(dt) {
    if (this.finished) return;
    const p = this.player;
    p.inv = Math.max(0, p.inv - dt);
    let d = null;
    if (keys.ArrowUp || keys.KeyW) d = 'up';
    else if (keys.ArrowDown || keys.KeyS) d = 'down';
    else if (keys.ArrowLeft || keys.KeyA) d = 'left';
    else if (keys.ArrowRight || keys.KeyD) d = 'right';
    if (d) { p.dir = d; this.moveTank(p, dt); }
    this.fire -= dt;
    if ((pressed.Space || keys.Space) && this.fire <= 0 &&
        this.bullets.filter(b => b.friend).length < 2) {
      this.shoot(p, true); this.fire = .32 / this.spd;
    }
    if (p.inv <= 0 && this.foes.some(f => !f.dead && Math.hypot(f.x - p.x, f.y - p.y) < 26)) this.killPlayer();

    this.spawn -= dt;
    const alive = this.foes.filter(f => !f.dead).length;
    if (this.spawn <= 0 && alive < this.maxFoes && this.hits + alive < this.goal) {
      const c = [0, 12, 24][Math.floor(rand(0, 3))];
      const r = Math.random();
      const kind = r < .28 ? 'armored' : r < .55 ? 'fast' : 'basic';
      const f = this.makeTank(c * 32 + 16, 16, 'down', kind);
      if (this.canMove(f.x, f.y, f)) this.foes.push(f);
      this.spawn = rand(1.0, 1.9) / this.dm.traffic;
    }
    for (const f of this.foes) {
      if (f.dead) continue;
      const [vx, vy] = this.dirVec(f.dir);
      f.turn -= dt;
      if (f.turn <= 0 || !this.canMove(f.x + vx * 22, f.y + vy * 22, f)) {
        const opts = ['up', 'down', 'left', 'right'].filter(dir => {
          const [ax, ay] = this.dirVec(dir);
          return this.canMove(f.x + ax * 22, f.y + ay * 22, f);
        });
        if (opts.includes('down') && Math.random() < .7) f.dir = 'down';
        else if (opts.length) f.dir = opts[Math.floor(rand(0, opts.length))];
        f.turn = rand(.7, 1.5);
      }
      this.moveTank(f, dt);
      if (this.base.alive && Math.abs(f.x - this.base.x) < 34 && Math.abs(f.y - this.base.y) < 34) {
        this.base.alive = false; beep(120, .4);
      }
      f.cool -= dt;
      if (f.cool <= 0) { this.shoot(f, false); f.cool = rand(.6, 1.3) / this.dm.traffic; }
    }

    for (const b of this.bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.x < 4 || b.x > W - 4 || b.y < 4 || b.y > H - 4) { b.dead = true; continue; }
      const c = Math.floor(b.x / 32), r = Math.floor(b.y / 32);
      const tile = this.tile(c, r);
      if (tile === 1) { this.grid[r][c] = 0; b.dead = true; beep(300, .03); continue; }
      if (tile === 2) { b.dead = true; beep(220, .03); continue; }
      if (this.base.alive && Math.abs(b.x - this.base.x) < 18 && Math.abs(b.y - this.base.y) < 18) {
        b.dead = true;
        if (!b.friend) { this.base.alive = false; beep(120, .4); }
        continue;
      }
      const targets = b.friend ? this.foes : [this.player];
      for (const t of targets) {
        if (b.dead || !t || t.dead || t.inv > 0) continue;
        if (Math.hypot(b.x - t.x, b.y - t.y) < 16) {
          b.dead = true; t.hp--;
          if (t.hp <= 0) {
            t.dead = true;
            if (b.friend) { this.hits++; this.score += 10; beep(520, .08); }
            else this.killPlayer();
          } else beep(340, .06);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead && b.life > 0);
    this.foes = this.foes.filter(f => !f.dead);
    this.time -= dt;
    if (this.hits >= this.goal) this.finish(true, 'Все вражеские танки уничтожены!');
    else if (!this.base.alive) this.finish(false, 'База разрушена!');
    else if (this.lives <= 0) this.finish(false, 'Танки закончились');
    else if (this.time <= 0) this.finish(false, 'Время вышло');
  }
  drawTank(ctx, t) {
    const color = t.kind === 'player' ? (this.p.settings.accent || '#ffd166')
      : t.kind === 'armored' ? '#c792ea' : t.kind === 'fast' ? '#ff9f43' : '#ff6b81';
    const ang = t.dir === 'up' ? -Math.PI / 2 : t.dir === 'down' ? Math.PI / 2
      : t.dir === 'left' ? Math.PI : 0;
    ctx.save(); ctx.translate(t.x, t.y); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; roundRect(ctx, -13, -9, 26, 24, 5); ctx.fill();
    ctx.fillStyle = '#4d5666'; ctx.fillRect(-14, -12, 6, 24); ctx.fillRect(8, -12, 6, 24);
    ctx.fillStyle = color; roundRect(ctx, -12, -10, 24, 20, 5); ctx.fill();
    ctx.fillStyle = '#2f3542'; roundRect(ctx, -6, -7, 12, 13, 4); ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(2, -3, 18, 6);
    if (t.kind === 'armored') {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; roundRect(ctx, -12, -10, 24, 20, 5); ctx.stroke();
    }
    if (t.kind === 'player') drawEmoji(ctx, '⭐', 0, 0, 13);
    ctx.restore();
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p);
    ctx.fillStyle = 'rgba(255,255,255,.03)';
    for (let r = 0; r < 14; r++) for (let c = 0; c < 25; c++)
      if ((r + c) % 2 === 0) ctx.fillRect(c * 32, r * 32, 32, 32);
    for (let r = 0; r < 14; r++) for (let c = 0; c < 25; c++) {
      const t = this.grid[r][c]; if (!t) continue;
      const x = c * 32, y = r * 32;
      if (t === 1) {
        ctx.fillStyle = '#c8663f'; ctx.fillRect(x + 1, y + 1, 30, 30);
        ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath(); ctx.moveTo(x + 1, y + 1 + k * 10); ctx.lineTo(x + 31, y + 1 + k * 10); ctx.stroke();
        }
        for (let k = 0; k < 2; k++) {
          const off = k ? 10 : 22;
          ctx.beginPath(); ctx.moveTo(x + off, y + 1 + k * 15); ctx.lineTo(x + off, y + 11 + k * 15); ctx.stroke();
        }
      } else if (t === 2) {
        ctx.fillStyle = '#8b93a8'; ctx.fillRect(x + 1, y + 1, 30, 30);
        ctx.fillStyle = '#c3cad9'; ctx.fillRect(x + 3, y + 3, 26, 4);
        ctx.fillStyle = '#5b6274';
        [[6, 7], [26, 7], [6, 26], [26, 26]].forEach(([px, py]) => {
          ctx.beginPath(); ctx.arc(x + px, y + py, 2, 0, 7); ctx.fill();
        });
      } else if (t === 3) {
        ctx.fillStyle = '#2f7fc4'; ctx.fillRect(x, y, 32, 32);
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
        for (let k = 0; k < 2; k++) {
          ctx.beginPath(); ctx.moveTo(x + 4, y + 9 + k * 12);
          ctx.quadraticCurveTo(x + 12, y + 5 + k * 12, x + 20, y + 9 + k * 12); ctx.stroke();
        }
      }
    }
    drawEmoji(ctx, this.base.alive ? '🦅' : '💥', this.base.x, this.base.y, 42);
    for (const b of this.bullets) {
      ctx.fillStyle = b.friend ? '#fff3a0' : '#ff8a8a';
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, 7); ctx.fill();
    }
    for (const f of this.foes) if (!f.dead) this.drawTank(ctx, f);
    if (!(this.player.inv > 0 && Math.floor(this.time * 10) % 2 === 0)) this.drawTank(ctx, this.player);
    for (let r = 0; r < 14; r++) for (let c = 0; c < 25; c++) if (this.grid[r][c] === 4) {
      ctx.fillStyle = 'rgba(60,170,80,.7)'; ctx.fillRect(c * 32, r * 32, 32, 32);
      drawEmoji(ctx, '🌿', c * 32 + 16, r * 32 + 16, 24);
    }
    this.edit(ctx, '🛡️', 'Батл Сити', `Уничтожь ${this.goal} танков и защити базу 🦅.`);
  }
  getHud() {
    return this.goalHud('👾') + this.heartHud() +
      this.pill('🦅', this.base.alive ? 'цела' : 'разрушена') + this.timeHud();
  }
}

/* ---------- Шутер 3: Меткий тир ---------- */
class RangeEngine extends GenreEngine {
  reset() {
    this.score = 0; this.hits = 0; this.misses = 0; this.time = this.limit;
    this.finished = false; this.targets = []; this.spawn = .2;
  }
  update(dt) {
    if (this.finished) return;
    this.time -= dt; this.spawn -= dt;
    if (this.spawn <= 0 && this.targets.length < 4) {
      this.targets.push({ x: rand(70, W - 70), y: rand(70, H - 70), r: rand(18, 28),
        life: rand(.8, 1.3) / this.dm.speed });
      this.spawn = rand(.28, .55) / this.dm.traffic;
    }
    let expired = 0;
    for (const t of this.targets) { t.life -= dt; if (t.life <= 0) expired++; }
    if (expired) {
      this.targets = this.targets.filter(t => t.life > 0);
      this.misses += expired; this.score = Math.max(0, this.score - 4 * expired);
    }
    if (this.hits >= this.goal) this.finish(true, 'Отличная стрельба!');
    else if (this.time <= 0) this.finish(false, 'Время вышло');
  }
  onClick(x, y) {
    if (this.finished || state.mode !== 'play') return;
    const i = this.targets.findIndex(t => Math.hypot(t.x - x, t.y - y) <= t.r + 8);
    if (i >= 0) {
      const t = this.targets[i]; this.targets.splice(i, 1);
      this.hits++; this.score += 10 + Math.round(t.life); beep(900, .06);
    } else { this.misses++; this.score = Math.max(0, this.score - 4); beep(200, .08); }
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p);
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (const t of this.targets) {
      ctx.save(); ctx.globalAlpha = clamp(t.life, 0, 1);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff6b81'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * .68, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * .34, 0, 7); ctx.fill();
      ctx.restore();
    }
    this.edit(ctx, '🎯', 'Меткий тир', `Попади ${this.goal} раз за ${this.limit} секунд.`);
  }
  getHud() { return this.goalHud('🎯') + this.scoreHud() + this.pill('❌', this.misses) + this.timeHud(); }
}

/* ---------- Аркада 1: Бей кротов ---------- */
class WhackEngine extends GenreEngine {
  reset() {
    this.score = 0; this.lives = this.p.settings.lives || 3; this.hits = 0; this.misses = 0;
    this.time = this.limit; this.finished = false;
    this.holes = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
      this.holes.push({ x: W / 2 + (c - 1) * 170, y: 150 + r * 105 });
    this.active = -1; this.ttl = 0; this.wait = .4;
  }
  spawn() {
    this.active = Math.floor(rand(0, this.holes.length));
    this.ttl = rand(.8, 1.3) / this.dm.speed;
  }
  update(dt) {
    if (this.finished) return;
    this.time -= dt;
    if (this.active < 0) {
      this.wait -= dt; if (this.wait <= 0) this.spawn();
    } else {
      this.ttl -= dt;
      if (this.ttl <= 0) { this.active = -1; this.wait = rand(.15, .38); this.misses++; this.lives--; }
    }
    if (this.hits >= this.goal) this.finish(true, 'Все кроты пойманы!');
    else if (this.lives <= 0) this.finish(false, 'Слишком много промахов');
    else if (this.time <= 0) this.finish(false, 'Время вышло');
  }
  onClick(x, y) {
    if (this.finished || state.mode !== 'play') return;
    if (this.active >= 0) {
      const h = this.holes[this.active];
      if (Math.abs(x - h.x) < 56 && Math.abs(y - h.y + 8) < 34) {
        this.hits++; this.score += 10; this.active = -1; this.wait = rand(.12, .32);
        beep(760, .07); return;
      }
    }
    this.misses++; this.lives--; beep(180, .1);
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p);
    ctx.fillStyle = 'rgba(90,200,120,.14)'; ctx.fillRect(0, 60, W, H - 60);
    for (const h of this.holes) {
      ctx.fillStyle = '#3a2b22'; ctx.beginPath(); ctx.ellipse(h.x, h.y, 68, 38, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 3; ctx.stroke();
    }
    if (this.active >= 0) {
      const h = this.holes[this.active], rise = clamp(this.ttl * 3, 0, 1);
      drawEmoji(ctx, '🐹', h.x, h.y + 12 - rise * 30, 52);
    }
    this.edit(ctx, '🔨', 'Бей кротов', `Поймай ${this.goal} кротов. Промахи отнимают жизнь.`);
  }
  getHud() { return this.goalHud('🐹') + this.scoreHud() + this.heartHud() + this.timeHud(); }
}

/* ---------- Аркада 2: Бегун ---------- */
class RunnerEngine extends GenreEngine {
  reset() {
    this.score = 0; this.lives = this.p.settings.lives || 3; this.dist = 0; this.finished = false;
    this.goalMeters = Math.max(40, (this.p.settings.count || 10) * 10);
    this.hero = { x: 150, y: H - 100, vy: 0 }; this.onGround = true;
    this.things = []; this.spawn = 1;
  }
  update(dt) {
    if (this.finished) return;
    const s = this.spd;
    if ((pressed.Space || pressed.ArrowUp || pressed.KeyW) && this.onGround) {
      this.hero.vy = -520; this.onGround = false; beep(620, .07);
    }
    this.hero.vy += 1500 * dt; this.hero.y += this.hero.vy * dt;
    const floor = H - 72;
    if (this.hero.y > floor) { this.hero.y = floor; this.hero.vy = 0; this.onGround = true; }
    const speed = 270 * s;
    this.dist += speed * dt / 10;
    this.spawn -= dt;
    if (this.spawn <= 0) {
      const coin = Math.random() < .3;
      this.things.push({ x: W + 30, y: coin ? floor - 95 : floor - 26, coin });
      this.spawn = rand(.65, 1.2) / this.dm.traffic;
    }
    const heroBox = { x: this.hero.x - 18, y: this.hero.y - 28, w: 36, h: 56 };
    for (const o of this.things) {
      o.x -= speed * dt;
      if (!o.dead && aabb(heroBox, { x: o.x - 18, y: o.y - 18, w: 36, h: 36 })) {
        o.dead = true;
        if (o.coin) { this.score += 10; beep(1000, .05); }
        else { this.lives--; beep(160, .14); }
      }
    }
    this.things = this.things.filter(o => !o.dead && o.x > -40);
    if (this.dist >= this.goalMeters) this.finish(true, 'Дистанция пройдена!');
    else if (this.lives <= 0) this.finish(false, 'Герой устал');
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath(); ctx.arc((i * 220 - this.dist * 3) % (W + 300) - 100, H - 60, 90, Math.PI, 0); ctx.fill();
    }
    ctx.fillStyle = '#3f8f57'; ctx.fillRect(0, H - 72, W, 72);
    ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(0, H - 72, W, 4);
    for (const o of this.things) drawEmoji(ctx, o.coin ? '🪙' : '📦', o.x, o.y, 40);
    drawEmoji(ctx, this.p.settings.hero || '🏃', this.hero.x, this.hero.y, 50);
    this.edit(ctx, '🏃', 'Бегун', `Пробеги ${this.goalMeters} м, прыгая через коробки.`);
  }
  getHud() { return this.pill('🏁', Math.floor(this.dist) + '/' + this.goalMeters) + this.scoreHud() + this.heartHud(); }
}

/* ---------- Аркада 3: Быстрая реакция ---------- */
class ReactionEngine extends GenreEngine {
  reset() {
    this.score = 0; this.tries = this.p.settings.count || 10; this.finished = false;
    this.phase = 'wait'; this.timer = rand(.8, 1.8);
    this.rect = { x: W / 2 - 70, y: H / 2 - 39, w: 140, h: 78 }; this.last = 0;
  }
  newRound() {
    if (this.tries <= 0) { this.finish(this.score >= this.goal, 'Попытки закончились'); return; }
    this.phase = 'wait'; this.timer = rand(.9, 2.2);
    this.rect = { x: rand(70, W - 200), y: rand(80, H - 160), w: 140, h: 78 };
  }
  update(dt) {
    if (this.finished) return;
    this.timer -= dt;
    if (this.phase === 'wait' && this.timer <= 0) {
      this.phase = 'go'; this.timer = 1.2; this.last = performance.now(); beep(880, .08);
    } else if (this.phase === 'go' && this.timer <= 0) {
      this.tries--; this.newRound();
    }
  }
  onClick(x, y) {
    if (this.finished || state.mode !== 'play') return;
    const r = this.rect;
    const inside = x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
    if (this.phase === 'go' && inside) {
      const ms = Math.round(performance.now() - this.last);
      this.score += Math.max(1, Math.round(14 - ms / 70));
      beep(1050, .06); this.tries--; this.newRound();
    } else {
      this.score = Math.max(0, this.score - 5); this.tries--; beep(190, .12); this.newRound();
    }
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.textAlign = 'center';
    ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
    ctx.fillText(this.phase === 'go' ? 'ЖМИ СКОРЕЕ!' : 'Жди зелёную кнопку…', W / 2, 62);
    this.button(ctx, this.rect, this.phase === 'go' ? 'ЖМИ!' : '…',
      this.phase === 'go' ? '#38c172' : 'rgba(255,255,255,.18)');
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '14px "Trebuchet MS", sans-serif';
    ctx.fillText(`Осталось попыток: ${this.tries}`, W / 2, H - 24);
    this.edit(ctx, '⚡', 'Быстрая реакция', `Набери ${this.goal} очков за ${this.tries} попыток.`);
  }
  getHud() { return this.scoreHud() + this.pill('⚡', this.tries) + this.pill('🎯', this.goal); }
}

/* ---------- Стратегия 1: Защита замка ---------- */
class DefenseEngine extends GenreEngine {
  reset() {
    this.score = 0; this.lives = this.p.settings.lives || 3; this.hits = 0; this.finished = false;
    this.time = this.limit; this.gold = 24; this.spots = [];
    for (let i = 0; i < 4; i++) {
      this.spots.push({ x: 220 + i * 140, y: 120, cool: 0 });
      this.spots.push({ x: 220 + i * 140, y: H - 120, cool: 0 });
    }
    this.foes = []; this.spawn = 1.2; this.goldTimer = 0;
  }
  update(dt) {
    if (this.finished) return;
    this.goldTimer += dt;
    if (this.goldTimer >= 1) { this.goldTimer -= 1; this.gold += 1; }
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.foes.push({ x: W + 20, y: H / 2 + rand(-28, 28), hp: 3 + Math.floor(this.hits / 5) });
      this.spawn = rand(1.1, 2.0) / this.dm.traffic;
    }
    for (const f of this.foes) {
      f.x -= 34 * this.spd * dt;
      if (f.x < 58) { f.dead = true; this.lives--; beep(160, .16); }
    }
    for (const t of this.spots) {
      if (!t.tower) continue;
      t.cool -= dt;
      if (t.cool <= 0) {
        const target = this.foes.filter(f => !f.dead && Math.abs(f.x - t.x) < 150)
          .sort((a, b) => a.x - b.x)[0];
        if (target) {
          target.hp--; t.cool = .5; beep(700, .03);
          if (target.hp <= 0) { target.dead = true; this.hits++; this.score += 10; this.gold += 4; }
        }
      }
    }
    this.foes = this.foes.filter(f => !f.dead);
    this.time -= dt;
    if (this.hits >= this.goal) this.finish(true, 'Замок защищён!');
    else if (this.lives <= 0) this.finish(false, 'Замок захвачен');
    else if (this.time <= 0) this.finish(false, 'Время вышло');
  }
  onClick(x, y) {
    if (this.finished || state.mode !== 'play') return;
    const s = this.spots.find(s => !s.tower && Math.hypot(s.x - x, s.y - y) < 50);
    if (s && this.gold >= 14) {
      s.tower = true; s.cool = 0; this.gold -= 14; beep(560, .08);
    } else showToast('Нужно 14 монет и свободное место', 'warn');
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p, { top: '#4a8f57', bottom: '#265c39', motif: 'grid' });
    ctx.fillStyle = '#6b5b4a'; ctx.fillRect(0, H / 2 - 45, W, 90);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, H / 2 - 45, W, 3);
    for (const s of this.spots) {
      drawEmoji(ctx, s.tower ? '🗼' : '🌱', s.x, s.y, s.tower ? 44 : 24);
    }
    for (const f of this.foes) drawEmoji(ctx, '👾', f.x, f.y, 38);
    drawEmoji(ctx, '🏰', 48, H / 2, 74);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
    ctx.fillText('🪙 ' + this.gold, W / 2, 32);
    this.edit(ctx, '🏰', 'Защита замка', `Отрази ${this.goal} врагов. Башня стоит 14 монет.`);
  }
  getHud() { return this.goalHud('👾') + this.heartHud() + this.pill('🪙', this.gold) + this.timeHud(); }
}

/* ---------- Стратегия 2: Умная ферма ---------- */
class FarmEngine extends GenreEngine {
  reset() {
    this.score = 0; this.harvest = 0; this.finished = false; this.time = this.limit;
    this.water = 4; this.waterTimer = 0; this.plots = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++)
      this.plots.push({ x: W / 2 + (c - 1.5) * 130, y: 130 + r * 110, stage: 0, grow: 0 });
  }
  update(dt) {
    if (this.finished) return;
    this.waterTimer += dt;
    if (this.waterTimer >= 3) { this.waterTimer -= 3; this.water = Math.min(7, this.water + 1); }
    for (const p of this.plots) {
      if (p.stage === 2) { p.grow -= dt; if (p.grow <= 0) p.stage = 3; }
    }
    this.time -= dt;
    if (this.harvest >= this.goal) this.finish(true, 'Урожай собран!');
    else if (this.time <= 0) this.finish(false, 'Время вышло');
  }
  onClick(x, y) {
    if (this.finished || state.mode !== 'play') return;
    const p = this.plots.find(p => Math.abs(p.x - x) < 60 && Math.abs(p.y - y) < 48);
    if (!p) return;
    if (p.stage === 0) { p.stage = 1; beep(420, .05); }
    else if (p.stage === 1) {
      if (this.water > 0) { this.water--; p.stage = 2; p.grow = rand(3.2, 4.8) / this.dm.speed; beep(680, .05); }
      else showToast('Нет воды — подожди немного', 'warn');
    } else if (p.stage === 3) { p.stage = 0; this.harvest++; this.score += 10; beep(920, .07); }
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p, { top: '#79a85f', bottom: '#456f37', motif: 'leaves' });
    ctx.fillStyle = 'rgba(0,0,0,.08)';
    for (let i = 0; i < 20; i++) ctx.fillRect((i * 97) % W, (i * 53) % H, 4, 4);
    for (const p of this.plots) {
      ctx.fillStyle = '#6b4a32'; roundRect(ctx, p.x - 58, p.y - 44, 116, 88, 10); ctx.fill();
      ctx.strokeStyle = '#8b6447'; ctx.lineWidth = 3; ctx.stroke();
      if (p.stage === 1) drawEmoji(ctx, '🌱', p.x, p.y, 42);
      else if (p.stage === 2) drawEmoji(ctx, '🌿', p.x, p.y, 44);
      else if (p.stage === 3) drawEmoji(ctx, '🌾', p.x, p.y, 48);
    }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
    ctx.fillText('💧 ' + this.water, W / 2, 32);
    this.edit(ctx, '🌾', 'Умная ферма', `Собери ${this.goal} урожаев: посади, полей, собери.`);
  }
  getHud() { return this.goalHud('🌾') + this.scoreHud() + this.pill('💧', this.water) + this.timeHud(); }
}

/* ---------- Стратегия 3: Поединок героев ---------- */
class DuelEngine extends GenreEngine {
  reset() {
    this.maxHp = Math.max(40, (this.p.settings.lives || 3) * 30);
    this.hp = this.maxHp; this.enemyHp = Math.round(this.maxHp * 1.3); this.finished = false;
    this.guard = false; this.enemyGuard = false; this.turns = 0;
    this.msg = 'Выбирай действие!'; this.enemyTimer = 0;
    this.btns = [
      { x: W / 2 - 255, y: H - 72, w: 160, h: 48, label: '⚔️ Атака', k: 'attack' },
      { x: W / 2 - 80, y: H - 72, w: 160, h: 48, label: '🛡️ Защита', k: 'defend' },
      { x: W / 2 + 95, y: H - 72, w: 160, h: 48, label: '💚 Лечение', k: 'heal' }
    ];
  }
  act(k) {
    if (this.finished || state.mode !== 'play' || this.enemyTimer > 0) return;
    const dmg = Math.round(14 * this.spd);
    if (k === 'attack') {
      this.enemyHp -= this.enemyGuard ? Math.round(dmg / 2) : dmg;
      this.enemyGuard = false; this.msg = `Ты нанёс ${dmg} урона!`; beep(620, .07);
    } else if (k === 'defend') { this.guard = true; this.msg = 'Ты готов к защите'; beep(420, .06); }
    else if (k === 'heal') { this.hp = Math.min(this.maxHp, this.hp + 12); this.msg = 'Ты восстановил 12 HP'; beep(760, .09); }
    this.enemyTimer = .55; this.turns++;
  }
  onClick(x, y) {
    const b = this.btns.find(b => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h);
    if (b) this.act(b.k);
  }
  update(dt) {
    if (this.finished) return;
    if (this.enemyTimer > 0) {
      this.enemyTimer -= dt;
      if (this.enemyTimer <= 0) {
        const r = Math.random();
        if (r < .7) {
          const d = Math.round(14 * this.spd), real = this.guard ? Math.round(d / 2) : d;
          this.hp -= real; this.msg = `Враг атакует! −${real} HP`; this.guard = false; beep(220, .1);
        } else if (r < .9) { this.enemyGuard = true; this.msg = 'Враг защищается'; }
        else { this.enemyHp = Math.min(this.maxHp, this.enemyHp + 14); this.msg = 'Враг лечится'; }
        this.turns++;
      }
    }
    if (this.enemyHp <= 0) this.finish(true, 'Победа в поединке!');
    else if (this.hp <= 0) this.finish(false, 'Ты проиграл бой');
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p);
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(0, H - 110, W, 110);
    drawEmoji(ctx, '🧑', 180, 190, 110); drawEmoji(ctx, '👹', W - 180, 190, 110);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.fillText('Ты', 180, 268); ctx.fillText('Соперник', W - 180, 268);
    this.bar(ctx, 80, 290, 200, 14, this.hp / this.maxHp, '#38c172');
    this.bar(ctx, W - 280, 290, 200, 14, this.enemyHp / this.maxHp, '#ff6b81');
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px "Trebuchet MS", sans-serif';
    ctx.fillText(this.msg, W / 2, 340);
    ctx.font = '14px "Trebuchet MS", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.fillText(`Раунд ${this.turns}`, W / 2, 370);
    for (const b of this.btns) this.button(ctx, b, b.label);
    this.edit(ctx, '⚔️', 'Поединок героев', 'Атакуй, защищайся и лечись. Победи соперника!');
  }
  getHud() {
    return this.pill('❤️', Math.max(0, this.hp)) + this.pill('👹', Math.max(0, this.enemyHp)) +
      this.pill('🔄', this.turns);
  }
}

/* ---------- Экшен 1: Кулачный бой ---------- */
class BrawlEngine extends GenreEngine {
  reset() {
    this.score = 0; this.finished = false; this.time = this.limit;
    this.maxHp = Math.max(40, (this.p.settings.lives || 3) * 30);
    this.hp = this.maxHp; this.enemyHp = Math.round(this.maxHp * 1.25);
    this.hero = { x: 230, y: H - 100 }; this.enemy = { x: W - 230, y: H - 100, hitCd: 0 };
    this.face = 1; this.punchCd = 0; this.block = false;
  }
  update(dt) {
    if (this.finished) return;
    const s = 190 * this.spd;
    if (keys.ArrowLeft || keys.KeyA) { this.hero.x -= s * dt; this.face = -1; }
    if (keys.ArrowRight || keys.KeyD) { this.hero.x += s * dt; this.face = 1; }
    this.hero.x = clamp(this.hero.x, 60, W - 60);
    this.block = !!(keys.ArrowDown || keys.KeyS);
    this.punchCd -= dt;
    if ((pressed.Space || keys.Space) && this.punchCd <= 0) {
      this.punchCd = .55;
      if (Math.abs(this.hero.x - this.enemy.x) < 90) {
        this.enemyHp -= Math.round(14 * this.spd); this.score += 10;
        this.enemy.x += this.face * 25; beep(680, .07);
      } else beep(300, .03);
    }
    this.enemy.hitCd -= dt;
    const dir = Math.sign(this.hero.x - this.enemy.x);
    if (Math.abs(this.hero.x - this.enemy.x) > 62) this.enemy.x += dir * 90 * this.spd * dt;
    else if (this.enemy.hitCd <= 0) { this.enemy.hitCd = .8; this.hp -= this.block ? 6 : 14; beep(190, .12); }
    this.time -= dt;
    if (this.enemyHp <= 0) this.finish(true, 'Победа на ринге!');
    else if (this.hp <= 0) this.finish(false, 'Ты проиграл');
    else if (this.time <= 0) this.finish(this.enemyHp < this.hp, 'Время боя вышло');
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p);
    ctx.fillStyle = '#b86b3c'; roundRect(ctx, 40, H - 150, W - 80, 110, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.stroke();
    drawEmoji(ctx, '🥊', this.hero.x, this.hero.y, 64);
    drawEmoji(ctx, '👹', this.enemy.x, this.enemy.y, 66);
    if (this.block) drawEmoji(ctx, '🛡️', this.hero.x - this.face * 30, this.hero.y - 20, 30);
    this.bar(ctx, 60, 40, 250, 16, this.hp / this.maxHp, '#38c172');
    this.bar(ctx, W - 310, 40, 250, 16, this.enemyHp / this.maxHp, '#ff6b81');
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
    ctx.fillText('Ты', 185, 70); ctx.fillText('Соперник', W - 185, 70);
    this.edit(ctx, '🥊', 'Кулачный бой', `Победи соперника за ${this.limit} секунд. ↓ — блок.`);
  }
  getHud() { return this.scoreHud() + this.pill('❤️', Math.max(0, this.hp)) + this.timeHud(); }
}

/* ---------- Экшен 2: Оборона от зомби ---------- */
class ZombieEngine extends GenreEngine {
  reset() {
    this.score = 0; this.lives = this.p.settings.lives || 3; this.hits = 0;
    this.time = this.limit; this.finished = false;
    this.player = { x: W / 2, y: H - 60 };
    this.bullets = []; this.foes = []; this.spawn = .8; this.fire = 0;
  }
  update(dt) {
    if (this.finished) return;
    const p = this.player;
    if (keys.ArrowLeft || keys.KeyA) p.x -= 230 * dt;
    if (keys.ArrowRight || keys.KeyD) p.x += 230 * dt;
    if (keys.ArrowUp || keys.KeyW) p.y -= 150 * dt;
    if (keys.ArrowDown || keys.KeyS) p.y += 150 * dt;
    p.x = clamp(p.x, 26, W - 26); p.y = clamp(p.y, 110, H - 30);
    this.fire -= dt;
    if ((pressed.Space || keys.Space) && this.fire <= 0) {
      this.bullets.push({ x: p.x, y: p.y - 24 }); this.fire = .26; beep(600, .04);
    }
    for (const b of this.bullets) b.y -= 480 * dt;
    this.bullets = this.bullets.filter(b => b.y > -10);
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.foes.push({ x: rand(30, W - 30), y: -30, vx: rand(-30, 30) });
      this.spawn = rand(.45, .95) / this.dm.traffic;
    }
    for (const f of this.foes) {
      const a = Math.atan2(p.y - f.y, p.x - f.x);
      f.x += Math.cos(a) * 35 * this.spd * dt + f.vx * dt;
      f.y += Math.sin(a) * 58 * this.spd * dt;
      if (Math.hypot(f.x - p.x, f.y - p.y) < 36) { f.dead = true; this.lives--; beep(150, .16); }
      for (const b of this.bullets) {
        if (!b.dead && !f.dead && Math.hypot(b.x - f.x, b.y - f.y) < 26) {
          b.dead = true; f.dead = true; this.hits++; this.score += 10; beep(480, .06); break;
        }
      }
    }
    this.foes = this.foes.filter(f => !f.dead); this.bullets = this.bullets.filter(b => !b.dead);
    this.time -= dt;
    if (this.hits >= this.goal) this.finish(true, 'Зомби побеждены!');
    else if (this.lives <= 0) this.finish(false, 'Тебя окружили');
    else if (this.time <= 0) this.finish(false, 'Время вышло');
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p, { top: '#1c3525', bottom: '#0d1e18', motif: 'leaves' });
    for (let i = 0; i < 8; i++) drawEmoji(ctx, '🪦', (i * 113) % W, H - 30, 32);
    for (const f of this.foes) drawEmoji(ctx, '🧟', f.x, f.y, 40);
    ctx.fillStyle = this.p.settings.accent;
    for (const b of this.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 5, 0, 7); ctx.fill(); }
    drawEmoji(ctx, '🔫', this.player.x, this.player.y - 8, 30);
    drawEmoji(ctx, this.p.settings.hero || '🧍', this.player.x, this.player.y, 44);
    this.edit(ctx, '🧟', 'Оборона от зомби', `Победи ${this.goal} зомби за ${this.limit} секунд.`);
  }
  getHud() { return this.goalHud('🧟') + this.scoreHud() + this.heartHud() + this.timeHud(); }
}

/* ---------- Экшен 3: Спаси друзей ---------- */
class RescueEngine extends GenreEngine {
  reset() {
    this.score = 0; this.lives = this.p.settings.lives || 3; this.rescued = 0;
    this.time = this.limit; this.finished = false;
    this.hero = { x: W / 2, y: H / 2 };
    this.friends = []; this.fires = [];
    for (let i = 0; i < 3; i++) this.friends.push({ x: rand(70, W - 70), y: rand(80, H - 70) });
    for (let i = 0; i < 4; i++) this.fires.push({ x: rand(50, W - 50), y: rand(70, H - 50), a: rand(0, 6) });
    this.spawn = 2;
  }
  update(dt) {
    if (this.finished) return;
    const h = this.hero, s = 190 * this.spd;
    if (keys.ArrowLeft || keys.KeyA) h.x -= s * dt;
    if (keys.ArrowRight || keys.KeyD) h.x += s * dt;
    if (keys.ArrowUp || keys.KeyW) h.y -= s * dt;
    if (keys.ArrowDown || keys.KeyS) h.y += s * dt;
    h.x = clamp(h.x, 30, W - 30); h.y = clamp(h.y, 60, H - 30);
    for (let i = this.friends.length - 1; i >= 0; i--) {
      if (Math.hypot(this.friends[i].x - h.x, this.friends[i].y - h.y) < 28) {
        this.friends.splice(i, 1); this.rescued++; this.score += 25; beep(880, .08);
        this.friends.push({ x: rand(70, W - 70), y: rand(80, H - 70) });
      }
    }
    for (const f of this.fires) {
      f.a += dt;
      f.x = clamp(f.x + Math.cos(f.a) * 30 * dt, 40, W - 40);
      f.y = clamp(f.y + Math.sin(f.a * .7) * 25 * dt, 60, H - 40);
    }
    this.spawn -= dt;
    if (this.spawn <= 0) {
      this.fires.push({ x: rand(50, W - 50), y: rand(70, H - 50), a: rand(0, 6) });
      this.spawn = rand(1.8, 3) / this.dm.traffic;
    }
    for (const f of this.fires) {
      if (Math.hypot(f.x - h.x, f.y - h.y) < 40) {
        this.lives--; h.x = W / 2; h.y = H / 2; beep(170, .16); break;
      }
    }
    this.time -= dt;
    if (this.rescued >= this.goal) this.finish(true, 'Все друзья спасены!');
    else if (this.lives <= 0) this.finish(false, 'Слишком много ожогов');
    else if (this.time <= 0) this.finish(false, 'Время вышло');
  }
  draw(ctx) {
    drawBackdrop(ctx, this.p);
    ctx.fillStyle = 'rgba(90,200,120,.12)'; ctx.fillRect(0, 50, W, H - 50);
    for (let i = 0; i < 10; i++) drawEmoji(ctx, '🌳', (i * 97 + 30) % W, 80 + ((i * 61) % (H - 140)), 34);
    for (const f of this.friends) drawEmoji(ctx, '🧒', f.x, f.y, 42);
    for (const f of this.fires) drawEmoji(ctx, '🔥', f.x, f.y, 40);
    drawEmoji(ctx, this.p.settings.hero || '🦸', this.hero.x, this.hero.y, 50);
    this.edit(ctx, '🕊️', 'Спаси друзей', `Спаси ${this.goal} друзей и избегай огня.`);
  }
  getHud() { return this.goalHud('🧒') + this.scoreHud() + this.heartHud() + this.timeHud(); }
}


const MINI_EMOJI = {
  key: '🔑', lava: '🔥', enemy: '👾', exit: '🚪', rock: '🪨', fuel: '⛽',
  coin: '🪙', fish: '🐟', bombfish: '💣', energy: '🔋', leak: '💨', bot: '🤖'
};
/* Один общий движок для десяти новых аркадных режимов */
class MiniEngine extends BaseEngine {
  constructor(p) { super(p); this.kind = p.template; this.reset(); }
  reset() {
    const s = this.p.settings, d = diffOf(this.p);
    this.score = 0; this.time = 0; this.limit = s.seconds || 60;
    this.goal = Math.max(2, Math.round((s.target || 8) * (d.speed / 1.18)));
    this.hearts = s.lives || 2; this.finished = false; this.invuln = 0;
    this.shield = 0; this.magnet = 0; this.count = 0;
    this.player = { x: W / 2 - 13, y: H - 60, w: 26, h: 26 };
    this.ents = []; this.bullets = []; this.spawnT = 0; this.fireCd = 0;
    this.data = {};
    this.setup();
  }
  add(kind, x, y, w = 24, h = 24, extra = {}) {
    const e = Object.assign({ kind, x, y, w, h, dead: false, vx: 0, vy: 0 }, extra);
    this.ents.push(e);
    return e;
  }
  setup() {
    switch (this.kind) {
      case 'mazelava': {
        this.player.x = 24; this.player.y = 24;
        [[80, 120, 220, 26], [400, 120, 220, 26], [220, 250, 220, 26],
         [560, 250, 180, 26], [90, 370, 200, 26], [430, 370, 250, 26]]
          .forEach(r => this.add('wall', r[0], r[1], r[2], r[3]));
        const spots = [[60, 55], [340, 55], [680, 55], [60, 190], [340, 190], [690, 190],
          [60, 315], [340, 315], [690, 315], [60, 410], [340, 410], [690, 410]];
        this.goal = Math.min(this.goal, spots.length);
        for (let i = 0; i < this.goal; i++) this.add('key', spots[i][0], spots[i][1]);
        [[180, 200], [520, 200], [300, 330], [640, 330], [180, 420], [520, 420]]
          .forEach(v => this.add('lava', v[0], v[1], 34, 26));
        break;
      }
      case 'bomber': {
        this.player.x = CELL + 4; this.player.y = CELL + 4;
        for (let y = 1; y < ROWS - 1; y++) {
          for (let x = 1; x < COLS - 1; x++) {
            if ((x <= 3 && y <= 3) || (x >= COLS - 4 && y >= ROWS - 4)) continue;
            if (x % 2 === 0 && y % 2 === 0) this.add('solid', x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
            else if ((x * 7 + y * 11) % 5 < 2) this.add('brick', x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4);
          }
        }
        this.goal = Math.max(2, Math.min(this.goal, this.ents.filter(e => e.kind === 'brick').length));
        for (let i = 0; i < 3; i++) this.add('enemy', 360 + i * 130, 110, 26, 26, { vx: i % 2 ? -50 : 50 });
        this.data.bombs = [];
        this.add('exit', W - CELL - 6, H - CELL - 6, 28, 28);
        break;
      }
      case 'towerdef': {
        this.data.path = [[0, 110], [220, 110], [220, 300], [500, 300], [500, 150], [W, 150]];
        this.data.wave = this.goal + 4; this.data.spawned = 0; this.data.towers = [];
        this.spawnT = 0.5;
        break;
      }
      case 'survival': { this.player.y = H - 46; this.spawnT = 0.4; break; }
      case 'airfight': { this.spawnT = 0.4; break; }
      case 'hockey': {
        this.player.x = 40; this.player.y = H / 2 - 20;
        this.data.puck = { x: W / 2, y: H / 2, vx: 180, vy: 80, w: 16, h: 16 };
        this.data.aiY = H / 2 - 24;
        break;
      }
      case 'fisher': {
        this.player.y = 20; this.data.hookY = 20; this.data.hookDown = false;
        for (let i = 0; i < 6; i++) this.add('fish', rand(40, W - 60), rand(H - 120, H - 40), 26, 20, { vx: rand(-70, 70) });
        for (let i = 0; i < 2; i++) this.add('bombfish', rand(40, W - 60), rand(H - 120, H - 40), 24, 24, { vx: rand(-50, 50) });
        break;
      }
      case 'gardener': {
        this.data.plots = [];
        for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) this.data.plots.push({ x: 140 + c * 104, y: 70 + r * 112, state: 0, t: 0 });
        this.data.weedT = 5;
        break;
      }
      case 'station': { this.data.oxygen = this.limit * 0.55; this.spawnT = 0.5; break; }
      case 'royale': {
        this.player.x = W / 2 - 13; this.player.y = H / 2 - 13;
        this.goal = Math.min(this.goal, 7);
        for (let i = 0; i < this.goal; i++) this.add('bot', rand(60, W - 60), rand(60, H - 60), 26, 26, { vx: rand(-70, 70), vy: rand(-70, 70) });
        this.data.zone = Math.min(W, H) / 2 - 20;
        break;
      }
    }
  }
  movePlayer(dt, spd) {
    let vx = 0, vy = 0;
    if (keys.ArrowLeft || keys.KeyA) vx = -1;
    else if (keys.ArrowRight || keys.KeyD) vx = 1;
    if (keys.ArrowUp || keys.KeyW) vy = -1;
    else if (keys.ArrowDown || keys.KeyS) vy = 1;
    const h = this.player;
    h.x = clamp(h.x + vx * spd * dt, 6, W - h.w - 6);
    h.y = clamp(h.y + vy * spd * dt, 6, H - h.h - 6);
    if (this.magnet > 0) {
      const collectible = ['coin', 'gem', 'key', 'fish', 'energy', 'fuel', 'crop'];
      for (const e of this.ents) {
        if (e.dead || collectible.indexOf(e.kind) === -1) continue;
        const dx = h.x + h.w / 2 - (e.x + e.w / 2), dy = h.y + h.h / 2 - (e.y + e.h / 2);
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 130) { e.x += dx / dist * 170 * dt; e.y += dy / dist * 170 * dt; }
      }
    }
  }
  collect(e, points, coins) {
    if (e.dead) return;
    e.dead = true; this.score += points; this.count++;
    if (coins) addCoins(coins);
    beep(880, .08); FX.burst(e.x + e.w / 2, e.y + e.h / 2, '#ffd166', 6);
    if (this.count >= this.goal) this.win('Цель достигнута! Ты молодец! 🎉');
  }
  hurt() {
    if (this.finished || this.invuln > 0 || this.shield > 0) return;
    this.hearts--; this.invuln = 1; beep(220, .16);
    if (this.hearts <= 0) { this.finish(false, 'Не хватило жизней. Попробуй ещё раз!'); return; }
    showToast('Ой! −1 жизнь 💔', 'warn');
  }
  win(msg) { this.finish(true, msg); }
  finish(win, msg) { this.finished = true; this.onFinish(win, msg); }
  onClick(x, y) {
    if (this.kind === 'towerdef') {
      if (this.data.towers.length >= 6) { showToast('Можно построить не больше 6 башен 🏹', 'warn'); return; }
      if (this.data.towers.some(t => Math.hypot(t.x - x, t.y - y) < 55)) { showToast('Здесь уже есть башня', 'warn'); return; }
      this.data.towers.push({ x, y, cd: .2 }); beep(520, .1); FX.burst(x, y, '#5ac8fa', 8);
      showToast('🏹 Башня построена!', 'ok');
    } else if (this.kind === 'gardener') {
      const pl = this.data.plots.find(q => x >= q.x && x <= q.x + 42 && y >= q.y && y <= q.y + 42);
      if (!pl) return;
      if (pl.state === 0) { pl.state = 1; beep(520, .06); showToast('🌱 Семечко посажено', 'ok'); }
      else if (pl.state === 1) { pl.state = 2; pl.t = 0; beep(620, .06); showToast('💧 Полито! Жди урожай', 'ok'); }
      else if (pl.state === 3) {
        pl.state = 0; this.score += 30; this.count++; addCoins(3);
        beep(880, .1); FX.burst(pl.x + 20, pl.y + 20, '#ffd166', 8);
        if (this.count >= this.goal) this.win('Сад расцвёл! Ты собрал весь урожай 🌻');
      } else if (pl.state === 4) { pl.state = 0; this.score += 10; beep(600, .06); showToast('🌿 Сорняк убран!', 'ok'); }
    } else if (this.kind === 'station') {
      for (const e of this.ents) {
        if (e.dead) continue;
        if (!(x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h)) continue;
        if (e.kind === 'energy') { this.data.oxygen = Math.min(this.limit, this.data.oxygen + 14); this.collect(e, 20, 2); }
        else if (e.kind === 'leak') { e.dead = true; this.score += 10; beep(600, .07); showToast('🔧 Течь заделана!', 'ok'); }
      }
    }
  }
  update(dt) {
    if (this.finished) return;
    const s = this.p.settings, d = diffOf(this.p), spd = 210 * s.speed * d.speed;
    this.time += dt; this.invuln = Math.max(0, this.invuln - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    if (this.limit && this.time >= this.limit && this.kind !== 'station') { this.finish(false, 'Время вышло! Попробуй быстрее ⏱'); return; }

    switch (this.kind) {
      case 'mazelava': {
        const px = this.player.x, py = this.player.y;
        this.movePlayer(dt, spd * .9);
        for (const e of this.ents) {
          if (e.dead || e.kind !== 'wall') continue;
          if (aabb(this.player, e)) { this.player.x = px; this.player.y = py; break; }
        }
        for (const e of this.ents) {
          if (e.dead) continue;
          if (e.kind === 'key' && aabb(this.player, e)) this.collect(e, 20, 2);
          else if (e.kind === 'lava' && aabb(this.player, e)) this.hurt();
        }
        break;
      }
      case 'bomber': {
        const px = this.player.x, py = this.player.y;
        this.movePlayer(dt, spd * .9);
        for (const e of this.ents) {
          if (e.dead || ['wall', 'solid', 'brick'].indexOf(e.kind) === -1) continue;
          if (aabb(this.player, e)) { this.player.x = px; this.player.y = py; break; }
        }
        if (pressed.Space && this.data.bombs.length < 3) {
          this.data.bombs.push({ x: Math.floor((this.player.x + 13) / CELL) * CELL + 4,
            y: Math.floor((this.player.y + 13) / CELL) * CELL + 4, t: 1.6 });
          beep(300, .08);
        }
        for (const b of this.data.bombs) {
          b.t -= dt;
          if (b.t > 0) continue;
          b.done = true;
          for (const e of this.ents) {
            if (e.dead || ['brick', 'enemy'].indexOf(e.kind) === -1) continue;
            if (Math.abs(e.x - b.x) < CELL * 1.3 && Math.abs(e.y - b.y) < CELL * 1.3) {
              e.dead = true; FX.burst(e.x + 12, e.y + 12, '#ff9f43', 10);
              if (e.kind === 'brick') { this.score += 10; this.count++; addCoins(1); }
              else this.score += 50;
            }
          }
          if (Math.abs(this.player.x - b.x) < CELL && Math.abs(this.player.y - b.y) < CELL) this.hurt();
        }
        this.data.bombs = this.data.bombs.filter(b => !b.done);
        if (this.count >= this.goal) {
          const exit = this.ents.find(e => e.kind === 'exit' && !e.dead);
          if (exit && aabb(this.player, exit)) { this.win('Все кирпичи разрушены, и ты нашёл выход!'); break; }
        }
        for (const e of this.ents) if (!e.dead && e.kind === 'enemy' && aabb(this.player, e)) this.hurt();
        break;
      }
      case 'towerdef': {
        this.spawnT -= dt;
        if (this.spawnT <= 0 && this.data.spawned < this.data.wave) {
          this.data.spawned++;
          this.add('enemy', -30, rand(90, 310), 26, 26, { hp: 2, vx: 55 * d.speed });
          this.spawnT = 1.5 / d.traffic;
        }
        const path = this.data.path;
        for (const e of this.ents) {
          if (e.dead || e.kind !== 'enemy') continue;
          e.x += e.vx * dt;
          let targetY = path[path.length - 1][1];
          for (let i = 0; i < path.length - 1; i++) {
            const a = path[i], b = path[i + 1];
            if (e.x >= Math.min(a[0], b[0]) && e.x <= Math.max(a[0], b[0])) {
              const t = (e.x - a[0]) / ((b[0] - a[0]) || 1);
              targetY = a[1] + (b[1] - a[1]) * t; break;
            }
          }
          e.y += (targetY - e.y) * Math.min(1, dt * 3);
          if (e.x > W + 20) { e.dead = true; this.hurt(); }
        }
        for (const tw of this.data.towers) {
          tw.cd -= dt;
          if (tw.cd > 0) continue;
          let best = null, bd = 1e9;
          for (const e of this.ents) {
            if (e.dead || e.kind !== 'enemy') continue;
            const dd = Math.hypot(e.x - tw.x, e.y - tw.y);
            if (dd < bd) { bd = dd; best = e; }
          }
          if (best && bd < 230) {
            this.bullets.push({ x: tw.x, y: tw.y, vx: 0, vy: 0, target: best, life: 1.2, homing: true });
            tw.cd = .6 / d.speed; beep(640, .04);
          }
        }
        for (const b of this.bullets) {
          if (!b.homing) continue;
          b.life -= dt;
          if (!b.target || b.target.dead || b.life <= 0) { b.life = 0; continue; }
          const dx = b.target.x + 13 - b.x, dy = b.target.y + 13 - b.y, dd = Math.hypot(dx, dy) || 1;
          if (dd < 16) {
            b.target.dead = true; b.life = 0; this.score += 25; this.count++; addCoins(1);
            FX.burst(b.target.x, b.target.y, '#5ac8fa', 8);
          } else { b.x += dx / dd * 350 * dt; b.y += dy / dd * 350 * dt; }
        }
        if (this.data.spawned >= this.data.wave && !this.ents.some(e => !e.dead && e.kind === 'enemy')) this.win('Крепость устояла! 🏰');
        break;
      }
      case 'survival': {
        this.movePlayer(dt, spd);
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnT = Math.max(.28, .8 / d.speed);
          if (Math.random() < .32) this.add('fuel', rand(40, W - 40), -20, 24, 24, { vy: 120 });
          else this.add('rock', rand(30, W - 50), -30, 28, 28, { vy: 155 * d.speed });
        }
        for (const e of this.ents) {
          if (e.dead) continue;
          e.y += (e.vy || 0) * dt;
          if (aabb(this.player, e)) {
            if (e.kind === 'fuel') this.collect(e, 20, 2);
            else { e.dead = true; this.hurt(); }
          }
        }
        break;
      }
      case 'airfight': {
        this.movePlayer(dt, spd);
        if (keys.Space && this.fireCd <= 0) {
          this.fireCd = .24 / d.speed;
          this.bullets.push({ x: this.player.x + 8, y: this.player.y - 6, vx: 0, vy: -430, life: 1.4 });
          beep(720, .04);
        }
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnT = Math.max(.4, 1.1 / d.speed);
          this.add('enemy', rand(30, W - 50), -30, 28, 26, { vy: 85 * d.speed, vx: rand(-30, 30) });
        }
        if (Math.random() < dt * .25) this.add('coin', rand(30, W - 40), rand(60, H - 80), 22, 22, { vy: 20 });
        for (const e of this.ents) {
          if (e.dead) continue;
          e.y += (e.vy || 0) * dt; e.x += (e.vx || 0) * dt;
          if (e.y > H + 30) { e.dead = true; this.hurt(); continue; }
          if (e.kind === 'coin' && aabb(this.player, e)) this.collect(e, 15, 2);
          else if (e.kind === 'enemy' && aabb(this.player, e)) { e.dead = true; this.hurt(); }
        }
        for (const b of this.bullets) {
          b.x += b.vx * dt; b.y += b.vy * dt;
          for (const e of this.ents) {
            if (e.dead || e.kind !== 'enemy') continue;
            if (aabb({ x: b.x - 4, y: b.y - 4, w: 8, h: 8 }, e)) {
              e.dead = true; b.life = 0; this.score += 50; this.count++; addCoins(2);
              FX.burst(e.x, e.y, '#ff6b81', 8);
              if (this.count >= this.goal) this.win('Все вражеские самолёты сбиты! ✈️');
            }
          }
        }
        break;
      }
      case 'hockey': {
        const h = this.player;
        let vy = 0;
        if (keys.ArrowUp || keys.KeyW) vy = -1;
        else if (keys.ArrowDown || keys.KeyS) vy = 1;
        h.y = clamp(h.y + vy * spd * dt, 20, H - h.h - 20);
        const puck = this.data.puck;
        puck.x += puck.vx * dt; puck.y += puck.vy * dt;
        if (puck.y < 20 || puck.y > H - 36) puck.vy *= -1;
        if (puck.x < h.x + h.w && puck.x + puck.w > h.x && puck.y < h.y + h.h && puck.y + puck.h > h.y) {
          puck.x = h.x + h.w; puck.vx = Math.abs(puck.vx) + 20; puck.vy += rand(-70, 70); beep(520, .05);
        }
        this.data.aiY += (puck.y - this.data.aiY) * Math.min(1, dt * 2.2 * d.speed);
        const ai = { x: W - 44, y: this.data.aiY, w: 14, h: 48 };
        if (puck.x + puck.w > ai.x && puck.x < ai.x + ai.w && puck.y < ai.y + ai.h && puck.y + puck.h > ai.y) {
          puck.x = ai.x - puck.w; puck.vx = -(Math.abs(puck.vx) + 20); beep(440, .05);
        }
        if (puck.x > W) {
          this.count++; this.score += 100; addCoins(3); beep(880, .14);
          showToast('🏒 Гол! +3 коина', 'ok');
          this.data.puck = { x: W / 2, y: H / 2, vx: -180, vy: rand(-80, 80), w: 16, h: 16 };
          if (this.count >= this.goal) this.win('Ты забил все шайбы! 🏒');
        }
        if (puck.x < -20) {
          this.hurt();
          this.data.puck = { x: W / 2, y: H / 2, vx: 180, vy: rand(-80, 80), w: 16, h: 16 };
        }
        break;
      }
      case 'fisher': {
        let vx = 0;
        if (keys.ArrowLeft || keys.KeyA) vx = -1;
        else if (keys.ArrowRight || keys.KeyD) vx = 1;
        this.player.x = clamp(this.player.x + vx * spd * dt, 10, W - 36);
        if (pressed.Space && !this.data.hookDown) { this.data.hookDown = true; beep(420, .06); }
        if (this.data.hookDown) {
          this.data.hookY += 340 * dt;
          if (this.data.hookY > H - 30) this.data.hookDown = false;
        } else this.data.hookY += (22 - this.data.hookY) * Math.min(1, dt * 4);
        const hook = { x: this.player.x + 8, y: this.data.hookY, w: 12, h: 12 };
        for (const e of this.ents) {
          if (e.dead) continue;
          e.x += (e.vx || 0) * dt;
          if (e.x < 10 || e.x > W - 30) e.vx *= -1;
          if (aabb(hook, e)) {
            e.dead = true;
            if (e.kind === 'fish') this.collect(e, 25, 2);
            else { this.hurt(); this.data.hookDown = false; }
          }
        }
        if (this.ents.filter(e => !e.dead && e.kind === 'fish').length < 5)
          this.add('fish', rand(40, W - 60), rand(H - 110, H - 40), 26, 20, { vx: rand(-70, 70) });
        break;
      }
      case 'gardener': {
        for (const pl of this.data.plots) {
          if (pl.state === 2) {
            pl.t += dt;
            if (pl.t > 3) { pl.state = 3; FX.burst(pl.x + 20, pl.y + 20, '#38c172', 6); }
          } else if (pl.state === 4) {
            pl.t += dt;
            if (pl.t > 7) { pl.state = 0; this.hurt(); }
          }
        }
        this.data.weedT -= dt;
        if (this.data.weedT <= 0) {
          this.data.weedT = Math.max(3.5, 7 / d.speed);
          const free = this.data.plots.filter(pl => pl.state === 0);
          if (free.length) { const pl = free[Math.floor(Math.random() * free.length)]; pl.state = 4; pl.t = 0; }
        }
        break;
      }
      case 'station': {
        this.data.oxygen -= dt * (1 + .25 * (d.speed - 1));
        if (this.data.oxygen <= 0) { this.data.oxygen = 16; this.hurt(); }
        this.spawnT -= dt;
        if (this.spawnT <= 0) {
          this.spawnT = Math.max(.5, 1.4 / d.speed);
          if (Math.random() < .6) this.add('energy', rand(40, W - 40), rand(40, H - 40));
          else this.add('leak', rand(40, W - 40), rand(40, H - 40), 26, 26);
        }
        for (const e of this.ents) {
          if (e.dead || e.kind !== 'leak') continue;
          e.t = (e.t || 0) + dt;
          if (e.t > 7) { e.dead = true; this.hurt(); }
        }
        break;
      }
      case 'royale': {
        this.movePlayer(dt, spd * .95);
        this.data.zone = Math.max(55, this.data.zone - 9 * dt * d.speed);
        const cx = W / 2, cy = H / 2;
        if (Math.hypot(this.player.x + 13 - cx, this.player.y + 13 - cy) > this.data.zone) this.hurt();
        if (keys.Space && this.fireCd <= 0) {
          this.fireCd = .35 / d.speed;
          const bots = this.ents.filter(e => !e.dead && e.kind === 'bot');
          bots.sort((a, b) => Math.hypot(a.x - this.player.x, a.y - this.player.y) -
                              Math.hypot(b.x - this.player.x, b.y - this.player.y));
          const bot = bots[0];
          if (bot) {
            const dx = bot.x - this.player.x, dy = bot.y - this.player.y, dd = Math.hypot(dx, dy) || 1;
            this.bullets.push({ x: this.player.x + 13, y: this.player.y + 13, vx: dx / dd * 410, vy: dy / dd * 410, life: 1.2 });
            beep(700, .04);
          }
        }
        for (const e of this.ents) {
          if (e.dead || e.kind !== 'bot') continue;
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.x < 10 || e.x > W - 36) e.vx *= -1;
          if (e.y < 10 || e.y > H - 36) e.vy *= -1;
          if (Math.hypot(e.x + 13 - cx, e.y + 13 - cy) > this.data.zone) {
            e.t = (e.t || 0) + dt;
            if (e.t > 3) { e.dead = true; this.score += 50; this.count++; addCoins(2); }
          }
          if (aabb(e, this.player)) this.hurt();
        }
        for (const b of this.bullets) {
          b.x += b.vx * dt; b.y += b.vy * dt;
          for (const e of this.ents) {
            if (e.dead || e.kind !== 'bot') continue;
            if (aabb({ x: b.x - 5, y: b.y - 5, w: 10, h: 10 }, e)) {
              e.dead = true; b.life = 0; this.score += 50; this.count++; addCoins(2);
              FX.burst(e.x, e.y, '#ff6b81', 8);
              if (this.count >= this.goal) this.win('Ты победил всех соперников! 👑');
            }
          }
        }
        break;
      }
    }
    this.ents = this.ents.filter(e => !e.dead);
    this.bullets = this.bullets.filter(b => b.life > 0 && b.x > -40 && b.x < W + 40 && b.y > -40 && b.y < H + 40);
  }
  draw(ctx) {
    const motif = (this.kind === 'station' || this.kind === 'royale' || this.kind === 'airfight') ? 'stars'
      : (this.kind === 'gardener' || this.kind === 'fisher' || this.kind === 'mazelava') ? 'leaves' : 'dots';
    drawBackdrop(ctx, this.p, { motif });
    if (this.kind === 'towerdef') {
      ctx.save(); ctx.setLineDash([8, 8]); ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(255,255,255,.14)';
      ctx.beginPath(); this.data.path.forEach((pt, i) => i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])); ctx.stroke(); ctx.restore();
      for (const t of this.data.towers) drawEmoji(ctx, '🏹', t.x, t.y, 28);
    }
    if (this.kind === 'bomber') {
      for (const b of this.data.bombs) {
        const pulse = 1 + Math.sin(visualClock * 14) * .12;
        drawEmoji(ctx, '💣', b.x + 12, b.y + 12, 24 * pulse);
      }
    }
    if (this.kind === 'fisher') {
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(this.player.x + 13, 20); ctx.lineTo(this.player.x + 13, this.data.hookY); ctx.stroke(); ctx.restore();
      drawEmoji(ctx, '🪝', this.player.x + 13, this.data.hookY, 20);
    }
    if (this.kind === 'gardener') {
      for (const pl of this.data.plots) {
        roundRect(ctx, pl.x, pl.y, 42, 42, 8);
        ctx.fillStyle = pl.state === 2 ? '#7d5a3c' : '#9b6b45'; ctx.fill();
        const em = ['', '🌰', '💧', '🌻', '🌿'][pl.state] || '';
        if (em) drawEmoji(ctx, em, pl.x + 21, pl.y + 21, 26);
      }
    }
    if (this.kind === 'station') {
      const pct = clamp(this.data.oxygen / (this.limit || 60), 0, 1);
      ctx.save();
      roundRect(ctx, 22, 18, 240, 18, 9); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fill();
      roundRect(ctx, 22, 18, 240 * pct, 18, 9); ctx.fillStyle = pct < .3 ? '#ff6b81' : '#38c172'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('КИСЛОРОД', 28, 32); ctx.restore();
    }
    if (this.kind === 'royale') {
      ctx.save(); ctx.strokeStyle = '#ff6b81'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(W / 2, H / 2, this.data.zone, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    if (this.kind === 'hockey') {
      const puck = this.data.puck;
      drawEmoji(ctx, '🥅', 14, H / 2, 54); drawEmoji(ctx, '🥅', W - 14, H / 2, 54);
      drawEmoji(ctx, '🧤', W - 37, this.data.aiY + 24, 38);
      ctx.save(); ctx.fillStyle = '#1d2340'; ctx.beginPath();
      ctx.arc(puck.x + 8, puck.y + 8, 9, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    for (const e of this.ents) {
      if (e.dead) continue;
      if (e.kind === 'wall' || e.kind === 'solid' || e.kind === 'brick') {
        roundRect(ctx, e.x, e.y, e.w, e.h, 5);
        ctx.fillStyle = e.kind === 'brick' ? '#b5653a' : shade(this.p.settings.bg, 48);
        ctx.fill();
        if (e.kind === 'brick') drawEmoji(ctx, '🧱', e.x + e.w / 2, e.y + e.h / 2, 18);
        continue;
      }
      drawEmoji(ctx, MINI_EMOJI[e.kind] || '❓', e.x + e.w / 2, e.y + e.h / 2, e.w < 20 ? 18 : 26);
    }
    for (const b of this.bullets) {
      ctx.save(); ctx.fillStyle = b.homing ? '#5ac8fa' : '#ffd166';
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.homing ? 5 : 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (this.kind !== 'gardener' && this.kind !== 'station' && this.kind !== 'towerdef') {
      if (this.invuln <= 0 || Math.floor(this.time * 12) % 2 === 0) {
        drawEmoji(ctx, this.p.settings.hero, this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, 28);
      }
    }
  }
  getHud() {
    let progress = `🎯 ${this.count}/${this.goal}`;
    if (this.kind === 'station') progress = `🫧 ${Math.ceil(this.data.oxygen)} с · 🎯 ${this.count}/${this.goal}`;
    else if (this.kind === 'hockey') progress = `🏒 ${this.count}/${this.goal}`;
    else if (this.limit) progress += ` · ⏱ ${Math.max(0, Math.ceil(this.limit - this.time))} с`;
    return `<span class="hud-pill">♥ ${'♥'.repeat(Math.max(0, this.hearts))}</span>` +
           `<span class="hud-pill">⭐ ${this.score}</span>` +
           `<span class="hud-pill">🪙 ${getCoins()}</span>` +
           `<span class="hud-pill">${progress}</span>`;
  }
}

function makeEngine(p) {
  normalizeProgress(p);
  let e;
  if (p.template === 'platformer') e = new PlatformerEngine(p);
  else if (p.template === 'runnerhuman') e = new RunnerHumanEngine(p);
  else if (p.template === 'collector') e = new CollectorEngine(p);
  else if (p.template === 'racer') e = new RacerEngine(p);
  else if (p.template === 'catcher') e = new CatcherEngine(p);
  else if (p.template === 'snake') e = new SnakeEngine(p);
  else if (p.template === 'pong') e = new PongEngine(p);
  else if (p.template === 'arkanoid') e = new ArkanoidEngine(p);
  else if (p.template === 'shooter') e = new ShooterEngine(p);
  else if (p.template === 'tictactoe') e = new TicTacToeEngine(p);
  else if (p.template === 'memory') e = new MemoryEngine(p);
  else if (p.template === 'math') e = new MathEngine(p);
  else if (p.template === 'starraid') e = new StarRaidEngine(p);
  else if (p.template === 'tank') e = new BattleCityEngine(p);
  else if (p.template === 'range') e = new RangeEngine(p);
  else if (p.template === 'whack') e = new WhackEngine(p);
  else if (p.template === 'runner') e = new RunnerEngine(p);
  else if (p.template === 'reaction') e = new ReactionEngine(p);
  else if (p.template === 'defense') e = new DefenseEngine(p);
  else if (p.template === 'farm') e = new FarmEngine(p);
  else if (p.template === 'duel') e = new DuelEngine(p);
  else if (p.template === 'brawl') e = new BrawlEngine(p);
  else if (p.template === 'zombie') e = new ZombieEngine(p);
  else if (p.template === 'rescue') e = new RescueEngine(p);
  else if (MINI_IDS.includes(p.template)) e = new MiniEngine(p);
  else e = new QuizEngine(p, $('#interactiveLayer'));
  normalizeProgress(p);
  let rewarded = false;
  const baseReset = e.reset.bind(e);
  e.reset = () => { rewarded = false; baseReset(); };
  const baseFinish = e.onFinish;
  e.onFinish = (win, msg) => {
    if (win && !rewarded) {
      rewarded = true;
      const first = !p.firstWin;
      p.firstWin = true;
      addCoins(10 + (first ? 10 : 0), first ? 'первая победа!' : 'победа!');
      const mission = currentMission(p);
      if (!p.missions[p.template] && missionDone(p, e, true)) {
        p.missions[p.template] = true;
        addCoins(mission.reward, 'задание выполнено! 📋');
      }
      saveProject(true);
      renderMission();
    }
    baseFinish(win, msg);
  };
  return e;
}

/* ---------- Галерея ---------- */
function renderGallery() {
  $('#templateCards').innerHTML = Object.values(TEMPLATES).map(t => `
    <article class="card tpl-card" style="--tpl:${t.color}">
      <div class="card-emoji">${t.emoji}</div>
      <div class="card-body">
        <span class="card-tag">${t.tag}</span>
        <h4>${t.title}</h4>
        <p>${t.desc}</p>
        <ul class="feature-list">${t.features.map(f => `<li>✓ ${f}</li>`).join('')}</ul>
      </div>
      <button class="btn btn-card" data-create="${t.id}">Создать игру →</button>
    </article>`).join('');
  renderPublished();
  renderSaved();
}
function renderPublished() {
  const list = loadPublished().sort((a, b) => b.publishedAt - a.publishedAt);
  const box = $('#publishedCards');
  if (!box) return;
  if (!list.length) {
    box.innerHTML = `<div class="empty-state"><span class="empty-emoji">🌟</span>
      <b>Галерея пока пуста</b><br>Нажми «🚀 Поделиться» в редакторе и выбери «Опубликовать в галерее».</div>`;
    return;
  }
  box.innerHTML = list.map(p => {
    const t = TEMPLATES[p.template] || TEMPLATES.platformer;
    const date = new Date(p.publishedAt || p.updatedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short' });
    return `<article class="card published-card" style="--tpl:${t.color}">
      <div class="card-emoji">${t.emoji}</div>
      <span class="card-tag">${t.tag} · 🪙 ${getCoins(p)} · ${date}</span>
      <h4>${esc(p.name)}</h4>
      <div class="saved-actions">
        <button class="btn btn-small btn-primary" data-pub-open="${esc(p.id)}">▶ Открыть</button>
        <button class="btn btn-small btn-ghost" data-pub-del="${esc(p.id)}">🗑 Убрать</button>
      </div>
    </article>`;
  }).join('');
}
function renderSaved() {
  const list = loadProjects().sort((a, b) => b.updatedAt - a.updatedAt);
  const box = $('#savedCards');
  if (!list.length) {
    box.innerHTML = `<div class="empty-state"><span class="empty-emoji">🎨</span>
      <b>Здесь пока пусто</b><br>Выбери шаблон выше — и твоя первая игра появится здесь.</div>`;
    return;
  }
  box.innerHTML = list.map(p => {
    const t = TEMPLATES[p.template] || TEMPLATES.platformer;
    const date = new Date(p.updatedAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return `<article class="card saved-card" style="--tpl:${t.color}">
      <div class="card-emoji">${t.emoji}</div>
      <span class="card-tag">${t.tag} · 🪙 ${getCoins(p)}</span>
      <h4>${esc(p.name)}</h4>
      <div class="saved-date">🕒 ${date}</div>
      <div class="saved-actions">
        <button class="btn btn-small btn-primary" data-open="${esc(p.id)}">✏️ Открыть</button>
        <button class="btn btn-small btn-ghost" data-del="${esc(p.id)}">🗑 Удалить</button>
      </div>
    </article>`;
  }).join('');
}
function showScreen(name) {
  state.screen = name;
  $('#screenGallery').classList.toggle('is-active', name === 'gallery');
  $('#screenEditor').classList.toggle('is-active', name === 'editor');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openEditor(project) {
  Voice.stop();
  Speech.stop();
  if (state.engine) state.engine.destroy();
  project.settings = Object.assign(createProject(project.template).settings, project.settings || {});
  normalizeProgress(project);
  state.project = project;
  state.mode = 'edit';
  state.tool = 'wall';
  state.engine = makeEngine(project);
  state.engine.reset();
  state.engine.setPlaying(false);
  updateVoiceChip('🎤 микрофон выключен');
  $('#editorGrid').classList.remove('playing');
  $('#btnMode').textContent = '▶ Играть';
  $('#btnMode').className = 'btn btn-primary';
  $('#playHud').classList.add('hidden');
  $('#resultOverlay').classList.add('hidden');
  updateEditorHeader();
  renderTools();
  renderProps();
  updateChips();
  renderMission();
  showScreen('editor');
}
function goGallery() {
  if (state.dirty) saveProject(true);
  Voice.stop();
  Speech.stop();
  if (state.engine) state.engine.destroy();
  state.engine = null;
  state.project = null;
  showScreen('gallery');
  renderSaved();
  renderPublished();
  updateCoinChip();
}
function updateEditorHeader() {
  const p = state.project, t = TEMPLATES[p.template];
  $('#projectName').value = p.name;
  $('#tplBadge').textContent = `${t.emoji} ${t.tag}`;
  $('#canvasTitle').textContent = t.canvasTitle;
  $('#canvasSubtitle').textContent = t.canvasSubtitle;
  $('#hintText').textContent = t.hint;
}
function updateChips() {
  const p = state.project;
  if (!p) return;
  updateCoinChip();
  let n = 0;
  if (p.level && p.level.grid) n = p.level.grid.flat().filter(Boolean).length;
  if (p.template === 'quiz') n = p.questions.length;
  if (p.template === 'racer' || p.template === 'catcher') n = Math.round(p.settings.traffic * 10);
  if (p.template === 'pong') n = p.settings.target;
  if (p.template === 'arkanoid') n = p.settings.rows * 10;
  if (p.template === 'shooter') n = 32;
  if (p.template === 'tictactoe') n = 9;
  if (p.template === 'memory') n = p.settings.pairs * 2;
  if (p.template === 'math') n = p.settings.count;
  if (p.template === 'snake') n = Math.round(p.settings.speed * 10);
  if (GENRE_IDS.includes(p.template)) {
    n = p.template === 'runner' ? Math.max(40, (p.settings.count || 10) * 10)
      : p.template === 'duel' ? Math.max(40, (p.settings.lives || 3) * 30)
      : Math.max(3, Math.round((p.settings.count || 10) * (DIFF[p.settings.difficulty] || DIFF.normal).traffic));
  }
  if (MINI_IDS.includes(p.template)) n = p.settings.target || 8;
  const genreLabels = {
    starraid: '👾 сбить', tank: '👾 подбить', range: '🎯 попасть', whack: '🐹 поймать',
    runner: '🏁 метров', reaction: '⚡ очков', defense: '👾 отразить', farm: '🌾 собрать',
    duel: '❤️ прочность', brawl: '🥊 боя', zombie: '🧟 победить', rescue: '🧒 спасти'
  };
  const labels = Object.assign({}, MINI_LABELS, {
    quiz: '❓ вопросов', racer: '🚗 поток', catcher: '🍎 поток', pong: '🏆 до победы',
    arkanoid: '🧱 кирпичей', shooter: '👾 пришельцев', tictactoe: '⭕ клеток',
    memory: '🃏 карточек', math: '🧮 примеров', snake: '⚡ скорость'
  }, genreLabels);
  $('#chipObjects').textContent = `${labels[p.template] || '🪐 объектов'}: ${n}`;
  $('#chipMode').textContent = state.mode === 'play' ? '▶ Режим: игра' : '✏️ Режим: редактор';
}
function setMode(mode) {
  if (!state.project) return;
  state.mode = mode;
  const playing = mode === 'play';
  document.body.classList.toggle('playing-mode', playing);
  $('#editorGrid').classList.toggle('playing', playing);
  $('#btnMode').textContent = playing ? '✏️ В редактор' : '▶ Играть';
  $('#btnMode').className = playing ? 'btn btn-accent' : 'btn btn-primary';
  $('#btnFullscreen').classList.toggle('hidden', !playing);
  $('#btnShop').classList.toggle('hidden', !playing);
  renderMission();
  if (!playing && isFullscreen()) exitFullscreen();
  $('#playHud').classList.toggle('hidden', !playing);
  $('#resultOverlay').classList.add('hidden');
  for (const k in keys) keys[k] = false;
  for (const k in pressed) delete pressed[k];
  updateTouchControls();
  if (!playing) { Voice.stop(); Speech.stop(); }
  state.engine.reset();
  state.engine.setPlaying(playing);
  if (playing) {
    lastHudHtml = missionHudHtml() + state.engine.getHud();
    $('#playHud').innerHTML = lastHudHtml;
    if (state.project.settings.narrate && !state.project.settings.voice) Speech.speak(rulesText(state.project));
    Voice.start();
    if (state.project.settings.voice && !Voice.supported()) showToast('Голос доступен в Chrome и Edge', 'warn');
  }
  updateChips();
  showToast(playing ? 'Игра запущена! Удачи 🎮' : 'Снова в редакторе ✏️');
}
function handleFinish(win, msg) {
  $('#resultOverlay').innerHTML = `
    <div class="result-card">
      <div class="result-emoji">${win ? '🏆' : '💪'}</div>
      <h3>${win ? 'Победа!' : 'Попробуй ещё раз!'}</h3>
      <p>${esc(msg)}</p>
      <div class="result-actions">
        <button class="btn btn-primary" data-res="again">🔄 Играть снова</button>
        <button class="btn btn-ghost" data-res="edit">✏️ В редактор</button>
      </div>
    </div>`;
  $('#resultOverlay').classList.remove('hidden');
  if (win) beep(1046, .16);
}

/* ---------- Панель инструментов ---------- */
function commonSettings(p) {
  const bgPresets = ['#20234a', '#123b52', '#3b2352', '#1d3b2a', '#4a2338', '#0f3a4d'];
  const acPresets = ['#ffd166', '#ff9f43', '#38c172', '#5ac8fa', '#ff6b81', '#c792ea'];
  const genreLives = ['starraid', 'tank', 'whack', 'runner', 'defense', 'brawl', 'zombie', 'rescue'];
  const withRules = GENRE_IDS.includes(p.template) ||
    MINI_IDS.includes(p.template) ||
    ['platformer', 'runnerhuman', 'collector', 'racer', 'catcher', 'snake', 'pong', 'arkanoid', 'shooter', 'math'].includes(p.template);
  const withLives = genreLives.includes(p.template) ||
    MINI_IDS.includes(p.template) ||
    ['platformer', 'runnerhuman', 'collector', 'racer', 'catcher', 'arkanoid', 'shooter', 'math'].includes(p.template);
  let html = `
  <div class="tool-section">
    <h4 class="tool-title">🎨 Оформление</h4>
    <label class="field-label">Цвет фона</label>
    <div class="field-row">
      <input type="color" id="fldBg" value="${esc(p.settings.bg)}">
      <input class="field" id="fldBgHex" value="${esc(p.settings.bg)}" maxlength="7">
    </div>
    <div class="swatches">${bgPresets.map(c => `<button class="swatch" data-bg="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>
    <label class="field-label" style="margin-top:14px">Цвет деталей</label>
    <div class="field-row">
      <input type="color" id="fldAccent" value="${esc(p.settings.accent)}">
      <input class="field" id="fldAccentHex" value="${esc(p.settings.accent)}" maxlength="7">
    </div>
    <div class="swatches">${acPresets.map(c => `<button class="swatch" data-accent="${c}" style="background:${c}" title="${c}"></button>`).join('')}</div>
  </div>`;

  if (withRules) {
    html += `
    <div class="tool-section">
      <h4 class="tool-title">⚙️ Правила игры</h4>
      <label class="field-label">Сложность</label>
      <div class="segmented">
        ${Object.entries(DIFF).map(([v, d]) => `<button data-diff="${v}" class="${p.settings.difficulty === v ? 'active' : ''}">${d.label}</button>`).join('')}
      </div>
      <label class="field-label" style="margin-top:14px">Скорость</label>
      <div class="range-row">
        <input type="range" id="fldSpeed" min="0.6" max="1.8" step="0.1" value="${p.settings.speed}">
        <span class="range-value" id="speedVal">${Number(p.settings.speed).toFixed(1)}×</span>
      </div>
      ${withLives ? `<label class="field-label" style="margin-top:14px">Жизни героя</label>
      <div class="range-row">
        <input type="range" id="fldLives" min="1" max="6" step="1" value="${p.settings.lives}">
        <span class="range-value" id="livesVal">${p.settings.lives} ♥</span>
      </div>` : ''}
    </div>`;
  }

  html += `
  <div class="tool-section">
    <h4 class="tool-title">🎤 Голос и звук</h4>
    <label class="switch-row"><input type="checkbox" id="fldSound" ${p.settings.sound ? 'checked' : ''}> Звуковые эффекты 🔊</label>
    <label class="switch-row"><input type="checkbox" id="fldNarrate" ${p.settings.narrate ? 'checked' : ''}> Озвучивать правила при запуске 🗣️</label>
    <label class="switch-row"><input type="checkbox" id="fldVoice" ${p.settings.voice ? 'checked' : ''} ${Voice.supported() ? '' : 'disabled'}> Управлять голосом 🎙️</label>
    ${Voice.supported() ? '<p class="hint-mini">Скажи: «влево», «вправо», «прыжок», «вниз», «стоп».</p>'
      : '<p class="hint-mini">Голосовое управление работает в Chrome и Edge.</p>'}
  </div>`;
  return html;
}
function heroSection(p) {
  const list = ['🚀', '🐱', '🦊', '🐼', '🤖', '🐸', '🦄', '🐯', '👾', '🐙', '🧑', '👦', '👧', '🦸'];
  return `<div class="tool-section">
    <h4 class="tool-title">🦸 Выбери героя</h4>
    <div class="emoji-grid">${list.map(e => `<button class="emoji-btn ${p.settings.hero === e ? 'active' : ''}" data-hero="${e}">${e}</button>`).join('')}</div>
  </div>`;
}
function levelSection(p) {
  const order = p.template === 'runnerhuman'
    ? ['wall', 'mover', 'moverv', 'checkpoint', 'coin', 'gem', 'heart', 'tramp', 'spike', 'finish', 'enemy', 'start', 'erase']
    : p.template === 'platformer'
      ? ['wall', 'star', 'coin', 'gem', 'heart', 'tramp', 'spike', 'finish', 'enemy', 'start', 'erase']
      : ['wall', 'star', 'coin', 'gem', 'heart', 'spike', 'finish', 'enemy', 'start', 'erase'];
  const wallLabel = (p.template === 'platformer' || p.template === 'runnerhuman') ? 'Платформа' : 'Стена';
  const all = order.concat((p.customItems || []).map(c => customKind(c.id)));
  return `<div class="tool-section">
    <h4 class="tool-title">🗺️ Редактор уровня</h4>
    <div class="tool-palette">${all.map(id => {
      const it = getItem(p, id);
      if (!it) return '';
      const label = id === 'wall' ? wallLabel : it.label;
      return `<button class="tool-btn ${state.tool === id ? 'active' : ''} ${it.custom ? 'custom' : ''}" data-tool="${id}" title="${esc(it.desc)}"><span>${it.em}</span>${esc(label)}</button>`;
    }).join('')}</div>
    <p class="hint-mini">Выбери предмет и кликай по полю — или зажми кнопку мыши и веди, чтобы рисовать быстро. Правой кнопкой можно стереть.</p>
    <button class="link-btn" data-action="clear-level">🧹 Очистить уровень</button><br>
    <button class="link-btn" data-action="reset-level">🔄 Вернуть пример уровня</button>
  </div>`;
}
function customItemsSection(p) {
  if (!hasGrid(p)) return '';
  const items = p.customItems || [];
  const emojis = ['🍎','🍐','🍇','🍓','🍌','🥕','🧀','🍪','🍬','🍭','🌲','🌸','🌵','🌻',
    '🎈','🌟','⭐','🌈','🦋','🐝','🐶','🐱','🦊','🏀','⚽','🎁','🔔','🗝️','💐','🧩',
    '🚗','🛸','🪙','💎','❤️','🔺','🌀','🏁','👾','🚩'];
  return `<div class="tool-section">
    <h4 class="tool-title">✨ Свои предметы</h4>
    <p class="hint-mini">Придумай предмет — и он появится в кисти выше!</p>
    <label class="field-label">Картинка предмета</label>
    <div class="field-row">
      <input class="field" id="fldNewItemEm" maxlength="8" value="${esc(state.newItemEm)}" placeholder="Впиши эмодзи">
      <span class="prop-emoji">${esc(state.newItemEm)}</span>
    </div>
    <div class="emoji-grid" style="margin-top:6px">${emojis.map(f => `<button class="emoji-btn ${state.newItemEm === f ? 'active' : ''}" data-new-em="${f}">${f}</button>`).join('')}</div>
    <label class="field-label" style="margin-top:10px">Название</label>
    <input class="field" id="fldNewItemName" maxlength="16" value="${esc(state.newItemName)}" placeholder="Например, Яблоко">
    <label class="field-label" style="margin-top:10px">Что будет делать?</label>
    <div class="effect-grid">${ITEM_EFFECTS.map(([v, l]) => `<button class="effect-btn ${state.newItemEffect === v ? 'active' : ''}" data-new-effect="${v}">${l}</button>`).join('')}</div>
    <p class="hint-mini">«Цель» — надо собрать все звёзды и твои цели. «Трамплин» работает в «Прыгающем герое».</p>
    <button class="btn btn-primary" data-action="add-custom-item" style="width:100%;margin-top:10px" ${items.length >= 8 ? 'disabled' : ''}>＋ Создать предмет</button>
    ${items.length ? `<div class="custom-list">${items.map(c => {
      const d = getItem(p, customKind(c.id));
      return `<div class="custom-item"><span class="custom-item-em">${d.em}</span><span class="custom-item-name">${esc(d.label)}<small>${esc(d.desc)}</small></span><button class="btn-remove" data-action="remove-custom-item" data-id="${esc(c.id)}" title="Удалить предмет">🗑</button></div>`;
    }).join('')}</div>` : '<p class="hint-mini">Пока нет своих предметов. Создай первый!</p>'}
  </div>`;
}
function racerSection(p) {
  const cars = ['🚗', '🚕', '🚙', '🏎️', '🚌', '🚓', '🚑', '🚚'];
  return `<div class="tool-section">
    <h4 class="tool-title">🏎️ Твоя машина</h4>
    <div class="emoji-grid">${cars.map(c => `<button class="emoji-btn ${p.settings.car === c ? 'active' : ''}" data-car="${c}">${c}</button>`).join('')}</div>
  </div>
  <div class="tool-section">
    <h4 class="tool-title">🛣️ Трасса</h4>
    <label class="field-label">Цвет дороги</label>
    <div class="field-row">
      <input type="color" id="fldRoad" value="${esc(p.settings.road)}">
      <input class="field" id="fldRoadHex" value="${esc(p.settings.road)}" maxlength="7">
    </div>
    <label class="field-label" style="margin-top:14px">Поток машин</label>
    <div class="range-row">
      <input type="range" id="fldTraffic" min="0.5" max="2" step="0.1" value="${p.settings.traffic}">
      <span class="range-value" id="trafficVal">${Number(p.settings.traffic).toFixed(1)}×</span>
    </div>
  </div>`;
}
function catcherSection(p) {
  const baskets = ['🧺', '🪣', '🧤', '🛒', '🚚', '🎒'];
  return `<div class="tool-section">
    <h4 class="tool-title">🧺 Корзина</h4>
    <div class="emoji-grid">${baskets.map(b => `<button class="emoji-btn ${p.settings.basket === b ? 'active' : ''}" data-basket="${b}">${b}</button>`).join('')}</div>
  </div>
  <div class="tool-section">
    <h4 class="tool-title">🍎 Предметы</h4>
    <label class="field-label">Как часто падать</label>
    <div class="range-row">
      <input type="range" id="fldTraffic" min="0.5" max="2" step="0.1" value="${p.settings.traffic}">
      <span class="range-value" id="trafficVal">${Number(p.settings.traffic).toFixed(1)}×</span>
    </div>
    <p class="hint-mini">🍎 — 10 очков, 🌟 — 50 очков, 💣 — отнимает жизнь.</p>
  </div>`;
}
function quizSection(p) {
  return `<div class="tool-section">
    <h4 class="tool-title">❓ Вопросы</h4>
    ${p.questions.map((q, qi) => `
      <div class="question-card">
        <div class="question-head">
          <span class="question-num">Вопрос ${qi + 1}</span>
          <button class="btn-remove" data-action="remove-question" data-index="${qi}">🗑 Удалить</button>
        </div>
        <input class="field" data-q-text="${qi}" value="${esc(q.text)}" placeholder="Напиши вопрос">
        ${q.answers.map((a, ai) => `
        <div class="answer-row ${q.correct === ai ? 'correct' : ''}">
          <input type="radio" name="correct-${qi}" data-correct="${qi}" data-ai="${ai}" ${q.correct === ai ? 'checked' : ''} title="Правильный ответ">
          <input class="field" data-a-text="${qi}" data-ai="${ai}" value="${esc(a)}" placeholder="Ответ ${'АБВГ'[ai]}">
        </div>`).join('')}
      </div>`).join('')}
    <button class="btn btn-ghost" data-action="add-question" style="width:100%" ${p.questions.length >= 16 ? 'disabled' : ''}>＋ Добавить вопрос</button>
    <p class="hint-mini">Отметь кружком правильный ответ. Можно добавить до 16 вопросов.</p>
  </div>`;
}
function snakeSection(p) {
  const foods = ['🍎', '🍐', '🍇', '🍓', '🍌', '🥕', '🧀', '🍪', '🍩', '⭐'];
  const colors = ['#38c172', '#5ac8fa', '#ff6b81', '#ffd166', '#c792ea', '#ff9f43'];
  return `<div class="tool-section">
    <h4 class="tool-title">🐍 Змейка</h4>
    <label class="field-label">Цвет змейки</label>
    <div class="swatches">${colors.map(c => `<button class="swatch ${p.settings.snakeColor === c ? 'active' : ''}" data-snake-color="${c}" style="background:${c}"></button>`).join('')}</div>
    <div class="field-row" style="margin-top:10px">
      <input type="color" id="fldSnakeColor" value="${esc(p.settings.snakeColor)}">
      <input class="field" id="fldSnakeColorHex" value="${esc(p.settings.snakeColor)}" maxlength="7">
    </div>
    <label class="field-label" style="margin-top:14px">Что будет съедать змейка?</label>
    <div class="emoji-grid">${foods.map(f => `<button class="emoji-btn ${p.settings.food === f ? 'active' : ''}" data-food="${f}">${f}</button>`).join('')}</div>
  </div>`;
}
function pongSection(p) {
  const colors = ['#5ac8fa', '#ff6b81', '#38c172', '#ffd166', '#c792ea'];
  return `<div class="tool-section">
    <h4 class="tool-title">🏓 Матч</h4>
    <label class="field-label">Счёт до победы</label>
    <div class="range-row">
      <input type="range" id="fldTarget" min="1" max="20" step="1" value="${p.settings.target}">
      <span class="range-value" id="targetVal">${p.settings.target}</span>
    </div>
    <label class="field-label" style="margin-top:14px">Цвет твоей ракетки</label>
    <div class="swatches">${colors.map(c => `<button class="swatch ${p.settings.paddle === c ? 'active' : ''}" data-paddle="${c}" style="background:${c}"></button>`).join('')}</div>
  </div>`;
}
function arkanoidSection(p) {
  const colors = ['#ffd166', '#5ac8fa', '#ff6b81', '#38c172', '#c792ea'];
  return `<div class="tool-section">
    <h4 class="tool-title">🧱 Кирпичи</h4>
    <label class="field-label">Рядов кирпичей</label>
    <div class="range-row">
      <input type="range" id="fldRows" min="2" max="8" step="1" value="${p.settings.rows}">
      <span class="range-value" id="rowsVal">${p.settings.rows}</span>
    </div>
    <label class="field-label" style="margin-top:14px">Цвет платформы</label>
    <div class="swatches">${colors.map(c => `<button class="swatch ${p.settings.paddleColor === c ? 'active' : ''}" data-paddle-color="${c}" style="background:${c}"></button>`).join('')}</div>
  </div>`;
}
function shooterSection(p) {
  const ships = ['🚀', '🛸', '✈️', '🪁', '🦅', '🤖'];
  return `<div class="tool-section">
    <h4 class="tool-title">🚀 Корабль</h4>
    <div class="emoji-grid">${ships.map(s => `<button class="emoji-btn ${p.settings.ship === s ? 'active' : ''}" data-ship="${s}">${s}</button>`).join('')}</div>
    <label class="field-label" style="margin-top:14px">Частота стрельбы</label>
    <div class="range-row">
      <input type="range" id="fldFireRate" min="0.6" max="2.2" step="0.1" value="${p.settings.fireRate}">
      <span class="range-value" id="fireRateVal">${Number(p.settings.fireRate).toFixed(1)}×</span>
    </div>
  </div>`;
}
function tictactoeSection(p) {
  return `<div class="tool-section">
    <h4 class="tool-title">⭕ Крестики-нолики</h4>
    <label class="field-label">Твой значок</label>
    <div class="segmented">
      <button data-mark="❌" class="${p.settings.mark !== '⭕' ? 'active' : ''}">❌ Крестик</button>
      <button data-mark="⭕" class="${p.settings.mark === '⭕' ? 'active' : ''}">⭕ Нолик</button>
    </div>
    <label class="field-label" style="margin-top:14px">Ум соперника</label>
    <div class="segmented">
      ${[['easy', '😴 Сонный'], ['normal', '🙂 Обычный'], ['hard', '🧠 Умный']].map(([v, l]) =>
        `<button data-smart="${v}" class="${p.settings.smart === v ? 'active' : ''}">${l}</button>`).join('')}
    </div>
    <label class="switch-row" style="margin-top:14px"><input type="checkbox" id="fldFirst" ${p.settings.first ? 'checked' : ''}> Ходить первым</label>
  </div>`;
}
function memorySection(p) {
  const decks = [['animals', '🐶 🐱 🦊', 'Зверята'], ['food', '🍎 🍌 🍇', 'Еда'], ['space', '🚀 🪐 ⭐', 'Космос']];
  return `<div class="tool-section">
    <h4 class="tool-title">🃏 Карточки</h4>
    <label class="field-label">Сколько пар найти?</label>
    <div class="segmented">
      ${[6, 8, 10, 12].map(n => `<button data-pairs="${n}" class="${+p.settings.pairs === n ? 'active' : ''}">${n} пар</button>`).join('')}
    </div>
    <label class="field-label" style="margin-top:14px">Картинки на карточках</label>
    <div class="segmented">
      ${decks.map(([v, em, l]) => `<button data-deck="${v}" class="${p.settings.deck === v ? 'active' : ''}">${em}<br>${l}</button>`).join('')}
    </div>
  </div>`;
}
function mathSection(p) {
  const ops = [['+', '＋ Сложение'], ['-', '－ Вычитание'], ['×', '× Умножение'], [':', ': Деление']];
  return `<div class="tool-section">
    <h4 class="tool-title">🧮 Примеры</h4>
    <label class="field-label">Какие действия будут?</label>
    ${ops.map(([v, l]) => `<label class="switch-row"><input type="checkbox" data-op="${v}" ${(p.settings.ops || []).includes(v) ? 'checked' : ''}> ${l}</label>`).join('')}
    <label class="field-label" style="margin-top:14px">Сколько примеров?</label>
    <div class="range-row">
      <input type="range" id="fldCount" min="3" max="20" step="1" value="${p.settings.count}">
      <span class="range-value" id="countVal">${p.settings.count}</span>
    </div>
    <label class="field-label" style="margin-top:14px">Секунд на ответ</label>
    <div class="range-row">
      <input type="range" id="fldSeconds" min="5" max="30" step="1" value="${p.settings.seconds}">
      <span class="range-value" id="secondsVal">${p.settings.seconds}</span>
    </div>
  </div>`;
}
function battleSection(p) {
  const maps = [[1, '🏰 Классика'], [2, '🌊 Река'], [3, '🪨 Крепость']];
  return `<div class="tool-section">
    <h4 class="tool-title">🛡️ Поле боя</h4>
    <label class="field-label">Карта</label>
    <div class="segmented">
      ${maps.map(([v, l]) => `<button data-layout="${v}" class="${p.settings.layout === v ? 'active' : ''}">${l}</button>`).join('')}
    </div>
    <p class="hint-mini">Кирпичные стены можно пробить выстрелом, стальные — нет. Внизу поля стоит твоя база 🦅 — не дай врагам её разрушить.</p>
  </div>`;
}
function genreSection(p) {
  const title = TEMPLATES[p.template].tag;
  const goalLabel = {
    starraid: 'Сколько врагов сбить', tank: 'Сколько танков уничтожить',
    range: 'Сколько мишеней поразить', whack: 'Сколько кротов поймать',
    runner: 'Дистанция (в десятках метров)', reaction: 'Нужно очков',
    defense: 'Сколько врагов отразить', farm: 'Сколько урожаев собрать',
    duel: 'Прочность героя', brawl: 'Сколько ударов нанести',
    zombie: 'Сколько зомби победить', rescue: 'Сколько друзей спасти'
  }[p.template] || 'Цель игры';
  const noTime = p.template === 'duel' || p.template === 'runner';
  return `<div class="tool-section">
    <h4 class="tool-title">🎯 ${title}: цель игры</h4>
    <label class="field-label">${goalLabel}</label>
    <div class="range-row">
      <input type="range" id="fldCount" min="3" max="20" step="1" value="${p.settings.count}">
      <span class="range-value" id="countVal">${p.settings.count}</span>
    </div>
    ${noTime ? '' : `<label class="field-label" style="margin-top:14px">Время на игру, секунд</label>
    <div class="range-row">
      <input type="range" id="fldSeconds" min="20" max="120" step="5" value="${p.settings.seconds}">
      <span class="range-value" id="secondsVal">${p.settings.seconds}</span>
    </div>`}
    <p class="hint-mini">Сложность и скорость меняются выше, в разделе «Правила игры».</p>
  </div>`;
}
function miniSection(p) {
  const label = MINI_LABELS[p.template] || '🎯 целей';
  return `<div class="tool-section">
    <h4 class="tool-title">🎯 Цель и время</h4>
    <label class="field-label">${label}</label>
    <div class="range-row">
      <input type="range" id="fldTarget" min="2" max="20" step="1" value="${p.settings.target}">
      <span class="range-value" id="targetVal">${p.settings.target}</span>
    </div>
    <label class="field-label" style="margin-top:14px">Время на игру, секунд</label>
    <div class="range-row">
      <input type="range" id="fldSeconds" min="20" max="150" step="5" value="${p.settings.seconds}">
      <span class="range-value" id="secondsVal">${p.settings.seconds}</span>
    </div>
    <p class="hint-mini">За задания и победу ты получаешь 🪙 коины. Потрать их можно в магазине во время игры.</p>
  </div>`;
}
function renderTools() {
  const p = state.project;
  if (!p) return;
  let html = commonSettings(p);
  if (GENRE_IDS.includes(p.template)) {
    html += genreSection(p);
    if (p.template === 'tank') html += battleSection(p);
    if (['starraid', 'runner', 'zombie', 'rescue'].includes(p.template)) html += heroSection(p);
  }
  if (p.template === 'platformer' || p.template === 'runnerhuman' || p.template === 'collector') html += heroSection(p) + levelSection(p) + customItemsSection(p);
  if (p.template === 'racer') html += racerSection(p);
  if (p.template === 'catcher') html += catcherSection(p);
  if (p.template === 'quiz') html += quizSection(p);
  if (p.template === 'snake') html += snakeSection(p);
  if (p.template === 'pong') html += pongSection(p);
  if (p.template === 'arkanoid') html += arkanoidSection(p);
  if (p.template === 'shooter') html += shooterSection(p);
  if (p.template === 'tictactoe') html += tictactoeSection(p);
  if (p.template === 'memory') html += memorySection(p);
  if (p.template === 'math') html += mathSection(p);
  if (MINI_IDS.includes(p.template)) html += heroSection(p) + miniSection(p);
  $('#toolsPanel').innerHTML = html;
}
function renderProps() {
  const p = state.project;
  if (!p) return;
  let html = '';
  if (hasGrid(p)) {
    const it = getItem(p, state.tool) || ITEMS.wall;
    const desc = state.tool === 'wall' && (p.template === 'platformer' || p.template === 'runnerhuman')
      ? 'Платформа — по ней герой ходит и прыгает.' : it.desc;
    html += `<div class="prop-card"><span class="prop-emoji">${it.em}</span><h4>Выбранный инструмент</h4><p>${esc(desc)}</p></div>`;
  }
  if (p.level && p.level.grid) {
    const flat = p.level.grid.flat();
    const count = v => flat.filter(x => x === v).length;
    const customRows = (p.customItems || []).map(c => {
      const d = getItem(p, customKind(c.id));
      return `<div class="stat-row"><span>${d.em} ${esc(d.label)}</span><b>${count(customKind(c.id))}</b></div>`;
    }).join('');
    html += `<div class="prop-card"><h4>📊 Статистика уровня</h4>
      <div class="stat-row"><span>Платформ / стен</span><b>${count('wall')}</b></div>
      <div class="stat-row"><span>⭐ Звёзд</span><b>${count('star')}</b></div>
      <div class="stat-row"><span>🪙 Монеток</span><b>${count('coin')}</b></div>
      <div class="stat-row"><span>💎 Кристаллов</span><b>${count('gem')}</b></div>
      <div class="stat-row"><span>❤️ Сердец</span><b>${count('heart')}</b></div>
      <div class="stat-row"><span>🔺 Шипов</span><b>${count('spike')}</b></div>
      <div class="stat-row"><span>🌀 Трамплинов</span><b>${count('tramp')}</b></div>
      <div class="stat-row"><span>🏁 Финишей</span><b>${count('finish')}</b></div>
      <div class="stat-row"><span>👾 Врагов</span><b>${count('enemy')}</b></div>
      ${customRows}
    </div>`;
  }
  if (p.template === 'quiz') {
    html += `<div class="prop-card"><h4>📊 Статистика</h4>
      <div class="stat-row"><span>Вопросов</span><b>${p.questions.length}</b></div>
      <div class="stat-row"><span>Ответов</span><b>${p.questions.reduce((n, q) => n + q.answers.filter(a => a.trim()).length, 0)}</b></div>
    </div>`;
  }
  if (p.template === 'racer') {
    html += `<div class="prop-card"><h4>📊 Трасса</h4>
      <div class="stat-row"><span>Сложность</span><b>${DIFF[p.settings.difficulty].label}</b></div>
      <div class="stat-row"><span>Поток машин</span><b>${Number(p.settings.traffic).toFixed(1)}×</b></div>
    </div>`;
  }
  if (p.template === 'catcher') {
    html += `<div class="prop-card"><h4>📊 Ловля</h4>
      <div class="stat-row"><span>Сложность</span><b>${DIFF[p.settings.difficulty].label}</b></div>
      <div class="stat-row"><span>Частота</span><b>${Number(p.settings.traffic).toFixed(1)}×</b></div>
      <div class="stat-row"><span>Жизни</span><b>${p.settings.lives} ♥</b></div>
    </div>`;
  }
  const extraStats = {
    snake: [['🍎 Лакомство', p.settings.food], ['🎨 Цвет', 'свой'], ['⚡ Скорость', Number(p.settings.speed).toFixed(1) + '×']],
    pong: [['🏆 До победы', p.settings.target], ['🤖 Соперник', DIFF[p.settings.difficulty].label]],
    arkanoid: [['🧱 Рядов', p.settings.rows], ['🧱 Кирпичей', state.engine && state.engine.bricks ? state.engine.bricks.length : p.settings.rows * 10]],
    shooter: [['🚀 Корабль', p.settings.ship], ['👾 Пришельцев', '32'], ['⚡ Стрельба', Number(p.settings.fireRate).toFixed(1) + '×']],
    tictactoe: [['🎯 Соперник', ({ easy: 'Сонный', normal: 'Обычный', hard: 'Умный' })[p.settings.smart] || 'Обычный'], ['✍️ Первый ход', p.settings.first ? 'Ты' : 'Компьютер']],
    memory: [['🃏 Пар', p.settings.pairs], ['🃏 Карточек', p.settings.pairs * 2], ['🎨 Колода', ({ animals: 'Зверята', food: 'Еда', space: 'Космос' })[p.settings.deck] || 'Зверята']],
    math: [['❓ Примеров', p.settings.count], ['⏱ Секунд', p.settings.seconds], ['➗ Действий', (p.settings.ops || []).join(' ')]],
    runnerhuman: [['🔥 Огненный шар', 'J / F'], ['↔️ Платформ', state.engine && state.engine.movers ? state.engine.movers.length : 0], ['📍 Точек', state.engine && state.engine.checkpoints ? state.engine.checkpoints.length : 0]]
  };
  if (extraStats[p.template]) {
    html += `<div class="prop-card"><h4>📊 Настройки</h4>` +
      extraStats[p.template].map(([l, v]) => `<div class="stat-row"><span>${l}</span><b>${v}</b></div>`).join('') + `</div>`;
  }
  html += `<div class="prop-card"><h4>🪙 Коины и магазин</h4>
    <div class="stat-row"><span>Коинов в этой игре</span><b>${getCoins(p)} 🪙</b></div>
    <div class="stat-row"><span>Цена предмета</span><b>${COIN_PRICE} 🪙</b></div>
    <div class="stat-row"><span>За победу</span><b>+10 🪙</b></div>
    <div class="stat-row"><span>Первая победа</span><b>ещё +10 🪙</b></div>
  </div>`;
  html += `<div class="prop-card"><h4>💡 Полезные советы</h4><ul class="tip-list">${TIPS[p.template].map(t => `<li>${t}</li>`).join('')}</ul></div>`;
  $('#propsPanel').innerHTML = html;
}

/* ---------- Модальные окна ---------- */
function openModal(html) {
  $('#modalRoot').innerHTML = `<div class="modal">${html}</div>`;
  $('#modalRoot').classList.add('is-open');
}
function closeModal() {
  $('#modalRoot').innerHTML = '';
  $('#modalRoot').classList.remove('is-open');
}
function openHelp() {
  openModal(`
    <h3>📖 Как создать игру</h3>
    <p class="modal-sub">Всё просто — всего 5 шагов:</p>
    <ol class="modal-steps">
      <li><b>Выбери шаблон</b>: всего 35 игр. Шутеры — «Звёздный рейд», «Батл Сити», «Меткий тир». Аркада — «Бей кротов», «Бегун», «Быстрая реакция». Стратегии — «Защита замка», «Умная ферма», «Поединок героев». Экшен — «Кулачный бой», «Оборона от зомби», «Спаси друзей». Новые режимы: «Лавовый лабиринт», «Бомбовый квартал», «Защита крепости», «Гонка на выживание», «Воздушный бой», «Аркадный хоккей», «Ловля рыбы», «Волшебный сад», «Космическая станция», «Королевская битва». Плюс «Бегущий человек» (обби с огненными шарами), платформер, лабиринт, гонки, викторина, ловля яблок, змейка, пинг-понг, кирпичи, шутер, крестики-нолики, память и математика.</li>
      <li><b>Настрой игру слева</b>: цвета, героя, сложность, скорость, жизни. Можно включить голосовое управление.</li>
      <li><b>Сделай свой уровень</b>: рисуй по полю кистью и расставляй монетки, кристаллы, сердца, шипы, трамплины и финиш. А в разделе «✨ Свои предметы» придумай свой предмет — выбери картинку, название и что он будет делать.</li>
      <li><b>Нажми «▶ Играть»</b> и проверь игру. Кнопка «🔊 Рассказать правила» прочитает подсказку вслух, а «⛶ На весь экран» сделает поле большим. Кнопка «🛒 Магазин» тратит коины этой игры на предметы. Вверху показано задание игры: выполни его и получи награду коинами.</li>
      <li><b>Сохрани или поделись</b>: «💾 Сохранить» — в браузере, «🌟 В галерею» — на общей странице, «🚀 Поделиться» — ссылка другу.</li>
    </ol>
    <p class="modal-sub">📱 На телефоне во время игры появятся кнопки «▲ ◀ ▼ ▶» и «⚡ Действие» — нажимай их пальцами. В играх «Меткий тир», «Бей кротов», «Быстрая реакция», «Защита замка», «Умная ферма» и «Поединок героев» кнопки не нужны: просто нажимай пальцем прямо по полю.</p>
    <div class="modal-actions"><button class="btn btn-primary" data-modal="close">Понятно! 🎮</button></div>`);
}
function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function projectFromLink(link) {
  try {
    const m = String(link).match(/[#&]p=([^&]+)/);
    if (!m) return null;
    let b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return JSON.parse(b64ToUtf8(b64));
  } catch (err) { return null; }
}
function openShare() {
  if (!state.project) { showToast('Сначала открой или создай игру', 'warn'); return; }
  saveProject(true);
  const b64 = utf8ToB64(JSON.stringify(state.project)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const link = location.href.split('#')[0] + '#p=' + b64;
  openModal(`
    <h3>🚀 Поделись игрой</h3>
    <p class="modal-sub">Скопируй ссылку и отправь другу. Он сможет открыть твою игру и достроить её!</p>
    <textarea class="modal-code" id="shareLink" readonly>${esc(link)}</textarea>
    <div class="modal-actions">
      <button class="btn btn-ghost" data-modal="publish">🌟 В галерею</button>
      <button class="btn btn-ghost" data-modal="download">⬇️ Скачать файл</button>
      <button class="btn btn-primary" data-modal="copy">📋 Копировать ссылку</button>
      <button class="btn btn-ghost" data-modal="close">Закрыть</button>
    </div>`);
}
function downloadProject() {
  const blob = new Blob([JSON.stringify(state.project, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Игра_' + state.project.name.replace(/[^\wА-Яа-яЁё-]+/g, '_') + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importProject(obj) {
  if (!obj || !TEMPLATES[obj.template]) { showToast('Это не файл ИгроЛаборатории 😕', 'warn'); return; }
  const p = obj;
  p.id = uid();
  p.settings = Object.assign(createProject(obj.template).settings, p.settings || {});
  normalizeProgress(p);
  p.name = String(p.name || 'Моя игра').slice(0, 40);
  p.createdAt = p.createdAt || Date.now();
  p.updatedAt = Date.now();
  if (hasGrid(p)) {
    if (!p.level || !Array.isArray(p.level.grid) || p.level.grid.length !== ROWS) {
      p.level = defaultLevelFor(obj.template);
    }
    if (!p.level.start) p.level.start = { cx: 2, cy: 2 };
  }
  if (obj.template === 'quiz' && !Array.isArray(p.questions)) p.questions = defaultQuestions();
  saveProject(true);
  openEditor(p);
  showToast('Игра загружена! Можно играть и редактировать 🎉', 'ok');
}

/* ---------- События ---------- */
function cellFromEvent(e) {
  const r = $('#gameCanvas').getBoundingClientRect();
  return {
    cx: Math.floor((e.clientX - r.left) / r.width * COLS),
    cy: Math.floor((e.clientY - r.top) / r.height * ROWS)
  };
}
function bindEvents() {
  bindTouchControls();
  window.addEventListener('resize', updateTouchControls);
  document.addEventListener('fullscreenchange', syncFullscreenUI);
  document.addEventListener('webkitfullscreenchange', syncFullscreenUI);
  $('#btnFullscreen').addEventListener('click', toggleFullscreen);
  $('#btnExitFullscreen').addEventListener('click', toggleFullscreen);
  $('#templateCards').addEventListener('click', e => {
    const b = e.target.closest('[data-create]');
    if (!b) return;
    const p = createProject(b.dataset.create);
    saveProject(true);
    openEditor(p);
    showToast('Шаблон готов! Давай создавать игру ✨', 'ok');
  });
  $('#savedCards').addEventListener('click', e => {
    const open = e.target.closest('[data-open]');
    const del = e.target.closest('[data-del]');
    if (open) {
      const p = loadProjects().find(x => x.id === open.dataset.open);
      if (p) { openEditor(p); showToast('Игра открыта ✏️', 'ok'); }
    }
    if (del) {
      const list = loadProjects().filter(x => x.id !== del.dataset.del);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      renderSaved();
      showToast('Игра удалена');
    }
  });
  $('#publishedCards').addEventListener('click', e => {
    const open = e.target.closest('[data-pub-open]');
    const del = e.target.closest('[data-pub-del]');
    if (open) {
      const p = loadPublished().find(x => x.id === open.dataset.pubOpen);
      if (p) { openEditor(JSON.parse(JSON.stringify(p))); showToast('Игра из галереи открыта 🌟', 'ok'); }
    }
    if (del) {
      const list = loadPublished().filter(x => x.id !== del.dataset.pubDel);
      localStorage.setItem(PUB_KEY, JSON.stringify(list));
      renderPublished();
      showToast('Игра убрана из галереи');
    }
  });
  $('#btnGallery').addEventListener('click', () => {
    if (state.screen === 'editor') goGallery();
    setTimeout(() => $('#publishedCards').scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  });
  $('#btnAddShared').addEventListener('click', () => {
    openModal(`
      <h3>📥 Игра от друга</h3>
      <p class="modal-sub">Вставь ссылку, которую прислал друг, — игра появится в галерее.</p>
      <textarea class="modal-code" id="sharedLinkInput" placeholder="Вставь сюда ссылку на игру"></textarea>
      <div class="modal-actions">
        <button class="btn btn-primary" data-modal="add-shared">Добавить игру</button>
        <button class="btn btn-ghost" data-modal="close">Отмена</button>
      </div>`);
  });
  $('#btnSpeakHint').addEventListener('click', () => {
    if (!state.project) { showToast('Сначала открой игру', 'warn'); return; }
    Speech.speak(rulesText(state.project));
  });
  $('#btnRefreshSaved').addEventListener('click', () => { renderSaved(); showToast('Список обновлён 🔄'); });
  $('#btnStart').addEventListener('click', () => $('#templateCards').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  $('#btnHelpHero').addEventListener('click', openHelp);
  $('#btnHelp').addEventListener('click', openHelp);
  $('#btnMyGames').addEventListener('click', () => {
    if (state.screen === 'editor') goGallery();
    setTimeout(() => $('#savedCards').scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  });
  $('#btnBack').addEventListener('click', () => { if (state.dirty) saveProject(true); goGallery(); });
  $('#btnSave').addEventListener('click', () => { if (state.project) saveProject(); else showToast('Сначала создай игру', 'warn'); });
  $('#btnShare').addEventListener('click', openShare);
  $('#btnImport').addEventListener('click', () => $('#importFile').click());
  $('#importFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try { importProject(JSON.parse(reader.result)); }
      catch (err) { showToast('Не получилось прочитать файл', 'warn'); }
    };
    reader.readAsText(f);
    e.target.value = '';
  });

  $('#modalRoot').addEventListener('click', e => {
    if (e.target.id === 'modalRoot') { closeModal(); return; }
    const buy = e.target.closest('[data-buy]');
    if (buy) {
      const item = SHOP_ITEMS.find(x => x.id === buy.dataset.buy);
      if (!item) return;
      if (getCoins() < COIN_PRICE || !spendCoins(COIN_PRICE)) {
        showToast('Не хватает коинов — собери 🪙 или выиграй!', 'warn');
        return;
      }
      const p = state.project;
      p.purchases[item.id] = (p.purchases[item.id] || 0) + 1;
      if (state.engine && state.engine.buy) state.engine.buy(item.id);
      saveProject(true);
      showToast(`${item.em} ${item.title} — куплено!`, 'ok');
      openShop();
      return;
    }
    const b = e.target.closest('[data-modal]');
    if (!b) return;
    if (b.dataset.modal === 'close') closeModal();
    if (b.dataset.modal === 'download') downloadProject();
    if (b.dataset.modal === 'publish') { closeModal(); publishProject(); }
    if (b.dataset.modal === 'add-shared') {
      const link = $('#sharedLinkInput').value;
      const obj = projectFromLink(link);
      if (!obj) { showToast('Ссылка не подошла 😕 Проверь, что она скопирована целиком', 'warn'); return; }
      closeModal();
      importProject(obj);
      publishProject();
    }
    if (b.dataset.modal === 'copy') {
      const ta = $('#shareLink');
      ta.select();
      let done = false;
      try { done = document.execCommand('copy'); } catch (err) { /* ignored */ }
      if (navigator.clipboard) navigator.clipboard.writeText(ta.value).then(() => showToast('Ссылка скопирована! 📋', 'ok')).catch(() => {});
      if (!navigator.clipboard && done) showToast('Ссылка скопирована! 📋', 'ok');
    }
  });

  $('#projectName').addEventListener('input', e => {
    if (!state.project) return;
    state.project.name = e.target.value.slice(0, 40) || 'Моя игра';
    markDirty();
  });
  $('#btnMode').addEventListener('click', () => setMode(state.mode === 'play' ? 'edit' : 'play'));
  $('#btnShop').addEventListener('click', () => { if (state.mode === 'play') openShop(); else showToast('Магазин откроется, когда начнёшь игру 🛒', 'warn'); });
  $('#resultOverlay').addEventListener('click', e => {
    const b = e.target.closest('[data-res]');
    if (!b) return;
    if (b.dataset.res === 'again') { $('#resultOverlay').classList.add('hidden'); state.engine.reset(); state.engine.setPlaying(true); }
    else setMode('edit');
  });
  $('#interactiveLayer').addEventListener('click', e => {
    const b = e.target.closest('[data-qa]');
    if (b && state.engine && state.engine.choose) state.engine.choose(+b.dataset.qa);
  });

  /* Инструменты: клики */
  $('#toolsPanel').addEventListener('click', e => {
    const p = state.project;
    if (!p) return;
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.bg) { p.settings.bg = b.dataset.bg; $('#fldBg').value = b.dataset.bg; $('#fldBgHex').value = b.dataset.bg; markDirty(); }
    if (b.dataset.accent) { p.settings.accent = b.dataset.accent; $('#fldAccent').value = b.dataset.accent; $('#fldAccentHex').value = b.dataset.accent; markDirty(); }
    if (b.dataset.diff) {
      p.settings.difficulty = b.dataset.diff;
      $$('[data-diff]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x.dataset.diff === b.dataset.diff));
      markDirty(); renderProps();
    }
    if (b.dataset.layout) {
      p.settings.layout = +b.dataset.layout;
      $$('[data-layout]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', +x.dataset.layout === p.settings.layout));
      state.engine.reset(); markDirty(); renderProps();
    }
    if (b.dataset.hero) { p.settings.hero = b.dataset.hero; $$('[data-hero]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x === b)); markDirty(); }
    if (b.dataset.car) { p.settings.car = b.dataset.car; $$('[data-car]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x === b)); markDirty(); }
    if (b.dataset.basket) { p.settings.basket = b.dataset.basket; $$('[data-basket]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x === b)); markDirty(); }
    if (b.dataset.food) { p.settings.food = b.dataset.food; $$('[data-food]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x === b)); markDirty(); }
    if (b.dataset.ship) { p.settings.ship = b.dataset.ship; $$('[data-ship]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x === b)); markDirty(); }
    if (b.dataset.mark) { p.settings.mark = b.dataset.mark; $$('[data-mark]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x === b)); markDirty(); }
    if (b.dataset.smart) { p.settings.smart = b.dataset.smart; $$('[data-smart]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x === b)); markDirty(); renderProps(); }
    if (b.dataset.pairs) { p.settings.pairs = +b.dataset.pairs; $$('[data-pairs]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x === b)); markDirty(); renderProps(); updateChips(); }
    if (b.dataset.deck) { p.settings.deck = b.dataset.deck; $$('[data-deck]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x === b)); markDirty(); renderProps(); }
    if (b.dataset.newEm) {
      state.newItemEm = b.dataset.newEm;
      const emInput = $('#fldNewItemEm'); if (emInput) emInput.value = state.newItemEm;
      const emPreview = $('.field-row .prop-emoji', $('#toolsPanel')); if (emPreview) emPreview.textContent = state.newItemEm;
      $$('[data-new-em]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x === b));
    }
    if (b.dataset.newEffect) { state.newItemEffect = b.dataset.newEffect; $$('[data-new-effect]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x === b)); }
    if (b.dataset.action === 'add-custom-item') {
      const items = p.customItems || (p.customItems = []);
      if (items.length >= 8) return;
      const input = $('#fldNewItemName');
      const name = ((input && input.value) || '').trim().slice(0, 16) || 'Мой предмет';
      const emInput = $('#fldNewItemEm');
      const em = ((emInput && emInput.value) || state.newItemEm || '').trim().slice(0, 8) || '❓';
      const item = { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), em, label: name, effect: state.newItemEffect };
      items.push(item);
      state.tool = customKind(item.id);
      state.newItemName = '';
      renderTools(); renderProps(); markDirty();
      showToast(`Предмет «${name}» готов! Рисуй им по полю ✨`, 'ok');
    }
    if (b.dataset.action === 'remove-custom-item') {
      const id = b.dataset.id;
      p.customItems = (p.customItems || []).filter(x => x.id !== id);
      const kind = customKind(id);
      p.level.grid = p.level.grid.map(row => row.map(v => v === kind ? '' : v));
      if (state.tool === kind) state.tool = 'wall';
      state.engine.reset();
      renderTools(); renderProps(); updateChips(); markDirty();
      showToast('Предмет удалён 🗑');
    }
    const pickColor = (attr, field) => {
      p.settings[field] = b.dataset[attr];
      const input = $('#' + ({ snakeColor: 'fldSnakeColor', paddle: 'fldPaddle', paddleColor: 'fldPaddleColor' })[field]);
      const hex = $('#' + ({ snakeColor: 'fldSnakeColorHex' })[field]);
      if (input) input.value = p.settings[field];
      if (hex) hex.value = p.settings[field];
      $$('[' + attr.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + ']', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x === b));
      markDirty();
    };
    if (b.dataset.snakeColor) pickColor('snakeColor', 'snakeColor');
    if (b.dataset.paddle) pickColor('paddle', 'paddle');
    if (b.dataset.paddleColor) pickColor('paddleColor', 'paddleColor');
    if (b.dataset.tool) { state.tool = b.dataset.tool; renderTools(); renderProps(); }
    const act = b.dataset.action;
    if (act === 'clear-level') {
      p.level.grid = emptyGrid();
      p.level.start = { cx: 2, cy: 2 };
      state.engine.reset(); markDirty(); renderProps(); updateChips();
      showToast('Уровень очищен. Рисуй новый! 🧹');
    }
    if (act === 'reset-level') {
      p.level = defaultLevelFor(p.template);
      state.engine.reset(); markDirty(); renderProps(); updateChips();
      showToast('Пример уровня вернулся 🔄');
    }
    if (act === 'add-question') {
      if (p.questions.length >= 16) return;
      p.questions.push({ text: '', answers: ['', '', '', ''], correct: 0 });
      renderTools(); renderProps(); updateChips(); markDirty();
    }
    if (act === 'remove-question') {
      p.questions.splice(+b.dataset.index, 1);
      renderTools(); renderProps(); updateChips(); markDirty();
    }
  });

  /* Инструменты: ввод */
  $('#toolsPanel').addEventListener('input', e => {
    const p = state.project;
    if (!p) return;
    const t = e.target;
    const hex = v => /^#[0-9a-fA-F]{6}$/.test(v);
    switch (t.id) {
      case 'fldBg':
        p.settings.bg = t.value; $('#fldBgHex').value = t.value; markDirty(); break;
      case 'fldBgHex':
        if (hex(t.value)) { p.settings.bg = t.value; $('#fldBg').value = t.value; markDirty(); } break;
      case 'fldAccent':
        p.settings.accent = t.value; $('#fldAccentHex').value = t.value; markDirty(); break;
      case 'fldAccentHex':
        if (hex(t.value)) { p.settings.accent = t.value; $('#fldAccent').value = t.value; markDirty(); } break;
      case 'fldRoad':
        p.settings.road = t.value; $('#fldRoadHex').value = t.value; markDirty(); break;
      case 'fldRoadHex':
        if (hex(t.value)) { p.settings.road = t.value; $('#fldRoad').value = t.value; markDirty(); } break;
      case 'fldSpeed':
        p.settings.speed = +t.value; $('#speedVal').textContent = (+t.value).toFixed(1) + '×'; markDirty(); break;
      case 'fldLives':
        p.settings.lives = +t.value; $('#livesVal').textContent = t.value + ' ♥'; markDirty(); break;
      case 'fldTraffic':
        p.settings.traffic = +t.value; $('#trafficVal').textContent = (+t.value).toFixed(1) + '×'; markDirty(); renderProps(); break;
      case 'fldSnakeColor':
        p.settings.snakeColor = t.value; $('#fldSnakeColorHex').value = t.value; markDirty(); renderProps(); break;
      case 'fldSnakeColorHex':
        if (hex(t.value)) { p.settings.snakeColor = t.value; $('#fldSnakeColor').value = t.value; markDirty(); } break;
      case 'fldTarget':
        p.settings.target = +t.value; $('#targetVal').textContent = t.value; markDirty(); renderProps(); updateChips(); break;
      case 'fldRows':
        p.settings.rows = +t.value; $('#rowsVal').textContent = t.value; markDirty(); renderProps(); updateChips(); break;
      case 'fldFireRate':
        p.settings.fireRate = +t.value; $('#fireRateVal').textContent = (+t.value).toFixed(1) + '×'; markDirty(); renderProps(); break;
      case 'fldCount':
        p.settings.count = +t.value; $('#countVal').textContent = t.value; markDirty(); renderProps(); updateChips(); break;
      case 'fldSeconds':
        p.settings.seconds = +t.value; $('#secondsVal').textContent = t.value; markDirty(); renderProps(); break;
      case 'fldNewItemName':
        state.newItemName = t.value; break;
      case 'fldNewItemEm':
        state.newItemEm = t.value.trim().slice(0, 8) || '❓';
        $$('[data-new-em]', $('#toolsPanel')).forEach(x => x.classList.toggle('active', x.dataset.newEm === t.value));
        break;
    }
    if (t.dataset.qText !== undefined) {
      p.questions[+t.dataset.qText].text = t.value;
      markDirty();
    }
    if (t.dataset.aText !== undefined) {
      p.questions[+t.dataset.aText].answers[+t.dataset.ai] = t.value;
      markDirty();
    }
  });
  $('#toolsPanel').addEventListener('change', e => {
    const p = state.project;
    if (!p) return;
    const t = e.target;
    if (t.id === 'fldSound') { p.settings.sound = t.checked; markDirty(); }
    if (t.id === 'fldNarrate') { p.settings.narrate = t.checked; markDirty(); }
    if (t.id === 'fldVoice') {
      p.settings.voice = t.checked;
      if (!t.checked) Voice.stop();
      else if (state.mode === 'play') Voice.start();
      updateVoiceChip(t.checked ? '🎤 микрофон выключен' : '🎤 голос выключен');
      markDirty();
    }
    if (t.id === 'fldFirst') { p.settings.first = t.checked; markDirty(); renderProps(); }
    if (t.dataset.op !== undefined) {
      const arr = (p.settings.ops || []).filter(x => x !== t.dataset.op);
      if (t.checked) arr.push(t.dataset.op);
      if (!arr.length) { t.checked = true; arr.push(t.dataset.op); showToast('Нужно выбрать хотя бы одно действие', 'warn'); }
      p.settings.ops = arr;
      markDirty(); renderProps();
    }
    if (t.dataset.correct !== undefined) {
      p.questions[+t.dataset.correct].correct = +t.dataset.ai;
      renderTools(); markDirty();
    }
  });

  /* Рисование уровня */
  const canvas = $('#gameCanvas');
  canvas.addEventListener('pointerdown', e => {
    if (state.mode === 'play' && state.engine && state.engine.onClick) {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * W;
      const y = (e.clientY - rect.top) / rect.height * H;
      state.engine.onClick(x, y);
      return;
    }
    if (state.mode !== 'edit' || !hasGrid(state.project)) return;
    state.painting = true;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignored */ }
    const { cx, cy } = cellFromEvent(e);
    state.engine.paint(cx, cy, e.button === 2 ? 'erase' : state.tool);
    renderProps(); updateChips();
  });
  canvas.addEventListener('pointermove', e => {
    if (!state.painting || state.mode !== 'edit' || !hasGrid(state.project)) return;
    const { cx, cy } = cellFromEvent(e);
    state.engine.paint(cx, cy, state.tool);
    renderProps(); updateChips();
  });
  const stopPaint = () => { state.painting = false; };
  canvas.addEventListener('pointerup', stopPaint);
  canvas.addEventListener('pointercancel', stopPaint);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  /* Клавиатура */
  window.addEventListener('keydown', e => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (state.mode === 'play' && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) pressed[e.code] = true;
    keys[e.code] = true;
    if (e.code === 'Escape') {
      if (isFullscreen()) exitFullscreen();
      else if (state.mode === 'play') setMode('edit');
    }
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  /* Ссылка из адресной строки */
  if (location.hash.includes('p=')) {
    const obj = projectFromLink(location.hash);
    if (obj) {
      importProject(obj);
      history.replaceState(null, '', location.href.split('#')[0]);
    } else {
      showToast('Ссылка оказалась нерабочей 😕', 'warn');
    }
  }
}

/* ---------- Главный цикл ---------- */
const canvas = $('#gameCanvas');
const ctx = canvas.getContext('2d');
let lastTime = 0, hudAcc = 0, fxEngine = null, fxWasFinished = false, lastHudHtml = '';
function loop(ts) {
  const dt = lastTime ? Math.min((ts - lastTime) / 1000, 0.05) : 0;
  lastTime = ts;
  visualClock = ts / 1000;
  if (state.engine && state.project) {
    if (state.engine !== fxEngine) {
      fxEngine = state.engine;
      fxWasFinished = !!state.engine.finished;
      FX.clear();
      lastHudHtml = '';
    }
    if (state.engine.finished && !fxWasFinished) FX.celebrate();
    fxWasFinished = !!state.engine.finished;
    if (state.mode === 'play') {
      state.engine.update(dt);
      hudAcc += dt;
      if (hudAcc > 0.15) {
        hudAcc = 0;
        const html = missionHudHtml() + state.engine.getHud();
        if (html !== lastHudHtml) { $('#playHud').innerHTML = html; lastHudHtml = html; }
        renderMission();
      }
    }
    FX.update(dt);
    state.engine.draw(ctx);
    drawSceneFinish(ctx);
    FX.draw(ctx);
  }
  for (const k in pressed) delete pressed[k];
  requestAnimationFrame(loop);
}

/* ---------- Запуск ---------- */
renderGallery();
updateCoinChip();
bindEvents();
requestAnimationFrame(loop);
