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

const DIFF = {
  easy:   { speed: 0.82, traffic: 0.7, time: 90, label: 'Лёгкая' },
  normal: { speed: 1.0,  traffic: 1.0, time: 60, label: 'Средняя' },
  hard:   { speed: 1.28, traffic: 1.4, time: 40, label: 'Трудная' }
};

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
function hasGrid(p) { return !!p && (p.template === 'platformer' || p.template === 'collector'); }

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
function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

let audioCtx = null;
function beep(freq = 600, dur = 0.06) {
  if (!state.project || state.project.settings.sound === false) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.055, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g); g.connect(audioCtx.destination);
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
  if (code === 'Space') pressed.Space = true;
  setTimeout(() => { keys[code] = false; }, ms);
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
  }
};

const TIPS = {
  platformer: [
    'Сначала поставь 🚩 старт, затем добавь ⭐ звёзды.',
    'Платформы должны быть под звёздами, иначе герой не достанет их.',
    'Проверь игру кнопкой «Играть» — так сразу видно, что нужно исправить.'
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
  erase:  { em: '🧽', label: 'Ластик', desc: 'Стирай лишние предметы, чтобы освободить место.' }
};

/* Поведение встроенных предметов и помощники для своих предметов */
const BUILTIN_EFFECT = {
  wall: 'solid', star: 'goal', coin: 'points25', gem: 'points100',
  heart: 'life', spike: 'hurt', tramp: 'tramp', finish: 'finish',
  enemy: 'enemy', start: 'start', erase: 'erase'
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
    { text: 'Что вырастает из желудя?', answers: ['Яблоня', 'Дуб', 'Берёза', 'Сосна'], correct: 1 }
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
      lives: 3,
      sound: true,
      road: '#3b3f52',
      car: '🚗',
      basket: '🧺',
      traffic: 1,
      voice: false,
      narrate: true
    }
  };
  const extras = {
    snake:     { snakeColor: '#38c172', food: '🍎' },
    pong:      { paddle: '#5ac8fa', target: 5 },
    arkanoid:  { rows: 4, paddleColor: '#ffd166' },
    shooter:   { ship: '🚀', fireRate: 1 },
    tictactoe: { smart: 'normal', first: true, mark: '❌' },
    memory:    { pairs: 6, deck: 'animals' },
    math:      { ops: ['+', '-'], count: 8, seconds: 12 }
  };
  if (extras[templateId]) Object.assign(p.settings, extras[templateId]);
  if (templateId === 'platformer') p.level = defaultPlatformerLevel();
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
  renderSaved();
}
function markDirty() {
  state.dirty = true;
  $('#saveStatus').textContent = '● Есть изменения…';
  $('#saveStatus').classList.add('dirty');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => saveProject(true), 1000);
}

/* ---------- Движки игр ---------- */
class BaseEngine {
  constructor(p) { this.p = p; this.onFinish = () => {}; }
  reset() {}
  setPlaying(on) {}
  update(dt) {}
  draw(ctx) {}
  getHud() { return ''; }
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
    ctx.fillStyle = this.p.settings.bg;
    ctx.fillRect(0, 0, W, H);

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
        if (!v) continue;
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
          this.enemies.push({ x: x * CELL + 2, y: y * CELL + 4, w: 28, h: 28, vx: (Math.random() < .5 ? -1 : 1) * 70 });
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
      h.vy = -560;
      h.onGround = false;
      beep(680, .07);
    }
    h.vy = Math.min(h.vy + 1500 * dt, 900);
    h.onGround = false;
    this.resolveAxis(h, 'x', h.vx * dt, true);
    this.resolveAxis(h, 'y', h.vy * dt, true);
    if (h.x < 0) h.x = 0;
    if (h.x + h.w > W) h.x = W - h.w;

    for (const e of this.enemies) {
      const step = e.vx * dt * s.speed;
      const ahead = Math.floor((e.x + (step > 0 ? e.w + 2 : -2)) / CELL);
      const ownRow = Math.floor((e.y + e.h / 2) / CELL);
      const below = Math.floor((e.y + e.h + 4) / CELL);
      const noFloor = below >= ROWS || this.grid[below][ahead] !== 'wall';
      if (noFloor || this.isSolid(ahead, ownRow, false) || e.x + step < 0 || e.x + step + e.w > W) e.vx *= -1;
      e.x += e.vx * dt * s.speed;
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
    this.invuln = 1.2;
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
            dir: Math.floor(Math.random() * 4), timer: rand(0.8, 2)
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
    const s = this.p.settings;
    const spd = 205 * s.speed;
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
      if (e.timer <= 0) { e.dir = Math.floor(Math.random() * 4); e.timer = rand(0.9, 2.2); }
      const [mx, my] = dirs[e.dir];
      const ox = e.x, oy = e.y;
      this.resolveAxis(e, 'x', mx * 62 * s.speed * dt);
      this.resolveAxis(e, 'y', my * 62 * s.speed * dt);
      if (Math.abs(e.x - ox) < 0.01 && Math.abs(e.y - oy) < 0.01) { e.dir = (e.dir + 1) % 4; e.timer = rand(0.6, 1.4); }
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
    this.invuln = 1.2;
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
      this.spawnTimer = rand(0.75, 1.35) / (diff.traffic * s.traffic) / s.speed;
    }
    const roadSpeed = (255 + this.dist * 0.35) * s.speed * diff.speed;
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
          this.invuln = 1.3;
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
    ctx.fillStyle = '#3ba55d';
    ctx.fillRect(0, 0, W, H);
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
  constructor(p, layer) { super(p); this.layer = layer; this.timer = null; this.questions = []; }
  reset() {
    clearTimeout(this.timer);
    this.layer.innerHTML = '';
    this.index = 0; this.score = 0; this.answered = false; this.finished = false;
    this.questions = this.p.questions.filter(q => q.text.trim() && q.answers.some(a => a.trim()));
  }
  setPlaying(on) {
    this.layer.classList.toggle('active', on);
    if (!on) { this.layer.innerHTML = ''; return; }
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
    }, 1400);
  }
  update() {}
  draw(ctx) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, this.p.settings.bg);
    g.addColorStop(1, '#4a3aa8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
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
           `<span class="hud-pill">Вопрос ${Math.min(this.index + 1, this.questions.length)}/${this.questions.length}</span>`;
  }
  destroy() { clearTimeout(this.timer); this.layer.innerHTML = ''; this.layer.classList.remove('active'); }
}

class CatcherEngine extends BaseEngine {
  constructor(p) { super(p); this.reset(); }
  reset() {
    this.player = { x: W / 2 - 42, y: H - 58, w: 84, h: 44 };
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
      const type = r < 0.68 ? 'apple' : (r < 0.87 ? 'bomb' : 'star');
      this.items.push({ x: rand(45, W - 45), y: -34, w: 30, h: 30, type, vy: rand(0, 60) });
      this.spawnTimer = rand(0.55, 1.05) / (diff.traffic * s.traffic);
    }
    const fall = (165 + this.time * 1.5) * s.speed * diff.speed;
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
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, s.bg);
    g.addColorStop(1, shade(s.bg, 55));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
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
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top || this.p.settings.bg);
    g.addColorStop(1, bottom || shade(this.p.settings.bg, 45));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}

class SnakeEngine extends ArcadeEngine {
  reset() {
    this.cols = 28; this.rows = 16; this.cell = 28;
    this.ox = Math.floor((W - this.cols * this.cell) / 2);
    this.oy = Math.floor((H - this.rows * this.cell) / 2);
    this.snake = [{ x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }];
    this.dir = { x: 1, y: 0 }; this.nextDir = { x: 1, y: 0 };
    this.score = 0; this.lives = this.p.settings.lives || 3;
    this.acc = 0; this.finished = false;
    this.step = 0.15 / (this.p.settings.speed || 1);
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
        const ex = this.ox + seg.x * this.cell + (this.dir.x > 0 ? 19 : 9);
        const ey = this.oy + seg.y * this.cell + (this.dir.y > 0 ? 19 : 9);
        ctx.beginPath(); ctx.arc(ex, this.oy + seg.y * this.cell + 11, 2.2, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(this.ox + seg.x * this.cell + 11, ey, 2.2, 0, 7); ctx.fill();
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
    this.target = clamp(+s.target || 5, 1, 15);
    this.pw = { x: 34, y: H / 2 - 40, w: 14, h: 80 };
    this.aw = { x: W - 48, y: H / 2 - 40, w: 14, h: 80 };
    this.scoreP = 0; this.scoreA = 0; this.finished = false;
    this.serve(Math.random() < .5 ? 1 : -1);
  }
  serve(dir) {
    const s = this.p.settings, diff = DIFF[s.difficulty] || DIFF.normal;
    const sp = 320 * s.speed * diff.speed;
    this.ball = { x: W / 2, y: H / 2, r: 9, vx: sp * (dir || 1) * .8, vy: rand(-sp * .45, sp * .45) };
  }
  update(dt) {
    if (this.finished) return;
    const s = this.p.settings;
    const mv = 440 * s.speed * dt;
    if (keys.ArrowUp || keys.KeyW) this.pw.y -= mv;
    if (keys.ArrowDown || keys.KeyS) this.pw.y += mv;
    this.pw.y = clamp(this.pw.y, 8, H - 8 - this.pw.h);
    const aiSp = (s.difficulty === 'easy' ? 180 : s.difficulty === 'hard' ? 440 : 300) * s.speed;
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
      b.vx = Math.min(Math.abs(b.vx) * 1.035, 760);
      b.vy = ((b.y - (this.pw.y + this.pw.h / 2)) / (this.pw.h / 2)) * 390 * s.speed;
      beep(640, .05);
    }
    if (aabb(box, this.aw) && b.vx > 0) {
      b.x = this.aw.x - b.r;
      b.vx = -Math.min(Math.abs(b.vx) * 1.035, 760);
      b.vy = ((b.y - (this.aw.y + this.aw.h / 2)) / (this.aw.h / 2)) * 390 * s.speed;
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
    this.pad = { x: W / 2 - 60, y: H - 30, w: 120, h: 14 };
    this.ball = { x: W / 2, y: H - 50, r: 7, vx: rand(-.5, .5) * 300, vy: -300 };
    this.speed = 310 * s.speed * diff.speed;
    this.score = 0; this.lives = s.lives || 3; this.stuck = true; this.finished = false;
    const rows = clamp(+s.rows || 4, 2, 7), cols = 10, bw = 68, gap = 7;
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
    const mv = 460 * s.speed * dt;
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
      b.vx += ((b.x - (this.pad.x + this.pad.w / 2)) / (this.pad.w / 2)) * 130;
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
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 7; c++) {
        this.aliens.push({ x: 95 + c * 88, y: 54 + r * 54, w: 40, h: 36,
          alive: true, em: r === 0 ? '👽' : '👾' });
      }
    }
    this.alienSpeed = (s.difficulty === 'easy' ? 32 : s.difficulty === 'hard' ? 82 : 52) * s.speed * diff.speed;
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
      this.fireCd = 0.26 / (s.fireRate || 1);
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
      a.y += 7 * dt;
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
        if (Math.random() < .22) this.drops.push({ x: a.x + a.w / 2, y: a.y, w: 22, h: 22 });
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
    }, 420);
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
    if (smart === 'easy' || Math.random() < .12) return free[Math.floor(rand(0, free.length))];
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
    this.pairs = clamp(+s.pairs || 6, 4, 10);
    const sets = {
      animals: ['🐶','🐱','🦊','🐻','🐼','🦁','🐸','🐵','🐯','🐷'],
      food: ['🍎','🍌','🍇','🍓','🍒','🍉','🥕','🍕','🍔','🍩'],
      space: ['🚀','🪐','⭐','🌙','☀️','🌍','🛸','👽','🌌','🔭']
    };
    const emojis = (sets[s.deck] || sets.animals).slice(0, this.pairs);
    const deck = emojis.concat(emojis).sort(() => Math.random() - .5);
    this.cards = deck.map(em => ({ em, flipped: false, matched: false }));
    this.cols = this.pairs <= 6 ? 4 : 5;
    this.rows = Math.ceil(this.cards.length / this.cols);
    this.cw = 88; this.ch = 88; this.gap = 10;
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
      if (c.flipped || c.matched) drawEmoji(ctx, c.em, r.x + r.w / 2, r.y + r.h / 2, 48);
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
    const diff = this.p.settings.difficulty;
    const max = diff === 'easy' ? 12 : diff === 'hard' ? 60 : 30;
    const op = this.ops[Math.floor(rand(0, this.ops.length))];
    let a = Math.floor(rand(1, max)) + 1;
    let b = Math.floor(rand(1, Math.min(max, 12))) + 1;
    let sign = op, ans;
    if (op === '+') ans = a + b;
    else if (op === '-') { if (a < b) { const t = a; a = b; b = t; } ans = a - b; }
    else if (op === '×') { b = Math.min(b, 9); ans = a * b; }
    else { sign = ':'; ans = b; a = b * (Math.floor(rand(1, 6)) + 1); }
    const opts = new Set([ans]);
    while (opts.size < 4) {
      const d = ans + Math.floor(rand(-7, 8));
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

function makeEngine(p) {
  let e;
  if (p.template === 'platformer') e = new PlatformerEngine(p);
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
  else e = new QuizEngine(p, $('#interactiveLayer'));
  e.onFinish = handleFinish;
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
      <span class="card-tag">${t.tag} · ${date}</span>
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
      <span class="card-tag">${t.tag}</span>
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
  let n = 0;
  if (p.level && p.level.grid) n = p.level.grid.flat().filter(Boolean).length;
  if (p.template === 'quiz') n = p.questions.length;
  if (p.template === 'racer' || p.template === 'catcher') n = Math.round(p.settings.traffic * 10);
  if (p.template === 'pong') n = p.settings.target;
  if (p.template === 'arkanoid') n = p.settings.rows * 10;
  if (p.template === 'shooter') n = 21;
  if (p.template === 'tictactoe') n = 9;
  if (p.template === 'memory') n = p.settings.pairs * 2;
  if (p.template === 'math') n = p.settings.count;
  if (p.template === 'snake') n = Math.round(p.settings.speed * 10);
  const labels = {
    quiz: '❓ вопросов', racer: '🚗 поток', catcher: '🍎 поток', pong: '🏆 до победы',
    arkanoid: '🧱 кирпичей', shooter: '👾 пришельцев', tictactoe: '⭕ клеток',
    memory: '🃏 карточек', math: '🧮 примеров', snake: '⚡ скорость'
  };
  $('#chipObjects').textContent = `${labels[p.template] || '🪐 объектов'}: ${n}`;
  $('#chipMode').textContent = state.mode === 'play' ? '▶ Режим: игра' : '✏️ Режим: редактор';
}
function setMode(mode) {
  if (!state.project) return;
  state.mode = mode;
  const playing = mode === 'play';
  $('#editorGrid').classList.toggle('playing', playing);
  $('#btnMode').textContent = playing ? '✏️ В редактор' : '▶ Играть';
  $('#btnMode').className = playing ? 'btn btn-accent' : 'btn btn-primary';
  $('#playHud').classList.toggle('hidden', !playing);
  $('#resultOverlay').classList.add('hidden');
  if (!playing) { Voice.stop(); Speech.stop(); }
  state.engine.reset();
  state.engine.setPlaying(playing);
  if (playing) {
    $('#playHud').innerHTML = state.engine.getHud();
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
  const withRules = ['platformer', 'collector', 'racer', 'catcher', 'snake', 'pong', 'arkanoid', 'shooter', 'math'].includes(p.template);
  const withLives = ['platformer', 'collector', 'racer', 'catcher', 'arkanoid', 'shooter', 'math'].includes(p.template);
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
  const list = ['🚀', '🐱', '🦊', '🐼', '🤖', '🐸', '🦄', '🐯', '👾', '🐙'];
  return `<div class="tool-section">
    <h4 class="tool-title">🦸 Выбери героя</h4>
    <div class="emoji-grid">${list.map(e => `<button class="emoji-btn ${p.settings.hero === e ? 'active' : ''}" data-hero="${e}">${e}</button>`).join('')}</div>
  </div>`;
}
function levelSection(p) {
  const order = p.template === 'platformer'
    ? ['wall', 'star', 'coin', 'gem', 'heart', 'tramp', 'spike', 'finish', 'enemy', 'start', 'erase']
    : ['wall', 'star', 'coin', 'gem', 'heart', 'spike', 'finish', 'enemy', 'start', 'erase'];
  const wallLabel = p.template === 'platformer' ? 'Платформа' : 'Стена';
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
    <button class="btn btn-ghost" data-action="add-question" style="width:100%" ${p.questions.length >= 12 ? 'disabled' : ''}>＋ Добавить вопрос</button>
    <p class="hint-mini">Отметь кружком правильный ответ. Можно добавить до 12 вопросов.</p>
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
      <input type="range" id="fldTarget" min="1" max="15" step="1" value="${p.settings.target}">
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
      <input type="range" id="fldRows" min="2" max="7" step="1" value="${p.settings.rows}">
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
      ${[4, 6, 8, 10].map(n => `<button data-pairs="${n}" class="${+p.settings.pairs === n ? 'active' : ''}">${n} пар</button>`).join('')}
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
function renderTools() {
  const p = state.project;
  if (!p) return;
  let html = commonSettings(p);
  if (p.template === 'platformer' || p.template === 'collector') html += heroSection(p) + levelSection(p) + customItemsSection(p);
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
  $('#toolsPanel').innerHTML = html;
}
function renderProps() {
  const p = state.project;
  if (!p) return;
  let html = '';
  if (hasGrid(p)) {
    const it = getItem(p, state.tool) || ITEMS.wall;
    const desc = state.tool === 'wall' && p.template === 'platformer'
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
    shooter: [['🚀 Корабль', p.settings.ship], ['👾 Пришельцев', '21'], ['⚡ Стрельба', Number(p.settings.fireRate).toFixed(1) + '×']],
    tictactoe: [['🎯 Соперник', ({ easy: 'Сонный', normal: 'Обычный', hard: 'Умный' })[p.settings.smart] || 'Обычный'], ['✍️ Первый ход', p.settings.first ? 'Ты' : 'Компьютер']],
    memory: [['🃏 Пар', p.settings.pairs], ['🃏 Карточек', p.settings.pairs * 2], ['🎨 Колода', ({ animals: 'Зверята', food: 'Еда', space: 'Космос' })[p.settings.deck] || 'Зверята']],
    math: [['❓ Примеров', p.settings.count], ['⏱ Секунд', p.settings.seconds], ['➗ Действий', (p.settings.ops || []).join(' ')]]
  };
  if (extraStats[p.template]) {
    html += `<div class="prop-card"><h4>📊 Настройки</h4>` +
      extraStats[p.template].map(([l, v]) => `<div class="stat-row"><span>${l}</span><b>${v}</b></div>`).join('') + `</div>`;
  }
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
      <li><b>Выбери шаблон</b>: платформер, лабиринт, гонки, викторина, ловля яблок, змейка, пинг-понг, кирпичи, шутер, крестики-нолики, память или математика.</li>
      <li><b>Настрой игру слева</b>: цвета, героя, сложность, скорость, жизни. Можно включить голосовое управление.</li>
      <li><b>Сделай свой уровень</b>: рисуй по полю кистью и расставляй монетки, кристаллы, сердца, шипы, трамплины и финиш. А в разделе «✨ Свои предметы» придумай свой предмет — выбери картинку, название и что он будет делать.</li>
      <li><b>Нажми «▶ Играть»</b> и проверь игру. Кнопка «🔊 Рассказать правила» прочитает подсказку вслух.</li>
      <li><b>Сохрани или поделись</b>: «💾 Сохранить» — в браузере, «🌟 В галерею» — на общей странице, «🚀 Поделиться» — ссылка другу.</li>
    </ol>
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
  p.name = String(p.name || 'Моя игра').slice(0, 40);
  p.createdAt = p.createdAt || Date.now();
  p.updatedAt = Date.now();
  if (hasGrid(p)) {
    if (!p.level || !Array.isArray(p.level.grid) || p.level.grid.length !== ROWS) {
      p.level = obj.template === 'platformer' ? defaultPlatformerLevel() : defaultCollectorLevel();
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
      p.level = p.template === 'platformer' ? defaultPlatformerLevel() : defaultCollectorLevel();
      state.engine.reset(); markDirty(); renderProps(); updateChips();
      showToast('Пример уровня вернулся 🔄');
    }
    if (act === 'add-question') {
      if (p.questions.length >= 12) return;
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
    if (e.code === 'Escape' && state.mode === 'play') setMode('edit');
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
let lastTime = 0, hudAcc = 0;
function loop(ts) {
  const dt = lastTime ? Math.min((ts - lastTime) / 1000, 0.05) : 0;
  lastTime = ts;
  if (state.engine && state.project) {
    if (state.mode === 'play') {
      state.engine.update(dt);
      hudAcc += dt;
      if (hudAcc > 0.15) { hudAcc = 0; $('#playHud').innerHTML = state.engine.getHud(); }
    }
    state.engine.draw(ctx);
  }
  for (const k in pressed) delete pressed[k];
  requestAnimationFrame(loop);
}

/* ---------- Запуск ---------- */
renderGallery();
bindEvents();
requestAnimationFrame(loop);
