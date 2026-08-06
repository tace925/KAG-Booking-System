/* ============================================================
   MOUNTAIN OF THE LORD — KATOLONI
   Combined app.js  (data layer + public site + admin portal)
   ============================================================ */

/* ============================================================
   DATA LAYER (localStorage)
   ------------------------------------------------------------
   Everything the whole system reads/writes lives under one key.
   When you migrate to Supabase, each top-level object below
   becomes a table — that's why it's already shaped that way
   (arrays of flat records with ids + timestamps).
   ============================================================ */

const DB_KEY = 'motl_katoloni_v1';

/* ============================================================
   FIREBASE BACKEND (Auth + Firestore)
   Project: katoloni-system
   Storage: skipped for now (photos stay as base64 in DB)
   ============================================================ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB993Es_2c9SCOIYHgrG_co-A02f4qt9OU",
  authDomain: "katoloni-system.firebaseapp.com",
  projectId: "katoloni-system",
  storageBucket: "katoloni-system.firebasestorage.app",
  messagingSenderId: "997402953266",
  appId: "1:997402953266:web:fd416edef354cfc1d05e2b",
  measurementId: "G-NPGT2K3J73"
};

const FIRESTORE_DOC = { collection: 'appData', id: 'main' };
let _firebaseApp = null;
let _firestore = null;
let _auth = null;
let _cloudSaveTimer = null;
let _cloudReady = false;
let _cloudEnabled = true; // set false to force localStorage-only

function initFirebase() {
  if (typeof firebase === 'undefined') {
    console.warn('Firebase SDK not loaded — using localStorage only.');
    _cloudEnabled = false;
    return false;
  }
  try {
    if (!firebase.apps.length) {
      _firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    } else {
      _firebaseApp = firebase.app();
    }
    _firestore = firebase.firestore();
    _auth = firebase.auth();
    _cloudEnabled = true;
    return true;
  } catch (e) {
    console.error('Firebase init failed', e);
    _cloudEnabled = false;
    return false;
  }
}

/** Push current DB to Firestore (debounced). */
function scheduleCloudSave(db) {
  if (!_cloudEnabled || !_firestore) return;
  if (_cloudSaveTimer) clearTimeout(_cloudSaveTimer);
  _cloudSaveTimer = setTimeout(() => {
    pushDBToCloud(db).catch(err => console.warn('Cloud save failed:', err));
  }, 600);
}

/** Sign in anonymously and wait until Firebase confirms the session. */
function ensureAuthReady() {
  return new Promise((resolve) => {
    if (!_auth) { resolve(null); return; }
    const unsub = _auth.onAuthStateChanged(user => {
      if (user) {
        unsub();
        resolve(user);
      }
    });
    _auth.signInAnonymously().catch(err => {
      console.error('Anonymous sign-in failed:', err);
      resolve(null); // fall through — writes will fail, but app still loads
    });
  });
}

async function pushDBToCloud(db) {
  if (!_firestore) return;
  // Firestore doc limit ~1MB — strip nothing yet; warn if large
  const payload = JSON.parse(JSON.stringify(db));
  const approx = JSON.stringify(payload).length;
  if (approx > 900000) {
    console.warn('DB payload is large (~' + Math.round(approx/1024) + 'KB). Consider Firebase Storage for photos.');
  }
  await _firestore.collection(FIRESTORE_DOC.collection).doc(FIRESTORE_DOC.id).set({
    payload,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    version: payload.meta?.version || 0
  });
  _cloudReady = true;
}

async function pullDBFromCloud() {
  if (!_firestore) return null;
  const snap = await _firestore.collection(FIRESTORE_DOC.collection).doc(FIRESTORE_DOC.id).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return data.payload || null;
}

/**
 * Boot: init Firebase → pull cloud DB (or seed) → then run UI.
 * Falls back to localStorage if offline / rules block.
 */
async function bootApp() {
  initFirebase();
  await ensureAuthReady();   // ← ADD THIS LINE
  let db = null;

  if (_cloudEnabled && _firestore) {
    try {
      db = await pullDBFromCloud();
      if (db) {
        // Soft-migrate fields if needed (same as loadDB)
        if (!db.memberDocuments) db.memberDocuments = [];
        if (!db.protocolDraftMembers) db.protocolDraftMembers = [];
        if (!db.classRegisters) db.classRegisters = { disciple1: [], disciple2: [], disciple3: [] };
        localStorage.setItem(DB_KEY, JSON.stringify(db));
        _cloudReady = true;
        console.info('Loaded DB from Firestore.');
      } else {
        // No cloud data yet — use local or seed, then upload
        db = loadDBLocal();
        await pushDBToCloud(db);
        console.info('Seeded Firestore from local/seed data.');
      }
    } catch (e) {
      console.warn('Cloud load failed, using localStorage.', e);
      db = loadDBLocal();
    }
  } else {
    db = loadDBLocal();
  }

  // Existing public/admin init (was on DOMContentLoaded)
  initNav();
  initThemeToggle();
  initTyping();
  renderLeadershipPyramid(db);
  initCardTapFlip();
  renderNoticeboard(db);
  renderPublicTour(db);
  renderPublicProject(db);
  renderPublicWall(db);
  renderPublicLibrary(db);
  initMenuAndSettings();
  initAdminPortal();
  initBookingPublic();
  initContactPublic();
  updateHeaderBellBadge(db);
  if (typeof injectRegisterStyles === 'function') injectRegisterStyles();
}

function loadDBLocal() {
  const raw = localStorage.getItem(DB_KEY);
  if (!raw) {
    localStorage.setItem(DB_KEY, JSON.stringify(SEED_DATA));
    return structuredClone(SEED_DATA);
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.meta || parsed.meta.version !== SEED_DATA.meta.version) {
      console.warn(`DB schema outdated (had v${parsed.meta?.version}, need v${SEED_DATA.meta.version}) — reseeding.`);
      localStorage.setItem(DB_KEY, JSON.stringify(SEED_DATA));
      return structuredClone(SEED_DATA);
    }
    if (!parsed.portalProfiles) parsed.portalProfiles = {};
    if (!parsed.portalProfiles.bishop) {
      parsed.portalProfiles.bishop = { name: 'Bishop', phone: '', email: '', photo: '' };
    }
    if (!parsed.memberDocuments) parsed.memberDocuments = [];
    if (!parsed.protocolDraftMembers) parsed.protocolDraftMembers = [];
    if (!parsed.classRegisters) {
      parsed.classRegisters = { disciple1: [], disciple2: [], disciple3: [] };
    }
    ['disciple1', 'disciple2', 'disciple3'].forEach(k => {
      if (!parsed.classRegisters[k]) parsed.classRegisters[k] = [];
    });
    return parsed;
  } catch (e) {
    console.error('DB parse failed, reseeding', e);
    localStorage.setItem(DB_KEY, JSON.stringify(SEED_DATA));
    return structuredClone(SEED_DATA);
  }
}


const SEED_DATA = {
  meta: {
    version: 10,
    createdAt: new Date().toISOString()
  },

  /* ---------- Owner / Admin profile (drives the Admin Portal) ---------- */
  owner: {
    name: 'Tevin Mulinge',
    phone: '0743936403',
    email: 'tevinmulinge48@gmail.com',
    photo: '',
    history: [
      { name: 'Tevin Mulinge', photo: '', from: '28 Jul 2026', to: 'Present', current: true }
    ]
  },

  /* ---------- People shown on the Home flip-cards ---------- */
  leadership: [
    { id: 'p1', tier: 1, name: 'Bishop Samuel Katoloni', role: 'Bishop', photo: '' },
    { id: 'p2', tier: 1, name: "Mama Grace Katoloni", role: "Bishop's Wife", photo: '' },
    { id: 'p3', tier: 1, name: 'Rev. Daniel Mwangi', role: 'Reverend', photo: '' },
    { id: 'p4', tier: 2, name: 'Deacon John Otieno', role: 'Deacon', photo: '' },
    { id: 'p5', tier: 2, name: 'Deacon Peter Kamau', role: 'Deacon', photo: '' },
    { id: 'p6', tier: 2, name: 'Deacon Mary Wanjiru', role: 'Deacon', photo: '' },
    { id: 'p7', tier: 2, name: 'Deacon Joseph Muli', role: 'Deacon', photo: '' },
    { id: 'p8', tier: 2, name: 'Deacon Ruth Nekesa', role: 'Deacon', photo: '' },
    { id: 'p9', tier: 3, name: 'Alice Wambui', role: 'Treasurer', photo: '' },
    { id: 'p10', tier: 3, name: 'Esther Njeri', role: 'Chairlady', photo: '' }
  ],

  /* ---------- Tour section ----------
     "singles" = one fixed named photo slot each.
     "groups"  = expandable named slots — pre-seeded with the obvious
     entries (Bishop's Office, Men, Male, etc.) but the admin can add
     or remove any number of extra named photos per group. ---------- */
  tour: {
    history: "Mountain of the Lord Prayer Center began as a small home fellowship in Katoloni, gathering under a single roof with a handful of believers. What started as prayer meetings in a living room has grown into a full congregation with its own home — built one season, one offering, one act of faith at a time.",
    singles: {
      gate: '', front: '', inside: '', side: '', aerial: '', parking: '', busParking: '', communal: ''
    },
    groups: {
      administration: [
        { id: 'adm1', name: "Bishop's Office", image: '' },
        { id: 'adm2', name: "Bishop's Wife's Office", image: '' },
        { id: 'adm3', name: "Reverend's Office", image: '' }
      ],
      departments: [
        { id: 'dep1', name: 'Men', image: '' },
        { id: 'dep2', name: 'Women', image: '' },
        { id: 'dep3', name: 'Youth', image: '' },
        { id: 'dep4', name: 'Choir', image: '' }
      ],
      washrooms: [
        { id: 'wc1', name: 'Male', image: '' },
        { id: 'wc2', name: 'Female', image: '' }
      ],
      homeCells: [],
      hostels: []
    }
  },

  /* ---------- Project section (past / present / upcoming) ---------- */
  project: {
    history: "The church's building project reflects the same story of faith as the ministry itself — small beginnings, steady growth, and a vision for what's still ahead. This page tracks that journey in three parts.",
    past: { media: [], caption: 'How the church looked when it began' },
    present: { media: [], caption: 'The church today' },
    upcoming: { media: [], caption: "What's planned next" }
  },

  /* ---------- Notice Board ---------- */
  noticeboard: {
    theme: 'THE YEAR OF UNLOCKING THE DIVINE POTENTIAL TO GREATER SEASONS AND DESTINIES',
    verseRef: 'Isaiah 45:3',
    verseText: 'I will give you the treasures of darkness and hidden riches of secret places, that you may know that I, the Lord, who call you by your name, am the God of Israel.',
    mission: 'Machakos K.A.G is a theologically sound and culturally relevant church that is engaging, evangelizing and equipping communities with the gospel through the transforming power of Jesus Christ through the Holy Spirit.',
    vision: 'Machakos KAG is there to raise Holy Spirit empowered members and leaders, who will raise a generation to serve and influence every sphere of society through the love of Jesus Christ in collaboration with His global church.',
    objectives: [
      'Reaching the lost and establishing strong Home Cells in Machakos Town and its surrounding environment.',
      'Transforming our places of community guided by Jeremiah 29:7-8.',
      'Strengthening the faith of children and youth guided by Psalms 78:5-7.',
      'Training and growing leaders guided by Ephesians 4:11-12.',
      'Rooting our effort in right theology guided by Titus 2:1.'
    ],
    values: 'Machakos KAG is guided by four values at the base of our spiritual guidance: BIBLE, PRAYER, RELATIONSHIPS and SERVICE.',
    tagline: 'ALL SOULS MATTER',
    posts: [
      { id: 'n1', scope: 'global', postedBy: 'Admin', urgency: 'important', text: 'Rent for June is due on or before the 5th. Payments after the 10th attract a 10% penalty.', at: new Date().toISOString() }
    ]
  },

  /* ---------- Katoloni Wall — disciple class graduates ----------
     Pipeline: Protocol intakes new joiners → sends list to Admin →
     Admin assigns into Disciple Class 1 → that leader confirms who's
     ready → sends confirmed list to Admin → Admin generates
     certificates & publishes to the Wall under "class1" → same
     people cycle through "class2", "class3" → finally "general"
     once they've completed all three. ---------- */
  graduates: [
    // { id, name, photo, category: 'class1'|'class2'|'class3'|'general', month, year, status: 'active'|'revoked', revokeReason, at }
  ],

  /* ---------- Member Pipeline (Protocol → Admin → Disciple Classes → Wall) ----------
     Protocol acts as receptionist: adds new members (name, phone, email, year).
     Lists are sent as "documents" between portals.
     stage: 'intake' | 'class1' | 'class2' | 'class3' | 'general'
     status: 'new' | 'viewed' | 'sent' | 'processed'
  ---------- */
  memberDocuments: [
    // { id, fromRole, toRole, stage, title, members: [{id, name, phone, email, year}], at, status }
  ],
  // Local working list for Protocol before sending
  protocolDraftMembers: [
    // { id, name, phone, email, year, at }
  ],
  /* Class attendance registers (Disciple 1/2/3)
     Populated when Admin sends a list to that class.
     presentCount / absentCount → attendance % (battery bar).
     Ready = pct >= 80 and at least 1 attendance mark. */
  classRegisters: {
    disciple1: [],
    disciple2: [],
    disciple3: []
  },

  /* ---------- Portal profiles — Protocol + the 3 Disciple Class portals ---------- */
  portalProfiles: {
    bishop:    { name: 'Bishop',           phone: '', email: '', photo: '' },
    protocol:  { name: 'Protocol Team',   phone: '', email: '', photo: '' },
    disciple1: { name: 'Disciple Class 1', phone: '', email: '', photo: '' },
    disciple2: { name: 'Disciple Class 2', phone: '', email: '', photo: '' },
    disciple3: { name: 'Disciple Class 3', phone: '', email: '', photo: '' }
  },

  /* ---------- Complaints raised by the 4 portals, addressed to Admin/Bishop ---------- */
  complaints: [
    // { id, fromRole, toRole, title, issue, attachment, at, status: 'open'|'resolved' }
  ],

  /* ---------- Library ---------- */
  library: {
    sections: [
      { id: 's1', name: 'Sunday School' },
      { id: 's2', name: 'Theology' },
      { id: 's3', name: 'Youth Materials' },
      { id: 's4', name: 'Discipleship' },
      { id: 's5', name: 'Prayer & Healing' },
      { id: 's6', name: 'Biography / History' }
    ],
    items: [
      // { id, sectionId, title, author, qty, notes }
    ],
    loans: [
      // { id, itemId, borrowerName, borrowerPhone, borrowedAt, dueAt, returnedAt, status: 'out'|'returned' }
    ],
    requests: [
      // { id, itemId, name, phone, message, at, status: 'pending'|'fulfilled'|'declined' }
    ],
    rules: 'Borrow up to 3 books for 14 days. Renew once if no one is waiting. Lost or damaged books must be replaced or paid for.'
  },

  /* ---------- Contact page — admin-editable "Get in Touch" content ---------- */
  contact: {
    email: 'info@motlkatoloni.org',
    phone: '0721514653',
    location: 'Katoloni, Machakos County, Kenya',
    hours: 'Sun: 8am – 1pm (Service) · Mon–Fri: 9am – 5pm (Office)',
    facebook: 'https://facebook.com',
    youtube: 'https://youtube.com'
  },

  /* ---------- Contact submissions (from the public "Send a Message" form) ---------- */
  contactSubmissions: [
    // { id, name, email, message, at, status: 'new'|'stored', storedAt }
  ],

  /* ---------- Auth: passcodes for every portal ---------- */
  passcodes: [
    { id: 'sa1', role: 'super_admin', label: 'Bishop', code: 'admin-4321', generatedBy: 'system', generatedAt: new Date().toISOString(), revoked: false }
  ],

  /* ---------- Cross-portal Send / Received messages ---------- */
  messages: [
    // { id, fromRole, toRole, subject, body, attachment, at, readAt }
  ],

  /* ---------- Weekly report rollups ---------- */
  reports: [
    // { id, fromRole, toRole:'super_admin', body, at }
  ],

  /* ---------- System-wide audit log ---------- */
  auditLog: [
    // { id, actorRole, actorLabel, action, target, at }
  ],

  /* ---------- Booking module ---------- */
  booking: {
    rooms: [
      { id: 'r1', name: 'Standard Room', rate: 1500, capacity: 2 },
      { id: 'r2', name: 'Deluxe Room', rate: 2500, capacity: 3 }
    ],
    itemCatalog: [
      { id: 'blanket', name: 'Blanket', freeQty: 1, extraCost: 10 }
    ],
    mpesaNumbers: { primary: '0704323654', alternative: '0704323654' },
    bishopContact: { phone: '0721514653', note: 'For church matters and spiritual support' },
    guests: [],
    bookings: [],
    itemCharges: [],
    payments: []
  }
};

/* ---------- Core read/write ---------- */
function loadDB() {
  return loadDBLocal();
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  scheduleCloudSave(db);
}

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/* ---------- Audit helper ---------- */
function logAudit(actorRole, actorLabel, action, target = '') {
  const db = loadDB();
  db.auditLog.unshift({
    id: uid('log'),
    actorRole,
    actorLabel,
    action,
    target,
    at: new Date().toISOString()
  });
  saveDB(db);
}

/* ---------- Portal identity ----------
   Drives the Menu dropdown, passcode routing, and every "which
   portal am I in" decision across the member-portal shell. ---------- */
const PORTAL_DEFS = {
  admin:     { key: 'admin',     label: 'Admin',              icon: '🔑' },
  bishop:    { key: 'bishop',    label: 'Bishop',             icon: '✝' },
  protocol:  { key: 'protocol',  label: 'Protocol',           icon: '🛎' },
  disciple1: { key: 'disciple1', label: 'Disciple Class 1',   icon: '📖' },
  disciple2: { key: 'disciple2', label: 'Disciple Class 2',   icon: '📖' },
  disciple3: { key: 'disciple3', label: 'Disciple Class 3',   icon: '📖' }
};
const PORTAL_PASSCODE_PREFIX = { bishop: 'bsh', protocol: 'prt', disciple1: 'dis1', disciple2: 'dis2', disciple3: 'dis3' };

/* ---------- Reusable inline SVG bar chart (Report tabs) ---------- */
function svgBarChartHTML(stats, width = 680, height = 240) {
  const max = Math.max(1, ...stats.map(s => s.value));
  const slot = (width - 60) / stats.length;
  const barW = Math.min(64, slot - 24);
  const chartH = height - 50;
  const bars = stats.map((s, i) => {
    const x = 40 + i * slot + (slot - barW) / 2;
    const h = Math.round((s.value / max) * chartH);
    const y = chartH - h + 20;
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 2)}" rx="6" fill="${s.color}" opacity="0.92"/>
      <text x="${x + barW / 2}" y="${y - 8}" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text-hi)">${s.value}</text>
      <text x="${x + barW / 2}" y="${height - 6}" text-anchor="middle" font-size="10.5" fill="var(--text-low)">${s.label}</text>
    `;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%; max-width:${width}px; height:auto; margin-top:6px; display:block;">${bars}</svg>`;
}

/* ---------- Image helper: resize + compress to base64 ---------- */
function fileToBase64(file, maxDim = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   PUBLIC SITE BEHAVIOR
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  bootApp().catch(err => {
    console.error('bootApp failed', err);
    const db = loadDBLocal();
    if (typeof injectRegisterStyles === 'function') injectRegisterStyles();
    initNav();
    initThemeToggle();
    initTyping();
    renderLeadershipPyramid(db);
    initCardTapFlip();
    renderNoticeboard(db);
    renderPublicTour(db);
    renderPublicProject(db);
    renderPublicWall(db);
    renderPublicLibrary(db);
    initMenuAndSettings();
    initAdminPortal();
    initBookingPublic();
    initContactPublic();
    updateHeaderBellBadge(db);
  });
});

function injectRegisterStyles() {
  if (document.getElementById('registerStyles')) return;
  const s = document.createElement('style');
  s.id = 'registerStyles';
  s.textContent = `
    .att-battery{
      position:relative;height:22px;min-width:100px;border-radius:6px;
      background:var(--bg-panel-3);border:1px solid var(--line);overflow:hidden;
    }
    .att-battery-fill{position:absolute;left:0;top:0;bottom:0;border-radius:5px;transition:width .25s ease;}
    .att-battery-label{
      position:relative;z-index:1;display:flex;align-items:center;justify-content:center;
      height:100%;font-size:.72rem;font-weight:800;color:var(--text-hi);text-shadow:0 1px 2px rgba(0,0,0,.4);
    }
    .att-mark{
      width:32px;height:32px;border-radius:8px;font-weight:800;font-size:.95rem;
      border:1px solid var(--line);background:var(--bg-panel-2);color:var(--text-mid);
      transition:all .15s ease;margin-right:6px;
    }
    .att-mark:hover{transform:scale(1.08);}
    .att-mark.present:hover{background:rgba(76,175,110,.2);color:#4caf6e;border-color:#4caf6e;}
    .att-mark.absent:hover{background:rgba(232,96,122,.2);color:#e8607a;border-color:#e8607a;}
  `;
  document.head.appendChild(s);
}

/* ---------------- Section routing ---------------- */
function initNav() {
  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
      const target = document.getElementById('sec-' + btn.dataset.section);
      if (target) target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/* ---------------- Dark / light mode ---------------- */
function initThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  const saved = localStorage.getItem('motl_theme');
  if (saved === 'light') {
    document.body.classList.add('light-mode');
    toggle.textContent = '☀';
  }
  toggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    toggle.textContent = isLight ? '☀' : '🌙';
    localStorage.setItem('motl_theme', isLight ? 'light' : 'dark');
  });
}

/* ---------------- Typing animation ---------------- */
function initTyping() {
  const el = document.getElementById('typingText');
  const phrases = [
    'Welcome to Mountain of the Lord Prayer Center, Katoloni',
    'A place of prayer, healing and community',
    'All Souls Matter'
  ];
  let pi = 0, ci = 0, deleting = false;

  function tick() {
    const phrase = phrases[pi];
    if (!deleting) {
      ci++;
      el.textContent = phrase.slice(0, ci);
      if (ci === phrase.length) {
        deleting = true;
        setTimeout(tick, 1800);
        return;
      }
    } else {
      ci--;
      el.textContent = phrase.slice(0, ci);
      if (ci === 0) {
        deleting = false;
        pi = (pi + 1) % phrases.length;
      }
    }
    setTimeout(tick, deleting ? 35 : 65);
  }
  tick();
}

/* ---------------- Leadership flip-card pyramid (3 / 5 / 2) ---------------- */
function renderLeadershipPyramid(db) {
  const container = document.getElementById('leadershipPyramid');
  const people = db.leadership || [];
  const tiers = [1, 2, 3];

  container.innerHTML = tiers.map(tierNum => {
    const rowPeople = people.filter(p => p.tier === tierNum);
    return `<div class="pyramid-row">${rowPeople.map(cardHTML).join('')}</div>`;
  }).join('');
}

/* ---------------- Tour section config ---------------- */
const TOUR_SINGLES = [
  { key: 'gate', label: 'Gate' },
  { key: 'front', label: 'Front of the Church' },
  { key: 'inside', label: 'Inside the Church' },
  { key: 'side', label: 'Side of the Church' },
  { key: 'aerial', label: 'Aerial View' },
  { key: 'parking', label: 'Parking' },
  { key: 'busParking', label: 'Bus Parking' },
  { key: 'communal', label: 'Communal Area' }
];

const TOUR_GROUP_META = {
  administration: { label: 'Administration', icon: '🏛' },
  departments:    { label: 'Departments',    icon: '🧑\u200d🤝\u200d🧑' },
  washrooms:      { label: 'Washrooms',      icon: '🚻' },
  homeCells:      { label: 'Home Cells',     icon: '🏠' },
  hostels:        { label: 'Hostels',        icon: '🛏' }
};
const TOUR_GROUP_ORDER = ['administration', 'departments', 'washrooms', 'homeCells', 'hostels'];

const ROLE_ICONS = {
  'bishop': '♛',
  "bishop's wife": '🕊',
  'reverend': '✝',
  'deacon': '⛪',
  'treasurer': '🪙',
  'chairlady': '🌟'
};

function cardHTML(p) {
  const initials = p.name.split(' ').map(w => w[0]).slice(0, 2).join('');
  const icon = ROLE_ICONS[p.role.toLowerCase()] || '✦';
  return `
    <div class="lead-card tier-${p.tier}" tabindex="0">
      <div class="card-face front">
        ${p.photo
          ? `<img class="photo" src="${p.photo}" alt="${p.name}">`
          : `<div class="initials-fill">${initials}</div>`}
        <div class="badge"><span>${icon}</span> ${p.tier === 1 ? 'Leadership' : p.tier === 2 ? 'Deacon' : 'Officer'}</div>
        <div class="caption">
          <div class="role">${p.role}</div>
          <div class="fname">${p.name}</div>
        </div>
      </div>
      <div class="card-face back">
        <div class="role">${p.role}</div>
        <div class="fname">${p.name}</div>
        <div class="tagline">Serving Mountain of the Lord</div>
      </div>
    </div>
  `;
}

/* Tap-to-flip for touch devices */
function initCardTapFlip() {
  document.getElementById('leadershipPyramid').addEventListener('click', (e) => {
    const card = e.target.closest('.lead-card');
    if (!card) return;
    if (window.matchMedia('(hover: none)').matches) {
      card.classList.toggle('is-flipped');
    }
  });
}

/* ---------------- Notice board render ---------------- */
function renderNoticeboard(db) {
  const nb = db.noticeboard;
  const el = document.getElementById('noticeboardContent');
  if (!nb) return;

  el.innerHTML = `
    <div style="background:var(--bg-panel); border:1px solid var(--line); border-radius:var(--radius-md); padding:34px; margin-bottom:24px;">
      <div style="color:var(--gold); font-weight:800; letter-spacing:.08em; font-size:.78rem; text-transform:uppercase; margin-bottom:8px;">Theme of ${new Date().getFullYear()}</div>
      <div style="font-family:var(--font-display); font-size:1.5rem; font-weight:700; margin-bottom:16px;">${nb.theme}</div>
      <div style="font-style:italic; color:var(--text-mid); border-left:3px solid var(--gold); padding-left:16px; margin-bottom:6px;">"${nb.verseText}"</div>
      <div style="color:var(--gold); font-size:.85rem; font-weight:600;">— ${nb.verseRef}</div>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px,1fr)); gap:20px; margin-bottom:24px;">
      <div style="background:var(--bg-panel); border:1px solid var(--line); border-radius:var(--radius-md); padding:24px;">
        <h4 style="font-family:var(--font-display); color:var(--gold); margin-bottom:10px;">Mission</h4>
        <p style="color:var(--text-mid); font-size:.92rem; line-height:1.6;">${nb.mission}</p>
      </div>
      <div style="background:var(--bg-panel); border:1px solid var(--line); border-radius:var(--radius-md); padding:24px;">
        <h4 style="font-family:var(--font-display); color:var(--gold); margin-bottom:10px;">Vision</h4>
        <p style="color:var(--text-mid); font-size:.92rem; line-height:1.6;">${nb.vision}</p>
      </div>
    </div>

    <div style="background:var(--bg-panel); border:1px solid var(--line); border-radius:var(--radius-md); padding:24px; margin-bottom:24px;">
      <h4 style="font-family:var(--font-display); color:var(--gold); margin-bottom:12px;">Objectives</h4>
      <ol style="color:var(--text-mid); font-size:.92rem; line-height:1.8; padding-left:20px;">
        ${nb.objectives.map(o => `<li>${o}</li>`).join('')}
      </ol>
    </div>

    <div style="background:var(--bg-panel); border:1px solid var(--line); border-radius:var(--radius-md); padding:24px; margin-bottom:24px;">
      <h4 style="font-family:var(--font-display); color:var(--gold); margin-bottom:10px;">Values</h4>
      <p style="color:var(--text-mid); font-size:.92rem; line-height:1.6;">${nb.values}</p>
    </div>

    <div style="text-align:center; padding:22px; border-radius:var(--radius-md); background:linear-gradient(135deg, var(--violet-700), var(--violet-900)); font-family:var(--font-display); font-size:1.4rem; font-weight:700; letter-spacing:.04em; margin-bottom:30px;">
      ${nb.tagline}
    </div>

    <div>
      <h4 style="font-family:var(--font-display); color:var(--text-hi); margin-bottom:14px;">Announcements</h4>
      ${nb.posts.map(post => `
        <div style="background:var(--bg-panel); border-left:3px solid ${post.urgency === 'important' ? 'var(--gold)' : 'var(--violet-400)'}; border-radius:var(--radius-sm); padding:16px 20px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; font-size:.75rem; color:var(--text-low); margin-bottom:6px;">
            <span>${post.postedBy.toUpperCase()} · ${new Date(post.at).toLocaleDateString()}</span>
            <span style="text-transform:uppercase; font-weight:700; color:${post.urgency === 'important' ? 'var(--gold)' : 'var(--violet-300)'};">${post.urgency}</span>
          </div>
          <div style="color:var(--text-hi); font-size:.92rem;">${post.text}</div>
        </div>
      `).join('')}
    </div>
  `;
}

/* ---------------- Photo → YouTube link overlay ----------------
   Small pill shown on top of a photo, linking out to the church's
   YouTube channel (db.contact.youtube). Reused by Tour and Project. */
function photoYoutubeLinkHTML(youtubeUrl) {
  if (!youtubeUrl) return '';
  return `<a class="photo-yt-link" href="${youtubeUrl}" target="_blank" rel="noopener" title="Watch on YouTube" onclick="event.stopPropagation();"><span class="ic">▶️</span> YouTube</a>`;
}

/* ---------------- Public Tour page render ---------------- */
function tourCardHTML(label, image, youtubeUrl) {
  return `
    <div class="tour-card">
      <div class="tour-card-img photo-yt-wrap">
        ${image ? `<img src="${image}" alt="${label}">` : `<div class="tour-card-empty"><span class="ic">📷</span></div>`}
        ${image ? photoYoutubeLinkHTML(youtubeUrl) : ''}
      </div>
      <div class="tour-card-label">${label}</div>
    </div>
  `;
}

function renderPublicTour(db) {
  const el = document.getElementById('tourContent');
  if (!el) return;
  const t = db.tour;
  const ytUrl = db.contact?.youtube || '';

  const groupSection = (key) => {
    const meta = TOUR_GROUP_META[key];
    const items = (t.groups[key] || []).filter(it => it.image);
    if (!items.length) return '';
    return `
      <div class="tour-group">
        <h3 class="tour-group-title"><span class="ic">${meta.icon}</span> ${meta.label}</h3>
        <div class="tour-grid">
          ${items.map(it => tourCardHTML(it.name, it.image, ytUrl)).join('')}
        </div>
      </div>
    `;
  };

  const singlesWithImages = TOUR_SINGLES.filter(v => t.singles[v.key]);

  el.innerHTML = `
    <p class="section-lede" style="margin:0 auto 40px;">${t.history}</p>
    ${singlesWithImages.length ? `
      <div class="tour-group">
        <h3 class="tour-group-title"><span class="ic">🏛</span> The Grounds</h3>
        <div class="tour-grid">
          ${singlesWithImages.map(v => tourCardHTML(v.label, t.singles[v.key], ytUrl)).join('')}
        </div>
      </div>
    ` : ''}
    ${TOUR_GROUP_ORDER.map(groupSection).join('')}
    ${!singlesWithImages.length && TOUR_GROUP_ORDER.every(k => !(t.groups[k] || []).some(it => it.image)) ? `
      <div class="coming-soon"><div class="ic">🗺</div>Photos of the grounds are being added — check back soon.</div>
    ` : ''}
  `;
}

/* ---------------- Public Project page render ----------------
   Renders db.project.past/present/upcoming media galleries.
   Previously this section had no public renderer at all, so
   uploads made in the admin Project tab never appeared here. */
const PROJECT_STAGE_META = {
  past:     { label: 'Past',     icon: '🕰' },
  present:  { label: 'Present',  icon: '🏛' },
  upcoming: { label: 'Upcoming', icon: '🚧' }
};
const PROJECT_STAGE_ORDER = ['past', 'present', 'upcoming'];

function projectMediaCardHTML(image, youtubeUrl) {
  return `
    <div class="project-media-card photo-yt-wrap">
      <img src="${image}" alt="Project photo">
      ${photoYoutubeLinkHTML(youtubeUrl)}
    </div>
  `;
}

function renderPublicProject(db) {
  const el = document.getElementById('projectContent');
  if (!el) return;
  const p = db.project;
  const ytUrl = db.contact?.youtube || '';

  const stageSection = (key) => {
    const meta = PROJECT_STAGE_META[key];
    const stage = p[key];
    if (!stage || !stage.media.length) return '';
    return `
      <div class="project-stage">
        <h3 class="project-stage-title"><span class="ic">${meta.icon}</span> ${meta.label}</h3>
        ${stage.caption ? `<div class="project-stage-caption">${stage.caption}</div>` : ''}
        <div class="project-media-grid">
          ${stage.media.map(m => projectMediaCardHTML(m, ytUrl)).join('')}
        </div>
      </div>
    `;
  };

  const hasAnyMedia = PROJECT_STAGE_ORDER.some(k => (p[k]?.media || []).length);

  el.innerHTML = `
    <p class="section-lede">${p.history}</p>
    ${PROJECT_STAGE_ORDER.map(stageSection).join('')}
    ${!hasAnyMedia ? `
      <div class="coming-soon"><div class="ic">🏗</div>Past / Present / Upcoming photos are being added — check back soon.</div>
    ` : ''}
  `;
}

/* ---------------- Public Katoloni Wall render ----------------
   Four categories, fed by the Protocol → Disciple 1/2/3 → Admin
   graduation pipeline. Only "active" (non-revoked) records show. */
const WALL_CATEGORY_META = {
  class1:  { label: 'First Disciple Class',  icon: '①' },
  class2:  { label: 'Second Disciple Class', icon: '②' },
  class3:  { label: 'Third Disciple Class',  icon: '③' },
  general: { label: 'General Wall — Fully Graduated', icon: '🎓' }
};
const WALL_CATEGORY_ORDER = ['class1', 'class2', 'class3', 'general'];
const WALL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

let publicWallFilter = { name: '', month: '', year: '' };

function renderPublicWall(db) {
  const el = document.getElementById('wallContent');
  if (!el) return;
  const graduates = db.graduates || [];

  const matches = (g) => {
    if (g.status !== 'active') return false;
    if (publicWallFilter.name && !(g.name || '').toLowerCase().includes(publicWallFilter.name)) return false;
    if (publicWallFilter.month && g.month !== publicWallFilter.month) return false;
    if (publicWallFilter.year && String(g.year) !== String(publicWallFilter.year)) return false;
    return true;
  };

  const catSection = (cat) => {
    const meta = WALL_CATEGORY_META[cat];
    const items = graduates.filter(g => g.category === cat && matches(g));
    if (!items.length) return '';
    return `
      <div class="tour-group">
        <h3 class="tour-group-title"><span class="ic">${meta.icon}</span> ${meta.label}</h3>
        <div class="tour-grid">
          ${items.map(g => `
            <div class="tour-card">
              <div class="tour-card-img">
                ${g.photo ? `<img src="${g.photo}" alt="${g.name}">` : `<div class="tour-card-empty"><span class="ic">🎓</span></div>`}
              </div>
              <div class="tour-card-label">${g.name}<div class="muted small">${g.month || ''} ${g.year || ''}</div></div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  const filteredAny = graduates.some(matches);
  const hasAny = graduates.some(g => g.status === 'active');
  const months = WALL_MONTHS || ['January','February','March','April','May','June','July','August','September','October','November','December'];

  el.innerHTML = `
    <div class="wall-search-panel">
      <div class="wall-search-title"><span class="ic">🔍</span> Search &amp; Filter</div>
      <div class="wall-search-row">
        <input type="text" id="pubWallSearchName" placeholder="Search by name..." value="${publicWallFilter.name || ''}">
        <select id="pubWallSearchMonth">
          <option value="">All Months</option>
          ${months.map(m => `<option value="${m}" ${publicWallFilter.month === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <input type="text" id="pubWallSearchYear" placeholder="Year" value="${publicWallFilter.year || ''}" inputmode="numeric">
      </div>
    </div>
    ${WALL_CATEGORY_ORDER.map(catSection).join('')}
    ${!hasAny ? `
      <div class="coming-soon"><div class="ic">👥</div>Graduate records will appear here as classes complete.</div>
    ` : (!filteredAny ? `
      <div class="coming-soon"><div class="ic">🔍</div>No graduates match your search.</div>
    ` : '')}
  `;

  const apply = () => {
    publicWallFilter = {
      name: (document.getElementById('pubWallSearchName')?.value || '').trim().toLowerCase(),
      month: document.getElementById('pubWallSearchMonth')?.value || '',
      year: (document.getElementById('pubWallSearchYear')?.value || '').trim()
    };
    renderPublicWall(loadDB());
  };
  document.getElementById('pubWallSearchName')?.addEventListener('input', apply);
  document.getElementById('pubWallSearchMonth')?.addEventListener('change', apply);
  document.getElementById('pubWallSearchYear')?.addEventListener('input', apply);
}

/* ---------------- Header buttons: Menu dropdown → portal picker, Terminal ---------------- */
function initMenuAndSettings() {
  const termBtn = document.getElementById('terminalBtn') || document.getElementById('settingsBtn');
  if (termBtn) termBtn.addEventListener('click', openSystemTerminal);

  document.getElementById('menuBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('menuDropdown')?.classList.toggle('active');
  });

  document.querySelectorAll('.menu-dropdown-item').forEach(item => {
    item.addEventListener('click', () => {
      const portal = item.dataset.portal;
      document.getElementById('menuDropdown')?.classList.remove('active');
      if (PORTAL_DEFS[portal]?.placeholder) {
        alert(`The ${PORTAL_DEFS[portal].label} portal is coming soon.`);
        return;
      }
      openPortalPasscodeGate(portal, 'profile');
    });
  });

  document.addEventListener('click', (e) => {
    const wrap = document.getElementById('menuDropdownWrap');
    if (wrap && !wrap.contains(e.target)) document.getElementById('menuDropdown')?.classList.remove('active');
  });
}

/* ============================================================
   SYSTEM TERMINAL — commands about THIS church app
   ============================================================ */
let termHistory = [];
let termHistIdx = -1;

function openSystemTerminal() {
  let overlay = document.getElementById('terminalOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'terminalOverlay';
    overlay.className = 'passcode-overlay terminal-overlay';
    overlay.innerHTML = `
      <div class="terminal-window">
        <div class="terminal-titlebar">
          <span class="terminal-dots"><i></i><i></i><i></i></span>
          <span class="terminal-title">MOTL System Terminal</span>
          <button type="button" class="terminal-close" id="terminalCloseBtn" title="Close">✕</button>
        </div>
        <div class="terminal-body" id="terminalBody"></div>
        <div class="terminal-input-row">
          <span class="terminal-prompt">motl&gt;</span>
          <input type="text" id="terminalInput" autocomplete="off" spellcheck="false" placeholder="type a command — help">
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => {
      if (e.target.id === 'terminalOverlay') closeSystemTerminal();
    });
    document.getElementById('terminalCloseBtn').addEventListener('click', closeSystemTerminal);
    const input = document.getElementById('terminalInput');
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const cmd = input.value.trim();
        input.value = '';
        if (cmd) {
          termHistory.push(cmd);
          termHistIdx = termHistory.length;
          runSystemCommand(cmd);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (termHistIdx > 0) {
          termHistIdx--;
          input.value = termHistory[termHistIdx] || '';
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (termHistIdx < termHistory.length - 1) {
          termHistIdx++;
          input.value = termHistory[termHistIdx] || '';
        } else {
          termHistIdx = termHistory.length;
          input.value = '';
        }
      } else if (e.key === 'Escape') {
        closeSystemTerminal();
      }
    });
  }
  const body = document.getElementById('terminalBody');
  if (body && !body.dataset.booted) {
    body.dataset.booted = '1';
    termPrint('Mountain of the Lord — System Terminal', 'term-info');
    termPrint('Type "help" for commands. Esc to close.', 'term-muted');
    termPrint('');
  }
  overlay.classList.add('active');
  setTimeout(() => document.getElementById('terminalInput')?.focus(), 50);
}

function closeSystemTerminal() {
  document.getElementById('terminalOverlay')?.classList.remove('active');
}

function termPrint(text, cls = '') {
  const body = document.getElementById('terminalBody');
  if (!body) return;
  const line = document.createElement('div');
  line.className = 'term-line' + (cls ? ' ' + cls : '');
  line.textContent = text;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

function runSystemCommand(raw) {
  termPrint('motl> ' + raw, 'term-cmd');
  const parts = raw.trim().split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase();
  const arg = parts.slice(1).join(' ').trim();
  const db = loadDB();

  switch (cmd) {
    case 'help':
    case '?':
      termPrint('Available system commands:', 'term-info');
      [
        'help                 — list commands',
        'status | stats       — system overview counts',
        'pipeline             — member documents by stage',
        'registers            — class register sizes & Ready counts',
        'bookings             — booking stats',
        'library              — library stats',
        'wall                 — graduates on Katoloni Wall',
        'audit [n]            — last n audit entries (default 15)',
        'theme dark|light     — switch theme',
        'bell on|off          — header badge visibility',
        'version              — DB schema version',
        'clear                — clear terminal',
        'exit | quit          — close terminal'
      ].forEach(l => termPrint('  ' + l, 'term-muted'));
      break;

    case 'status':
    case 'stats': {
      const reg1 = (db.classRegisters?.disciple1 || []).length;
      const reg2 = (db.classRegisters?.disciple2 || []).length;
      const reg3 = (db.classRegisters?.disciple3 || []).length;
      termPrint('— System status —', 'term-info');
      termPrint(`  DB version:     ${db.meta?.version ?? '?'}`);
      termPrint(`  Leadership:     ${(db.leadership || []).length}`);
      termPrint(`  Graduates:      ${(db.graduates || []).length}`);
      termPrint(`  Member docs:    ${(db.memberDocuments || []).length}`);
      termPrint(`  Registers:      C1=${reg1}  C2=${reg2}  C3=${reg3}`);
      termPrint(`  Bookings:       ${(db.booking?.bookings || []).length}`);
      termPrint(`  Library items:  ${(db.library?.items || []).length}`);
      termPrint(`  Contact msgs:   ${(db.contactSubmissions || []).length}`);
      termPrint(`  Messages:       ${(db.messages || []).length}`);
      termPrint(`  Complaints:     ${(db.complaints || []).length}`);
      termPrint(`  Passcodes:      ${(db.passcodes || []).filter(p => !p.revoked).length} active`);
      break;
    }

    case 'pipeline': {
      const docs = db.memberDocuments || [];
      const stages = ['intake', 'class1', 'class2', 'class3', 'general'];
      termPrint('— Member pipeline —', 'term-info');
      if (!docs.length) {
        termPrint('  (no documents yet)', 'term-muted');
        break;
      }
      stages.forEach(s => {
        const list = docs.filter(d => d.stage === s);
        termPrint(`  [${s}] ${list.length} batch(es)`);
        list.slice(0, 5).forEach(d => {
          termPrint(`    · ${d.title} — ${d.members?.length || 0} ppl — ${d.status} — ${new Date(d.at).toLocaleDateString()}`, 'term-muted');
        });
      });
      break;
    }

    case 'registers': {
      termPrint('— Class registers —', 'term-info');
      ['disciple1', 'disciple2', 'disciple3'].forEach(k => {
        const reg = db.classRegisters?.[k] || [];
        const ready = reg.filter(r => {
          const t = (r.presentCount || 0) + (r.absentCount || 0);
          const pct = t ? Math.round(((r.presentCount || 0) / t) * 100) : 0;
          return t >= 1 && pct >= 80;
        }).length;
        termPrint(`  ${PORTAL_DEFS[k]?.label || k}: ${reg.length} enrolled, ${ready} Ready`);
      });
      break;
    }

    case 'bookings': {
      const b = db.booking || {};
      const list = b.bookings || [];
      const by = s => list.filter(x => x.status === s).length;
      termPrint('— Bookings —', 'term-info');
      termPrint(`  Total: ${list.length}  pending:${by('pending')} confirmed:${by('confirmed')} in:${by('checked-in')} out:${by('checked-out')}`);
      termPrint(`  Rooms: ${(b.rooms || []).length}`);
      break;
    }

    case 'library': {
      const lib = db.library || {};
      const loans = (lib.loans || []).filter(l => l.status === 'out').length;
      const req = (lib.requests || []).filter(r => r.status === 'pending').length;
      termPrint('— Library —', 'term-info');
      termPrint(`  Titles: ${(lib.items || []).length}  On loan: ${loans}  Pending requests: ${req}`);
      break;
    }

    case 'wall': {
      const g = db.graduates || [];
      const active = g.filter(x => x.status === 'active');
      termPrint('— Katoloni Wall —', 'term-info');
      ['class1', 'class2', 'class3', 'general'].forEach(c => {
        termPrint(`  ${c}: ${active.filter(x => x.category === c).length} active`);
      });
      break;
    }

    case 'audit': {
      const n = Math.min(50, Math.max(1, parseInt(arg, 10) || 15));
      const logs = (db.auditLog || []).slice(0, n);
      termPrint(`— Last ${logs.length} audit entries —`, 'term-info');
      if (!logs.length) termPrint('  (empty)', 'term-muted');
      logs.forEach(l => {
        termPrint(`  ${new Date(l.at).toLocaleString()}  [${l.actorRole}] ${l.actorLabel}: ${l.action}${l.target ? ' → ' + l.target : ''}`, 'term-muted');
      });
      break;
    }

    case 'theme': {
      const t = arg.toLowerCase();
      if (t !== 'dark' && t !== 'light') {
        termPrint('Usage: theme dark | theme light', 'term-err');
        break;
      }
      localStorage.setItem('motl_theme', t);
      if (t === 'light') {
        document.body.classList.add('light-mode');
        const tg = document.getElementById('themeToggle');
        if (tg) tg.textContent = '☀';
      } else {
        document.body.classList.remove('light-mode');
        const tg = document.getElementById('themeToggle');
        if (tg) tg.textContent = '🌙';
      }
      termPrint(`Theme set to ${t}.`, 'term-ok');
      break;
    }

    case 'bell': {
      const v = arg.toLowerCase();
      if (v !== 'on' && v !== 'off') {
        termPrint('Usage: bell on | bell off', 'term-err');
        break;
      }
      localStorage.setItem('motl_notif_bell', v);
      updateHeaderBellBadge(loadDB());
      termPrint(`Header bell badges ${v}.`, 'term-ok');
      break;
    }

    case 'version':
      termPrint(`Schema version: ${db.meta?.version ?? '?'}  |  Created: ${db.meta?.createdAt || '—'}`, 'term-info');
      break;

    case 'clear':
    case 'cls': {
      const body = document.getElementById('terminalBody');
      if (body) body.innerHTML = '';
      termPrint('Screen cleared.', 'term-muted');
      break;
    }

    case 'exit':
    case 'quit':
    case 'close':
      closeSystemTerminal();
      break;

    default:
      termPrint(`Unknown command: ${cmd}. Type "help".`, 'term-err');
  }
  termPrint('');
}

/* ============================================================
   ADMIN PORTAL + THE 4 MEMBER PORTALS
   ------------------------------------------------------------
   Menu button → dropdown of portals (Admin, Bishop [placeholder],
   Protocol, Disciple Class 1/2/3) → passcode gate scoped to that
   portal (checked against db.passcodes by role) → either the full
   Owner/Admin Portal, or a lightweight member-portal shell shared
   by Protocol + the 3 Disciple Class portals.
   ============================================================ */

const ADMIN_TABS = [
  { key: 'profile',  label: 'Profile',       icon: '👤' },
  { key: 'invite',   label: 'Invite',        icon: '🔑' },
  { key: 'received', label: 'Received',      icon: '📥' },
  { key: 'complaints', label: 'Complaints',  icon: '⚠️' },
  { key: 'send',     label: 'Send',          icon: '📤' },
  { key: 'memberControl', label: 'Member Control', icon: '👥' },
  { key: 'tour',     label: 'Tour',          icon: '🗺' },
  { key: 'project',  label: 'Project',       icon: '🏗' },
  { key: 'notices',  label: 'Notice Board',  icon: '📢' },
  { key: 'wall',     label: 'Katoloni Wall', icon: '👥' },
  { key: 'booking',  label: 'Booking',       icon: '🛏' },
  { key: 'library',  label: 'Library',       icon: '📚' },
  { key: 'contact',  label: 'Contact',       icon: '✉' },
  { key: 'portalControl', label: 'Portal Control', icon: '🗂' },
  { key: 'report',   label: 'Report',        icon: '📊' }
];

const MEMBER_TABS_DEFAULT = [
  { key: 'profile',     label: 'Profile',     icon: '👤' },
  { key: 'members',     label: 'Members',     icon: '👥' },
  { key: 'register',    label: 'Register',    icon: '📝' },
  { key: 'received',    label: 'Received',    icon: '📥' },
  { key: 'send',        label: 'Send',        icon: '📤' },
  { key: 'complaints',  label: 'Complaints',  icon: '⚠️' },
  { key: 'report',      label: 'Report',      icon: '📊' }
];
const MEMBER_TABS_BISHOP = [
  { key: 'profile',  label: 'Profile',  icon: '👤' },
  { key: 'received', label: 'Received', icon: '📥' },
  { key: 'complaints', label: 'Complaints', icon: '⚠️' },
  { key: 'send',     label: 'Send',     icon: '📤' },
  { key: 'report',   label: 'Report',   icon: '📊' }
];
function getMemberTabs() {
  if (activePortalKey === 'bishop') return MEMBER_TABS_BISHOP;
  if (activePortalKey === 'protocol') {
    return MEMBER_TABS_DEFAULT.filter(t => t.key !== 'register');
  }
  return MEMBER_TABS_DEFAULT;
}

let adminActiveTab = 'profile';
let pendingAdminTarget = 'profile';
let pendingPortalKey = 'admin';
let activePortalKey = 'admin';     // 'admin' | 'protocol' | 'disciple1' | 'disciple2' | 'disciple3'
let memberActiveTab = 'profile';
let adminEditingPortal = false;    // true when Admin opened a portal via "Update" from Portal Control

function setAdminPortalTitle(text, icon = '🔑') {
  const el = document.querySelector('.admin-title');
  if (el) el.innerHTML = `<span class="ic">${icon}</span> ${text}`;
}

function initAdminPortal() {
  document.getElementById('headerBellBtn')?.addEventListener('click', () => openPortalPasscodeGate('admin', 'received'));
  document.getElementById('passcodeCancel').addEventListener('click', closePasscodeGate);
  document.getElementById('passcodeSubmit').addEventListener('click', attemptPasscode);
  document.getElementById('passcodeInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') attemptPasscode();
  });
  document.getElementById('passcodeOverlay').addEventListener('click', e => {
    if (e.target.id === 'passcodeOverlay') closePasscodeGate();
  });
  document.getElementById('adminLogoutBtn').addEventListener('click', closeAdminPortal);
  document.getElementById('adminOverlay').addEventListener('click', e => {
    if (e.target.id === 'adminOverlay') closeAdminPortal();
  });

  // Message review modal
  document.getElementById('reviewCancelBtn')?.addEventListener('click', closeMessageReview);
  document.getElementById('reviewSaveBtn')?.addEventListener('click', saveReviewedMessage);
  document.getElementById('messageReviewOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'messageReviewOverlay') closeMessageReview();
  });

  // Delete-reason modal (contact messages + Katoloni Wall regenerate/permanent-delete)
  document.getElementById('deleteReasonCancelBtn')?.addEventListener('click', closeDeleteReason);
  document.getElementById('deleteReasonConfirmBtn')?.addEventListener('click', confirmDeleteReasonAction);
  document.getElementById('deleteReasonOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'deleteReasonOverlay') closeDeleteReason();
  });
}

function openPortalPasscodeGate(portalKey, target = 'profile') {
  pendingPortalKey = portalKey;
  pendingAdminTarget = target;
  document.getElementById('passcodeError').textContent = '';
  document.getElementById('passcodeInput').value = '';
  const titleEl = document.querySelector('#passcodeOverlay h3');
  if (titleEl) titleEl.innerHTML = `<span class="ic">🔑</span> ${PORTAL_DEFS[portalKey].label} Access`;
  document.getElementById('passcodeOverlay').classList.add('active');
  setTimeout(() => document.getElementById('passcodeInput').focus(), 50);
}

function closePasscodeGate() {
  document.getElementById('passcodeOverlay').classList.remove('active');
}

function attemptPasscode() {
  const entered = document.getElementById('passcodeInput').value.trim();
  const db = loadDB();
  const requiredRole = pendingPortalKey === 'admin' ? 'super_admin' : pendingPortalKey;
  const match = db.passcodes.find(p => p.code === entered && !p.revoked && p.role === requiredRole);
  if (match) {
    closePasscodeGate();
    if (pendingPortalKey === 'admin') {
      openAdminPortal(match);
    } else {
      openMemberPortal(pendingPortalKey, match);
    }
  } else {
    document.getElementById('passcodeError').textContent = 'Incorrect passcode. Try again.';
  }
}

function openAdminPortal(passcodeRecord) {
  const db = loadDB();
  activePortalKey = 'admin';
  adminEditingPortal = false;
  document.getElementById('adminSignedInName').textContent = db.owner?.name || passcodeRecord.label || 'Admin';
  setAdminPortalTitle('Owner / Admin Portal');
  document.getElementById('adminOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  adminActiveTab = pendingAdminTarget || 'profile';
  renderAdminSidebar();
  switchAdminTab(adminActiveTab);
  logAudit(passcodeRecord.role, passcodeRecord.label, 'Logged in to Admin Portal');
}

/* ---------- Member portal (Protocol + Disciple Class 1/2/3) ---------- */
function openMemberPortal(portalKey, passcodeRecord) {
  const db = loadDB();
  activePortalKey = portalKey;
  adminEditingPortal = false;
  const profile = db.portalProfiles[portalKey];
  document.getElementById('adminSignedInName').textContent = passcodeRecord.label || profile.name;
  setAdminPortalTitle(`${PORTAL_DEFS[portalKey].label} Portal`, PORTAL_DEFS[portalKey].icon);
  document.getElementById('adminOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  memberActiveTab = 'profile';
  renderMemberSidebar();
  switchMemberTab('profile');
  logAudit(portalKey, passcodeRecord.label, `Logged in to ${PORTAL_DEFS[portalKey].label} Portal`);
}

function closeAdminPortal() {
  document.getElementById('adminOverlay').classList.remove('active');
  document.body.style.overflow = '';
  activePortalKey = 'admin';
  adminEditingPortal = false;
  setAdminPortalTitle('Owner / Admin Portal');
  // Reflect any CMS edits made while inside the portal back onto the public page
  const db = loadDB();
  renderLeadershipPyramid(db);
  renderNoticeboard(db);
  renderPublicTour(db);
  renderPublicProject(db);
  renderPublicWall(db);
  renderPublicLibrary(db);
  renderPublicRooms(db);
  renderRoomOptions(db);
  renderItemOptions(db);
  renderContactPublic(db);
  updateHeaderBellBadge(db);
  const mp = document.getElementById('mpesaPrimary');
  if (mp) {
    mp.textContent = db.booking.mpesaNumbers.primary;
    document.getElementById('mpesaAlt').textContent = db.booking.mpesaNumbers.alternative;
    document.getElementById('bishopPhone').textContent = db.booking.bishopContact.phone;
    document.getElementById('bishopNote').textContent = db.booking.bishopContact.note;
  }
}

/* ---------- Unread badge (contact "new" + unread internal messages) ---------- */
function libraryAlertCount(db) {
  const lib = db.library || {};
  const pendingReq = (lib.requests || []).filter(r => r.status === 'pending').length;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = (lib.loans || []).filter(l => l.status === 'out' && l.dueAt && l.dueAt < today).length;
  return pendingReq + overdue;
}

/* NEW: pending guest-house bookings awaiting admin action */
function bookingAlertCount(db) {
  return ((db.booking && db.booking.bookings) || []).filter(b => b.status === 'pending').length;
}

/* NEW: complaint alert counts */
function adminComplaintsAlertCount(db) {
  return (db.complaints || []).filter(c => c.status === 'open' && c.toRole === 'super_admin').length;
}
function bishopComplaintsAlertCount(db) {
  return (db.complaints || []).filter(c => c.status === 'open' && c.toRole === 'bishop').length;
}

function combinedUnreadCount(db) {
  const newContact = (db.contactSubmissions || []).filter(c => c.status === 'new').length;
  const unreadInternal = (db.messages || []).filter(m => m.toRole === 'super_admin' && !m.readAt).length;
  const openComplaints = adminComplaintsAlertCount(db);
  const memberDocs = (db.memberDocuments || []).filter(d => d.toRole === 'super_admin' && d.status === 'new').length;
  return newContact + unreadInternal + libraryAlertCount(db) + openComplaints + memberDocs + bookingAlertCount(db);
}

function updateHeaderBellBadge(db) {
  const el = document.getElementById('headerBellCount');
  if (!el) return;
  if (localStorage.getItem('motl_notif_bell') === 'off') {
    el.style.display = 'none';
    return;
  }
  const count = combinedUnreadCount(db);
  if (count > 0) {
    el.textContent = count;
    el.style.display = 'inline-flex';
  } else {
    el.style.display = 'none';
  }
}

function renderAdminSidebar() {
  const db = loadDB();
  const unread = combinedUnreadCount(db);
  const libAlerts = libraryAlertCount(db);
  const bookingAlerts = bookingAlertCount(db);
  const receivedOnly = (db.contactSubmissions || []).filter(c => c.status === 'new').length
    + (db.messages || []).filter(m => m.toRole === 'super_admin' && !m.readAt).length;
  const complaintsOpen = adminComplaintsAlertCount(db);
  const memberDocsNew = (db.memberDocuments || []).filter(d => d.toRole === 'super_admin' && d.status === 'new').length;
  const el = document.getElementById('adminSidebar');
  el.innerHTML = ADMIN_TABS.map(t => {
    let badge = '';
    if (t.key === 'received' && receivedOnly > 0) badge = `<span class="badge-count">${receivedOnly}</span>`;
    if (t.key === 'library' && libAlerts > 0) badge = `<span class="badge-count">${libAlerts}</span>`;
    if (t.key === 'booking' && bookingAlerts > 0) badge = `<span class="badge-count">${bookingAlerts}</span>`;
    if (t.key === 'complaints' && complaintsOpen > 0) badge = `<span class="badge-count">${complaintsOpen}</span>`;
    if (t.key === 'memberControl' && memberDocsNew > 0) badge = `<span class="badge-count">${memberDocsNew}</span>`;
    return `
    <button type="button" class="admin-side-btn ${t.key === adminActiveTab ? 'active' : ''}" data-tab="${t.key}">
      <span class="ic">${t.icon}</span> ${t.label}
      ${badge}
    </button>`;
  }).join('');
  el.querySelectorAll('.admin-side-btn').forEach(btn => {
    btn.addEventListener('click', () => switchAdminTab(btn.dataset.tab));
  });
}

function switchAdminTab(tab) {
  adminActiveTab = tab;
  renderAdminSidebar();
  const renderers = {
    profile: renderAdminProfile,
    invite: renderAdminInvite,
    received: renderAdminReceived,
    complaints: renderAdminComplaints,
    send: renderAdminSend,
    memberControl: renderAdminMemberControl,
    tour: renderAdminTour,
    project: renderAdminProject,
    notices: renderAdminNotices,
    wall: renderAdminWall,
    booking: renderAdminBooking,
    library: renderAdminLibrary,
    contact: renderAdminContact,
    portalControl: renderAdminPortalControl,
    report: renderAdminReport
  };
  (renderers[tab] || renderAdminProfile)();
}

/* ============================================================
   MEMBER PORTAL SHELL — shared by Protocol + Disciple Class 1/2/3
   ============================================================ */
function renderMemberSidebar() {
  const el = document.getElementById('adminSidebar');
  const backBtn = adminEditingPortal ? `
    <button type="button" class="admin-side-btn" id="backToAdminReportBtn"><span class="ic">←</span> Back to Admin</button>
    <div style="border-top:1px solid var(--line); margin:6px 0 10px;"></div>
  ` : '';
  const db = loadDB();
  const unreadMember = (db.messages || []).filter(m => m.toRole === activePortalKey && !m.readAt).length;
  const complaintsOpenForPortal = activePortalKey === 'bishop' ? bishopComplaintsAlertCount(db) : 0;
  const memberDocsNew = (db.memberDocuments || []).filter(d => d.toRole === activePortalKey && d.status === 'new').length;
  el.innerHTML = backBtn + getMemberTabs().map(t => {
    let badge = '';
    if (t.key === 'received' && unreadMember > 0) badge = `<span class="badge-count">${unreadMember}</span>`;
    if (t.key === 'complaints' && complaintsOpenForPortal > 0) badge = `<span class="badge-count">${complaintsOpenForPortal}</span>`;
    if (t.key === 'members' && memberDocsNew > 0) badge = `<span class="badge-count">${memberDocsNew}</span>`;
    return `
    <button type="button" class="admin-side-btn ${t.key === memberActiveTab ? 'active' : ''}" data-mtab="${t.key}">
      <span class="ic">${t.icon}</span> ${t.label}
      ${badge}
    </button>`;
  }).join('');
  el.querySelectorAll('[data-mtab]').forEach(btn => {
    btn.addEventListener('click', () => switchMemberTab(btn.dataset.mtab));
  });
  document.getElementById('backToAdminReportBtn')?.addEventListener('click', () => {
    adminEditingPortal = false;
    activePortalKey = 'admin';
    setAdminPortalTitle('Owner / Admin Portal');
    document.getElementById('adminSignedInName').textContent = loadDB().owner.name;
    adminActiveTab = 'portalControl';
    renderAdminSidebar();
    switchAdminTab('portalControl');
  });
}

function switchMemberTab(tab) {
  memberActiveTab = tab;
  renderMemberSidebar();
  const renderers = {
    profile: renderMemberProfile,
    members: renderMemberMembersTab,
    register: renderMemberRegisterTab,
    received: renderMemberReceived,
    send: renderMemberSend,
    complaints: renderMemberComplaintsTab,
    report: renderMemberReport
  };
  (renderers[tab] || renderMemberProfile)();
}

/* NEW: routes Complaints tab — Bishop gets a resolve-inbox, Protocol/Disciple keep the raise-a-complaint form */
function renderMemberComplaintsTab() {
  if (activePortalKey === 'bishop') {
    renderBishopComplaintsInbox();
  } else {
    renderMemberComplaints();
  }
}

/* ============================================================
   MEMBERS PIPELINE — Protocol → Admin → Disciple 1/2/3 → Wall
   ============================================================ */

function memberTableHTML(members) {
  if (!members || !members.length) return '<p class="muted">No members in this list.</p>';
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr><th>#</th><th>Full Name</th><th>Phone</th><th>Email</th><th>Year</th></tr></thead>
        <tbody>
          ${members.map((m, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${m.name || '—'}</td>
              <td>${m.phone || '—'}</td>
              <td>${m.email || '—'}</td>
              <td>${m.year || '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

/** Enrol members into a class register (merge by phone or name; keep existing attendance). */
function enrollMembersIntoRegister(db, portalKey, members, sourceDocId) {
  if (!db.classRegisters) db.classRegisters = { disciple1: [], disciple2: [], disciple3: [] };
  if (!db.classRegisters[portalKey]) db.classRegisters[portalKey] = [];
  const reg = db.classRegisters[portalKey];
  (members || []).forEach(m => {
    const exists = reg.find(r =>
      (m.phone && r.phone && r.phone === m.phone) ||
      (r.name && m.name && r.name.toLowerCase() === m.name.toLowerCase())
    );
    if (!exists) {
      reg.push({
        id: uid('reg'),
        name: m.name || '',
        phone: m.phone || '',
        email: m.email || '',
        year: m.year || new Date().getFullYear(),
        presentCount: 0,
        absentCount: 0,
        sourceDocId: sourceDocId || null,
        enrolledAt: new Date().toISOString()
      });
    }
  });
}

function attendancePct(rec) {
  const total = (rec.presentCount || 0) + (rec.absentCount || 0);
  if (total === 0) return 0;
  return Math.round(((rec.presentCount || 0) / total) * 100);
}

function isReadyForGraduation(rec) {
  const total = (rec.presentCount || 0) + (rec.absentCount || 0);
  return total >= 1 && attendancePct(rec) >= 80;
}

function batteryBarHTML(pct) {
  const color = pct >= 80 ? '#4caf6e' : pct >= 50 ? 'var(--gold)' : '#e8607a';
  return `
    <div class="att-battery" title="${pct}% attendance">
      <div class="att-battery-fill" style="width:${pct}%;background:${color};"></div>
      <span class="att-battery-label">${pct}%</span>
    </div>`;
}

/** Search entire pipeline for possible duplicates (draft, documents, registers, graduates). */
function findDuplicateInPipeline(db, { name, phone, email }, excludeId = null) {
  const hits = [];
  const n = (name || '').trim().toLowerCase();
  const p = (phone || '').trim().replace(/\s+/g, '');
  const e = (email || '').trim().toLowerCase();

  const check = (list, where) => {
    (list || []).forEach(m => {
      if (excludeId && m.id === excludeId) return;
      const mn = (m.name || '').trim().toLowerCase();
      const mp = (m.phone || '').trim().replace(/\s+/g, '');
      const me = (m.email || '').trim().toLowerCase();
      const reasons = [];
      if (n && mn && n === mn) reasons.push('name');
      if (p && mp && p === mp) reasons.push('phone');
      if (e && me && e === me) reasons.push('email');
      if (reasons.length) hits.push({ where, name: m.name, phone: m.phone, match: reasons.join('+') });
    });
  };

  check(db.protocolDraftMembers, 'Protocol draft');
  (db.memberDocuments || []).forEach(d => check(d.members, `Document: ${d.title}`));
  ['disciple1', 'disciple2', 'disciple3'].forEach(k => {
    check(db.classRegisters?.[k], `Register ${k}`);
  });
  check(db.graduates, 'Katoloni Wall');
  return hits;
}

/** Strong confirmation modal (irreversible actions). */
function openConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm }) {
  let overlay = document.getElementById('confirmActionOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'confirmActionOverlay';
    overlay.className = 'passcode-overlay';
    overlay.innerHTML = `
      <div class="passcode-box wide" style="max-width:440px;text-align:left;">
        <h3 id="confirmActionTitle" style="justify-content:flex-start;"></h3>
        <p id="confirmActionMsg" class="muted" style="margin:12px 0 18px;line-height:1.55;"></p>
        <div class="passcode-actions" style="justify-content:flex-end;gap:10px;">
          <button type="button" class="icon-btn" id="confirmActionCancel">Cancel</button>
          <button type="button" class="icon-btn gold" id="confirmActionOk"></button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => {
      if (e.target.id === 'confirmActionOverlay') overlay.classList.remove('active');
    });
  }
  document.getElementById('confirmActionTitle').innerHTML = title;
  document.getElementById('confirmActionMsg').textContent = message;
  const ok = document.getElementById('confirmActionOk');
  ok.innerHTML = confirmLabel;
  if (danger) {
    ok.style.background = 'linear-gradient(180deg,#e8607a,#c23f5a)';
    ok.style.color = '#fff';
  } else {
    ok.style.background = '';
    ok.style.color = '';
  }
  overlay.classList.add('active');
  document.getElementById('confirmActionCancel').onclick = () => overlay.classList.remove('active');
  ok.onclick = () => {
    overlay.classList.remove('active');
    if (typeof onConfirm === 'function') onConfirm();
  };
}

function exportMembersCSV(members, filename) {
  const header = 'Full Name,Phone,Email,Year';
  const lines = (members || []).map(m =>
    [m.name, m.phone, m.email, m.year].map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')
  );
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename || 'members'}.csv`;
  a.click();
}

function exportMembersExcel(members, filename) {
  let html = '<table><tr><th>Full Name</th><th>Phone</th><th>Email</th><th>Year</th></tr>';
  (members || []).forEach(m => {
    html += `<tr><td>${m.name || ''}</td><td>${m.phone || ''}</td><td>${m.email || ''}</td><td>${m.year || ''}</td></tr>`;
  });
  html += '</table>';
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename || 'members'}.xls`;
  a.click();
}

function exportMembersPDF(members, title) {
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>${title || 'Members'}</title>
    <style>body{font-family:sans-serif;padding:24px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px} th{background:#f5f5f5}</style>
    </head><body><h2>${title || 'Members List'}</h2>
    <table><thead><tr><th>#</th><th>Full Name</th><th>Phone</th><th>Email</th><th>Year</th></tr></thead><tbody>
    ${(members || []).map((m, i) => `<tr><td>${i + 1}</td><td>${m.name || ''}</td><td>${m.phone || ''}</td><td>${m.email || ''}</td><td>${m.year || ''}</td></tr>`).join('') || '<tr><td colspan="5">No members.</td></tr>'}
    </tbody></table></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}


/* ============================================================
   CERTIFICATE PDF GENERATION
   ------------------------------------------------------------
   Printable certificate (Save as PDF via browser) + optional
   jsPDF download when CDN is available.
   ============================================================ */
const CERT_CLASS_LABELS = {
  class1: 'First Disciple Class',
  class2: 'Second Disciple Class',
  class3: 'Third Disciple Class',
  general: 'General — Fully Graduated',
  disciple1: 'First Disciple Class',
  disciple2: 'Second Disciple Class',
  disciple3: 'Third Disciple Class'
};

function certClassLabel(key) {
  return CERT_CLASS_LABELS[key] || key || 'Discipleship Class';
}

function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf?.jsPDF) return resolve(window.jspdf.jsPDF);
    if (window.jsPDF) return resolve(window.jsPDF);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => resolve(window.jspdf?.jsPDF || window.jsPDF);
    s.onerror = () => reject(new Error('jsPDF failed to load'));
    document.head.appendChild(s);
  });
}

/** Build certificate data from a graduate or plain member + meta */
function buildCertData({ name, classKey, month, year, photo }) {
  const db = loadDB();
  return {
    name: (name || '').trim(),
    classLabel: certClassLabel(classKey),
    classKey: classKey || '',
    month: month || '',
    year: year || new Date().getFullYear(),
    photo: photo || '',
    church: 'Mountain of the Lord Prayer Center',
    location: 'Katoloni',
    issued: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    bishop: db.portalProfiles?.bishop?.name || db.leadership?.find(p => /bishop/i.test(p.role))?.name || 'Bishop',
    admin: db.owner?.name || 'Administrator'
  };
}

function certificateHTML(data) {
  const subtitle = [data.month, data.year].filter(Boolean).join(' ');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Certificate — ${data.name}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    background: #1a1408;
    color: #2a2110;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .sheet {
    width: 297mm; max-width: 100%;
    aspect-ratio: 297 / 210;
    background: linear-gradient(145deg, #f7edd4 0%, #efe0b8 40%, #f5e8c4 100%);
    border: 10px solid #c9a227;
    box-shadow: inset 0 0 0 3px #8a6b1a, 0 12px 40px rgba(0,0,0,.45);
    position: relative;
    padding: 28px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
  }
  .sheet::before {
    content: '';
    position: absolute; inset: 18px;
    border: 1.5px solid #c9a227;
    pointer-events: none;
  }
  .top { text-align: center; z-index: 1; width: 100%; }
  .church { font-size: 13px; letter-spacing: .28em; text-transform: uppercase; color: #6b5420; font-weight: 700; }
  .loc { font-size: 11px; color: #8a7340; margin-top: 4px; letter-spacing: .12em; }
  .title { font-size: 32px; color: #3a2b0c; margin: 18px 0 6px; font-weight: 700; letter-spacing: .04em; }
  .ornament { color: #c9a227; font-size: 18px; margin-bottom: 8px; }
  .presented { font-size: 13px; font-style: italic; color: #5c4a22; margin-bottom: 10px; }
  .name {
    font-size: 36px; font-weight: 700; color: #1a1206;
    border-bottom: 2px solid #c9a227; padding: 0 24px 8px; margin-bottom: 12px;
    max-width: 90%; text-align: center;
  }
  .body { font-size: 14px; color: #3d3218; text-align: center; max-width: 520px; line-height: 1.55; }
  .class-line { font-weight: 700; color: #6b5420; margin-top: 8px; font-size: 15px; }
  .mid { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 1; }
  .photo {
    width: 72px; height: 72px; border-radius: 50%; object-fit: cover;
    border: 3px solid #c9a227; margin-bottom: 10px; background: #ddd;
  }
  .foot {
    width: 100%; display: flex; justify-content: space-between; align-items: flex-end;
    z-index: 1; padding: 0 20px 4px; gap: 24px;
  }
  .sig { text-align: center; min-width: 160px; }
  .sig-line { border-top: 1px solid #6b5420; margin-top: 28px; padding-top: 6px; font-size: 11px; color: #5c4a22; }
  .sig strong { display: block; font-size: 12px; color: #2a2110; }
  .issued { font-size: 11px; color: #6b5420; text-align: center; margin-top: 6px; }
  .actions {
    position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 10px; z-index: 10;
  }
  .actions button {
    font-family: system-ui, sans-serif; font-weight: 700; font-size: 13px;
    padding: 10px 18px; border-radius: 999px; border: none; cursor: pointer;
    background: #c9a227; color: #1a1206;
  }
  .actions button.secondary { background: #333; color: #eee; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; }
    .actions { display: none !important; }
  }
</style></head><body>
  <div class="sheet">
    <div class="top">
      <div class="church">${data.church}</div>
      <div class="loc">${data.location}</div>
      <div class="ornament">✦ —— ✦ —— ✦</div>
      <div class="title">Certificate of Completion</div>
      <div class="presented">This is to certify that</div>
    </div>
    <div class="mid">
      ${data.photo ? `<img class="photo" src="${data.photo}" alt="">` : ''}
      <div class="name">${data.name}</div>
      <div class="body">
        has successfully completed the requirements of the
        <div class="class-line">${data.classLabel}</div>
        ${subtitle ? `<div style="margin-top:8px;">Class of ${subtitle}</div>` : ''}
        and is hereby recognised as a graduate of the discipleship programme.
      </div>
    </div>
    <div class="foot">
      <div class="sig">
        <div class="sig-line"><strong>${data.bishop}</strong>Bishop / Overseer</div>
      </div>
      <div class="issued">Issued ${data.issued}</div>
      <div class="sig">
        <div class="sig-line"><strong>${data.admin}</strong>Administrator</div>
      </div>
    </div>
  </div>
  <div class="actions">
    <button onclick="window.print()">🖨 Print / Save as PDF</button>
    <button class="secondary" onclick="window.close()">Close</button>
  </div>
</body></html>`;
}

/** Open printable certificate window (user can Save as PDF). */
function openCertificatePrint(data) {
  if (!data.name) {
    alert('A name is required for the certificate.');
    return;
  }
  const w = window.open('', '_blank');
  if (!w) {
    alert('Pop-up blocked. Please allow pop-ups to print certificates.');
    return;
  }
  w.document.write(certificateHTML(data));
  w.document.close();
  w.focus();
  logAudit('super_admin', loadDB().owner?.name || 'Admin', 'Opened certificate', data.name);
}

/** Try jsPDF file download; fall back to print window. */
async function downloadCertificatePDF(data) {
  if (!data.name) {
    alert('A name is required for the certificate.');
    return;
  }
  try {
    const JsPDF = await loadJsPDF();
    const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // Background
    doc.setFillColor(247, 237, 212);
    doc.rect(0, 0, W, H, 'F');
    // Outer gold border
    doc.setDrawColor(201, 162, 39);
    doc.setLineWidth(2.5);
    doc.rect(8, 8, W - 16, H - 16);
    doc.setLineWidth(0.6);
    doc.rect(12, 12, W - 24, H - 24);

    doc.setTextColor(107, 84, 32);
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text(data.church.toUpperCase(), W / 2, 28, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(138, 115, 64);
    doc.text(data.location, W / 2, 34, { align: 'center' });

    doc.setTextColor(58, 43, 12);
    doc.setFont('times', 'bold');
    doc.setFontSize(26);
    doc.text('Certificate of Completion', W / 2, 50, { align: 'center' });

    doc.setFont('times', 'italic');
    doc.setFontSize(12);
    doc.setTextColor(92, 74, 34);
    doc.text('This is to certify that', W / 2, 62, { align: 'center' });

    doc.setFont('times', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(26, 18, 6);
    doc.text(data.name, W / 2, 78, { align: 'center' });
    // underline
    const nameW = doc.getTextWidth(data.name);
    doc.setDrawColor(201, 162, 39);
    doc.setLineWidth(0.8);
    doc.line(W / 2 - nameW / 2 - 4, 81, W / 2 + nameW / 2 + 4, 81);

    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(61, 50, 24);
    doc.text('has successfully completed the requirements of the', W / 2, 94, { align: 'center' });
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(107, 84, 32);
    doc.text(data.classLabel, W / 2, 103, { align: 'center' });

    const subtitle = [data.month, data.year].filter(Boolean).join(' ');
    if (subtitle) {
      doc.setFont('times', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(61, 50, 24);
      doc.text('Class of ' + subtitle, W / 2, 111, { align: 'center' });
    }

    doc.setFontSize(11);
    doc.text('and is hereby recognised as a graduate of the discipleship programme.', W / 2, 120, { align: 'center' });

    // Signatures
    doc.setDrawColor(107, 84, 32);
    doc.setLineWidth(0.4);
    doc.line(30, H - 40, 90, H - 40);
    doc.line(W - 90, H - 40, W - 30, H - 40);
    doc.setFont('times', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(42, 33, 16);
    doc.text(data.bishop, 60, H - 34, { align: 'center' });
    doc.text(data.admin, W - 60, H - 34, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(92, 74, 34);
    doc.text('Bishop / Overseer', 60, H - 29, { align: 'center' });
    doc.text('Administrator', W - 60, H - 29, { align: 'center' });
    doc.text('Issued ' + data.issued, W / 2, H - 28, { align: 'center' });

    // Optional photo
    if (data.photo && data.photo.startsWith('data:image')) {
      try {
        doc.addImage(data.photo, 'JPEG', W / 2 - 12, 54, 24, 24);
      } catch (_) { /* ignore photo errors */ }
    }

    const safe = (data.name || 'certificate').replace(/[^\w\-]+/g, '_').slice(0, 40);
    doc.save(`Certificate_${safe}.pdf`);
    logAudit('super_admin', loadDB().owner?.name || 'Admin', 'Downloaded certificate PDF', data.name);
  } catch (err) {
    console.warn('jsPDF unavailable, falling back to print', err);
    openCertificatePrint(data);
  }
}

/** Certificates for every member in a batch (opens print page per person, or sequential downloads). */
async function generateBatchCertificates(members, classKey, month, year) {
  const list = (members || []).filter(m => m.name && m.name.trim());
  if (!list.length) {
    alert('No members in this list to certificate.');
    return;
  }
  if (!confirm(`Generate certificates for ${list.length} graduate(s)?\n\nYou will get a PDF download for each (or a print window if PDF is blocked).`)) return;

  for (const m of list) {
    const data = buildCertData({
      name: m.name,
      classKey,
      month: month || '',
      year: year || m.year || new Date().getFullYear(),
      photo: m.photo || ''
    });
    await downloadCertificatePDF(data);
    // small delay so browsers don't block multiple downloads
    await new Promise(r => setTimeout(r, 400));
  }
  alert(`Done — ${list.length} certificate(s) processed.`);
}


function memberSaveMenuHTML(idPrefix) {
  return `
    <div class="export-bar" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <div style="position:relative;display:inline-flex;">
        <button type="button" class="icon-btn small" id="${idPrefix}SaveBtn"><span class="ic">💾</span> Save ▾</button>
        <div class="menu-dropdown" id="${idPrefix}SaveMenu" style="top:auto;bottom:calc(100% + 6px);left:0;min-width:140px;">
          <button type="button" class="menu-dropdown-item" data-export="csv">CSV</button>
          <button type="button" class="menu-dropdown-item" data-export="excel">Excel</button>
          <button type="button" class="menu-dropdown-item" data-export="pdf">PDF / Print</button>
        </div>
      </div>
    </div>`;
}

/* ---- Protocol: Add new members (receptionist) ---- */
function renderProtocolMembers() {
  const db = loadDB();
  const draft = db.protocolDraftMembers || [];
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">➕</span> Add New Member</h3>
      <p class="muted" style="margin-bottom:16px;">Protocol acts as receptionist. Enter each new joiner, edit the list if needed, then Send to Admin Member Control. Duplicates (name / phone / email already in the pipeline) are flagged.</p>
      <div class="lead-mgmt-card" style="background:var(--bg-panel-3);">
        <div class="lead-mgmt-fields" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));">
          <div class="form-field"><label>Full Name *</label><input type="text" id="memName" placeholder="Full name"></div>
          <div class="form-field"><label>Phone *</label><input type="text" id="memPhone" placeholder="07XX XXX XXX"></div>
          <div class="form-field"><label>Email</label><input type="text" id="memEmail" placeholder="name@email.com"></div>
          <div class="form-field"><label>Year *</label><input type="number" id="memYear" value="${new Date().getFullYear()}"></div>
        </div>
        <div class="lead-mgmt-actions">
          <button type="button" class="icon-btn gold small" id="memAddBtn"><span class="ic">➕</span> Add Member</button>
        </div>
      </div>
      <div id="memDupWarn" class="muted small" style="margin-top:10px;color:#e8607a;display:none;"></div>
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📋</span> Members List (${draft.length}) — editable</h3>
      ${draft.length ? `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>#</th><th>Full Name</th><th>Phone</th><th>Email</th><th>Year</th><th>Actions</th></tr></thead>
            <tbody>
              ${draft.map((m, i) => `
                <tr data-draftid="${m.id}">
                  <td>${i + 1}</td>
                  <td><input type="text" class="draftEditName" data-id="${m.id}" value="${m.name || ''}" style="width:100%;min-width:120px;padding:8px;border-radius:8px;background:var(--bg-panel);border:1px solid var(--line);color:var(--text-hi);"></td>
                  <td><input type="text" class="draftEditPhone" data-id="${m.id}" value="${m.phone || ''}" style="width:100%;min-width:100px;padding:8px;border-radius:8px;background:var(--bg-panel);border:1px solid var(--line);color:var(--text-hi);"></td>
                  <td><input type="text" class="draftEditEmail" data-id="${m.id}" value="${m.email || ''}" style="width:100%;min-width:120px;padding:8px;border-radius:8px;background:var(--bg-panel);border:1px solid var(--line);color:var(--text-hi);"></td>
                  <td><input type="number" class="draftEditYear" data-id="${m.id}" value="${m.year || ''}" style="width:80px;padding:8px;border-radius:8px;background:var(--bg-panel);border:1px solid var(--line);color:var(--text-hi);"></td>
                  <td class="table-actions">
                    <button type="button" class="icon-btn small" data-draftsave="${m.id}" title="Save row"><span class="ic">💾</span></button>
                    <button type="button" class="mini-del" data-draftdel="${m.id}" title="Remove">✕</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p class="muted">No members in the draft list yet.</p>'}
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:18px;align-items:center;">
        ${memberSaveMenuHTML('proto')}
        <button type="button" class="icon-btn gold" id="protoSendBtn" ${draft.length ? '' : 'disabled'}><span class="ic">📤</span> Send to Admin</button>
        ${draft.length ? `<button type="button" class="icon-btn small" id="protoClearBtn" style="background:rgba(232,96,122,.15);color:#e8607a;border-color:transparent;"><span class="ic">🗑</span> Clear List</button>` : ''}
      </div>
    </div>
  `;

  document.getElementById('memAddBtn').addEventListener('click', () => {
    const name = document.getElementById('memName').value.trim();
    const phone = document.getElementById('memPhone').value.trim();
    const email = document.getElementById('memEmail').value.trim();
    const year = +document.getElementById('memYear').value || new Date().getFullYear();
    if (!name || !phone) { alert('Full name and phone are required.'); return; }
    const dbNow = loadDB();
    const dups = findDuplicateInPipeline(dbNow, { name, phone, email });
    const warnEl = document.getElementById('memDupWarn');
    if (dups.length) {
      const msg = 'Possible duplicate(s):\n' + dups.slice(0, 5).map(d => `• ${d.name} (${d.phone || '—'}) in ${d.where} [match: ${d.match}]`).join('\n') + '\n\nAdd anyway?';
      if (!confirm(msg)) {
        if (warnEl) {
          warnEl.style.display = 'block';
          warnEl.textContent = 'Blocked: matches existing record(s) in the pipeline. Change the details or confirm to force-add.';
        }
        return;
      }
    }
    if (warnEl) warnEl.style.display = 'none';
    if (!dbNow.protocolDraftMembers) dbNow.protocolDraftMembers = [];
    dbNow.protocolDraftMembers.push({ id: uid('mem'), name, phone, email, year, at: new Date().toISOString() });
    saveDB(dbNow);
    logAudit('protocol', dbNow.portalProfiles.protocol.name, 'Added draft member', name);
    renderProtocolMembers();
  });

  document.querySelectorAll('[data-draftsave]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.draftsave;
      const dbNow = loadDB();
      const row = (dbNow.protocolDraftMembers || []).find(m => m.id === id);
      if (!row) return;
      row.name = document.querySelector(`.draftEditName[data-id="${id}"]`)?.value.trim() || row.name;
      row.phone = document.querySelector(`.draftEditPhone[data-id="${id}"]`)?.value.trim() || row.phone;
      row.email = document.querySelector(`.draftEditEmail[data-id="${id}"]`)?.value.trim() || '';
      row.year = +document.querySelector(`.draftEditYear[data-id="${id}"]`)?.value || row.year;
      const dups = findDuplicateInPipeline(dbNow, row, id);
      if (dups.length && !confirm('This row may duplicate existing pipeline records. Save anyway?')) return;
      saveDB(dbNow);
      logAudit('protocol', dbNow.portalProfiles.protocol.name, 'Edited draft member', row.name);
      alert('Row saved.');
      renderProtocolMembers();
    });
  });

  document.querySelectorAll('[data-draftdel]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.draftdel;
      const dbNow = loadDB();
      const row = (dbNow.protocolDraftMembers || []).find(m => m.id === id);
      if (!confirm(`Remove ${row ? row.name : 'this row'} from the draft list?`)) return;
      dbNow.protocolDraftMembers = (dbNow.protocolDraftMembers || []).filter(m => m.id !== id);
      saveDB(dbNow);
      logAudit('protocol', dbNow.portalProfiles.protocol.name, 'Removed draft member', row ? row.name : id);
      renderProtocolMembers();
    });
  });

  const saveBtn = document.getElementById('protoSaveBtn');
  const saveMenu = document.getElementById('protoSaveMenu');
  saveBtn?.addEventListener('click', (e) => { e.stopPropagation(); saveMenu.classList.toggle('active'); });
  document.addEventListener('click', () => saveMenu?.classList.remove('active'));
  saveMenu?.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.export;
      if (type === 'csv') exportMembersCSV(draft, 'protocol-members');
      else if (type === 'excel') exportMembersExcel(draft, 'protocol-members');
      else exportMembersPDF(draft, 'Protocol — New Members');
      saveMenu.classList.remove('active');
    });
  });

  document.getElementById('protoSendBtn')?.addEventListener('click', () => {
    if (!draft.length) return;
    openConfirmModal({
      title: '<span class="ic">📤</span> Send intake to Admin?',
      message: `You are about to send ${draft.length} member(s) to Admin Member Control. This hand-off cannot be undone from Protocol. Continue?`,
      confirmLabel: 'Yes, Send to Admin',
      onConfirm: () => {
        const dbNow = loadDB();
        dbNow.memberDocuments.unshift({
          id: uid('mdoc'),
          fromRole: 'protocol',
          toRole: 'super_admin',
          stage: 'intake',
          title: `New Members Intake — ${new Date().toLocaleDateString()}`,
          members: structuredClone(dbNow.protocolDraftMembers || []),
          at: new Date().toISOString(),
          status: 'new'
        });
        const count = (dbNow.protocolDraftMembers || []).length;
        dbNow.protocolDraftMembers = [];
        saveDB(dbNow);
        logAudit('protocol', dbNow.portalProfiles.protocol.name, 'Sent member intake list to Admin', `${count} members`);
        alert('List sent to Admin Member Control.');
        renderProtocolMembers();
      }
    });
  });

  document.getElementById('protoClearBtn')?.addEventListener('click', () => {
    openConfirmModal({
      title: '<span class="ic">🗑</span> Clear draft list?',
      message: 'This removes every name from the Protocol draft. It does not affect lists already sent.',
      confirmLabel: 'Clear list',
      danger: true,
      onConfirm: () => {
        const dbNow = loadDB();
        dbNow.protocolDraftMembers = [];
        saveDB(dbNow);
        logAudit('protocol', dbNow.portalProfiles.protocol.name, 'Cleared protocol draft list');
        renderProtocolMembers();
      }
    });
  });
}

/* ---- Disciple portals: receive lists + send graduation ---- */
function renderDiscipleMembers() {
  const db = loadDB();
  const docs = (db.memberDocuments || []).filter(d => d.toRole === activePortalKey)
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">👥</span> Members — ${PORTAL_DEFS[activePortalKey].label}</h3>
      <p class="muted" style="margin-bottom:16px;">Lists sent by Admin appear here as documents. Members are also enrolled automatically into the <strong>Register</strong> tab for attendance. Use Register to mark presence and send graduates.</p>
      <div class="cms-list">
        ${docs.length ? docs.map(d => `
          <div class="cms-list-item">
            <div>
              <strong>${d.title}</strong>
              <span class="status-badge status-${d.status === 'new' ? 'pending' : 'checked-out'}">${d.status}</span>
              <div class="muted small">From ${PORTAL_DEFS[d.fromRole]?.label || d.fromRole} · ${d.members?.length || 0} members · ${new Date(d.at).toLocaleString()}</div>
            </div>
            <button type="button" class="icon-btn small gold" data-viewdoc="${d.id}"><span class="ic">👁</span> View</button>
          </div>
        `).join('') : '<p class="muted">No member lists received yet. When Admin sends a list, it will show here and in Register.</p>'}
      </div>
    </div>
  `;

  document.querySelectorAll('[data-viewdoc]').forEach(btn => {
    btn.addEventListener('click', () => openMemberDocModal(btn.dataset.viewdoc, 'disciple'));
  });
}

function renderMemberMembersTab() {
  if (activePortalKey === 'protocol') {
    renderProtocolMembers();
  } else if (activePortalKey === 'disciple1' || activePortalKey === 'disciple2' || activePortalKey === 'disciple3') {
    renderDiscipleMembers();
  } else {
    document.getElementById('adminContent').innerHTML = `<div class="admin-panel"><p class="muted">Members section is not available for this portal.</p></div>`;
  }
}

/* ---- Register tab (Disciple 1/2/3 only): attendance + Ready filter + Send Graduate ---- */
let registerViewMode = 'roll'; // 'roll' | 'graduation-preview'

function renderMemberRegisterTab() {
  if (activePortalKey !== 'disciple1' && activePortalKey !== 'disciple2' && activePortalKey !== 'disciple3') {
    document.getElementById('adminContent').innerHTML = `
      <div class="admin-panel">
        <h3 class="admin-panel-title"><span class="ic">📝</span> Register</h3>
        <p class="muted">Attendance register is only available for Disciple Class portals.</p>
      </div>`;
    return;
  }
  if (registerViewMode === 'graduation-preview') {
    renderRegisterGraduationPreview();
  } else {
    renderRegisterRollCall();
  }
}

function renderRegisterRollCall() {
  const db = loadDB();
  const reg = (db.classRegisters && db.classRegisters[activePortalKey]) || [];
  const readyCount = reg.filter(isReadyForGraduation).length;

  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📝</span> Class Register — ${PORTAL_DEFS[activePortalKey].label}</h3>
      <p class="muted" style="margin-bottom:16px;">
        Mark <strong>O</strong> (Present) or <strong>X</strong> (Absent) each session. The battery shows attendance %.
        Status turns <span style="color:#4caf6e;font-weight:700;">Ready</span> at 80%+ (with at least one mark).
        ${reg.length ? `<br><strong>${readyCount}</strong> of <strong>${reg.length}</strong> currently Ready.` : ''}
      </p>
      ${reg.length ? `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Present (O)</th>
                <th>Absent (X)</th>
                <th>Attendance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${reg.map((r, i) => {
                const pct = attendancePct(r);
                const ready = isReadyForGraduation(r);
                return `
                  <tr data-regid="${r.id}">
                    <td>${i + 1}</td>
                    <td><strong>${r.name}</strong><div class="muted small">${r.email || ''}</div></td>
                    <td>${r.phone || '—'}</td>
                    <td>
                      <button type="button" class="att-mark present ${/* highlight if last was present - optional */ ''}" data-present="${r.id}" title="Mark Present (O)">O</button>
                      <span class="muted small">×${r.presentCount || 0}</span>
                    </td>
                    <td>
                      <button type="button" class="att-mark absent" data-absent="${r.id}" title="Mark Absent (X)">X</button>
                      <span class="muted small">×${r.absentCount || 0}</span>
                    </td>
                    <td style="min-width:120px;">${batteryBarHTML(pct)}</td>
                    <td>
                      <span class="status-badge" style="background:${ready ? 'rgba(76,175,110,.18)' : 'rgba(232,96,122,.15)'};color:${ready ? '#4caf6e' : '#e8607a'};">
                        ${ready ? 'Ready' : 'Not Ready'}
                      </span>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:20px;align-items:center;">
          ${memberSaveMenuHTML('regRoll')}
          <button type="button" class="icon-btn gold" id="regSendGradPreviewBtn">
            <span class="ic">🎓</span> Send Graduation
          </button>
          <span class="muted small">⚠ Filters Ready (≥80%) from Not Ready — only Ready can be sent to Admin</span>
        </div>
      ` : `
        <div class="coming-soon"><div class="ic">📝</div>No members enrolled yet. When Admin sends a list to this class, names appear here automatically.</div>
      `}
    </div>
  `;

  document.querySelectorAll('[data-present]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      const rec = (dbNow.classRegisters[activePortalKey] || []).find(x => x.id === btn.dataset.present);
      if (!rec) return;
      rec.presentCount = (rec.presentCount || 0) + 1;
      saveDB(dbNow);
      renderRegisterRollCall();
    });
  });
  document.querySelectorAll('[data-absent]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      const rec = (dbNow.classRegisters[activePortalKey] || []).find(x => x.id === btn.dataset.absent);
      if (!rec) return;
      rec.absentCount = (rec.absentCount || 0) + 1;
      saveDB(dbNow);
      renderRegisterRollCall();
    });
  });

  const saveBtn = document.getElementById('regRollSaveBtn');
  const saveMenu = document.getElementById('regRollSaveMenu');
  saveBtn?.addEventListener('click', (e) => { e.stopPropagation(); saveMenu.classList.toggle('active'); });
  document.addEventListener('click', () => saveMenu?.classList.remove('active'));
  saveMenu?.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.export;
      const rows = reg.map(r => ({
        name: r.name, phone: r.phone, email: r.email, year: r.year,
        // extend export
      }));
      const enriched = reg.map(r => ({
        name: `${r.name} (${attendancePct(r)}% — ${isReadyForGraduation(r) ? 'Ready' : 'Not Ready'})`,
        phone: r.phone, email: r.email, year: r.year
      }));
      if (type === 'csv') exportMembersCSV(enriched, `${activePortalKey}-register`);
      else if (type === 'excel') exportMembersExcel(enriched, `${activePortalKey}-register`);
      else exportMembersPDF(enriched, `${PORTAL_DEFS[activePortalKey].label} Register`);
      saveMenu.classList.remove('active');
    });
  });

  document.getElementById('regSendGradPreviewBtn')?.addEventListener('click', () => {
    if (!reg.length) return;
    registerViewMode = 'graduation-preview';
    renderMemberRegisterTab();
  });
}

function renderRegisterGraduationPreview() {
  const db = loadDB();
  const reg = (db.classRegisters && db.classRegisters[activePortalKey]) || [];
  const ready = reg.filter(isReadyForGraduation);
  const notReady = reg.filter(r => !isReadyForGraduation(r));
  const stageMap = { disciple1: 'class1', disciple2: 'class2', disciple3: 'class3' };
  const stage = stageMap[activePortalKey];

  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <button type="button" class="icon-btn small" id="regBackToRoll" style="margin-bottom:14px;"><span class="ic">←</span> Back to Register</button>
      <h3 class="admin-panel-title"><span class="ic">🎓</span> Graduation Preview — ${PORTAL_DEFS[activePortalKey].label}</h3>
      <p class="muted" style="margin-bottom:16px;">Only members at <strong>80%+ attendance</strong> appear under Ready. Send Graduate forwards the Ready list to Admin Member Control.</p>
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">✅</span> Ready <span class="status-badge" style="background:rgba(76,175,110,.18);color:#4caf6e;">${ready.length}</span></h3>
      ${memberTableHTML(ready.map(r => ({ name: r.name, phone: r.phone, email: r.email, year: r.year })))}
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px;align-items:center;">
        ${memberSaveMenuHTML('regReady')}
        <button type="button" class="icon-btn gold" id="regSendReadyBtn" ${ready.length ? '' : 'disabled'}>
          <span class="ic">📤</span> Send Graduate to Admin
        </button>
        <span class="muted small">⚠ Only click if you are sure this class has completed</span>
      </div>
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">❌</span> Not Ready <span class="status-badge" style="background:rgba(232,96,122,.15);color:#e8607a;">${notReady.length}</span></h3>
      ${memberTableHTML(notReady.map(r => ({ name: r.name, phone: r.phone, email: r.email, year: r.year })))}
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px;">
        ${memberSaveMenuHTML('regNotReady')}
      </div>
    </div>

    ${activePortalKey === 'disciple3' ? `
      <div class="admin-panel">
        <h3 class="admin-panel-title"><span class="ic">🏆</span> General Wall</h3>
        <p class="muted" style="margin-bottom:12px;">Send Ready members as General Wall candidates (fully graduated through all classes).</p>
        <button type="button" class="icon-btn gold" id="regSendGeneralBtn" ${ready.length ? '' : 'disabled'}>
          <span class="ic">🏆</span> Send Ready to General Wall (Admin)
        </button>
      </div>
    ` : ''}
  `;

  document.getElementById('regBackToRoll')?.addEventListener('click', () => {
    registerViewMode = 'roll';
    renderMemberRegisterTab();
  });

  const wireSave = (prefix, list, title) => {
    const saveBtn = document.getElementById(prefix + 'SaveBtn');
    const saveMenu = document.getElementById(prefix + 'SaveMenu');
    saveBtn?.addEventListener('click', (e) => { e.stopPropagation(); saveMenu.classList.toggle('active'); });
    document.addEventListener('click', () => saveMenu?.classList.remove('active'));
    saveMenu?.querySelectorAll('[data-export]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.export;
        if (type === 'csv') exportMembersCSV(list, title);
        else if (type === 'excel') exportMembersExcel(list, title);
        else exportMembersPDF(list, title);
        saveMenu.classList.remove('active');
      });
    });
  };
  wireSave('regReady', ready, `${activePortalKey}-ready`);
  wireSave('regNotReady', notReady, `${activePortalKey}-not-ready`);

  document.getElementById('regSendReadyBtn')?.addEventListener('click', () => {
    if (!ready.length) return;
    openConfirmModal({
      title: '<span class="ic">🎓</span> Send graduates to Admin?',
      message: `Send ${ready.length} READY graduate(s) to Admin Member Control? Not Ready (${notReady.length}) stay in this class register. This hand-off cannot be undone from here.`,
      confirmLabel: 'Yes, Send Ready Graduates',
      onConfirm: () => {
        const dbNow = loadDB();
        dbNow.memberDocuments.unshift({
          id: uid('mdoc'),
          fromRole: activePortalKey,
          toRole: 'super_admin',
          stage,
          title: `${PORTAL_DEFS[activePortalKey].label} Graduation (Ready) — ${new Date().toLocaleDateString()}`,
          members: ready.map(r => ({ id: r.id, name: r.name, phone: r.phone, email: r.email, year: r.year })),
          at: new Date().toISOString(),
          status: 'new'
        });
        saveDB(dbNow);
        logAudit(activePortalKey, dbNow.portalProfiles[activePortalKey].name, 'Sent READY graduates to Admin', `${ready.length} members`);
        alert('Ready graduates sent to Admin Member Control.');
        registerViewMode = 'roll';
        renderMemberRegisterTab();
      }
    });
  });

  document.getElementById('regSendGeneralBtn')?.addEventListener('click', () => {
    if (!ready.length) return;
    openConfirmModal({
      title: '<span class="ic">🏆</span> Send to General Wall?',
      message: `Send ${ready.length} READY member(s) as General Wall candidates to Admin? This marks them as fully graduated through all classes.`,
      confirmLabel: 'Yes, Send to General Wall',
      onConfirm: () => {
        const dbNow = loadDB();
        dbNow.memberDocuments.unshift({
          id: uid('mdoc'),
          fromRole: 'disciple3',
          toRole: 'super_admin',
          stage: 'general',
          title: `General Wall Candidates (Ready) — ${new Date().toLocaleDateString()}`,
          members: ready.map(r => ({ id: r.id, name: r.name, phone: r.phone, email: r.email, year: r.year })),
          at: new Date().toISOString(),
          status: 'new'
        });
        saveDB(dbNow);
        logAudit('disciple3', dbNow.portalProfiles.disciple3.name, 'Sent READY general wall candidates', `${ready.length} members`);
        alert('Ready list sent to Admin for General Wall.');
        registerViewMode = 'roll';
        renderMemberRegisterTab();
      }
    });
  });
}

/* ---- Shared document viewer modal (reuses deleteReasonOverlay shell or creates inline) ---- */
let viewingMemberDocId = null;
let viewingMemberDocMode = 'admin'; // 'admin' | 'disciple'

function openMemberDocModal(docId, mode) {
  const db = loadDB();
  const doc = (db.memberDocuments || []).find(d => d.id === docId);
  if (!doc) return;
  viewingMemberDocId = docId;
  viewingMemberDocMode = mode;

  // Mark viewed + audit
  if (doc.status === 'new') {
    doc.status = 'viewed';
    saveDB(db);
  }
  const actorLabel = mode === 'admin'
    ? (db.owner?.name || 'Admin')
    : (db.portalProfiles[activePortalKey]?.name || activePortalKey);
  logAudit(mode === 'admin' ? 'super_admin' : activePortalKey, actorLabel, 'Viewed member document', doc.title);

  const canSendToClass1 = mode === 'admin' && doc.stage === 'intake';
  const canSendToClass2 = mode === 'admin' && doc.stage === 'class1';
  const canSendToClass3 = mode === 'admin' && doc.stage === 'class2';
  const canSendToWall = mode === 'admin' && (doc.stage === 'class1' || doc.stage === 'class2' || doc.stage === 'class3' || doc.stage === 'general');
  // Send Graduation moved to Register tab (attendance-based filter)

  // Build modal content into deleteReasonOverlay (repurposed) or a dedicated overlay
  let overlay = document.getElementById('memberDocOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'memberDocOverlay';
    overlay.className = 'passcode-overlay';
    overlay.innerHTML = `<div class="passcode-box wide" style="max-width:720px;max-height:90vh;overflow-y:auto;">
      <h3 id="memberDocTitle"></h3>
      <div id="memberDocBody"></div>
      <div class="passcode-actions" id="memberDocActions" style="flex-wrap:wrap;justify-content:flex-start;gap:10px;margin-top:16px;"></div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target.id === 'memberDocOverlay') closeMemberDocModal(); });
  }

  document.getElementById('memberDocTitle').innerHTML = `<span class="ic">📋</span> ${doc.title}`;
  document.getElementById('memberDocBody').innerHTML = memberTableHTML(doc.members);

  let actions = `
    <button type="button" class="icon-btn" id="memberDocCloseBtn">Close</button>
    <div style="position:relative;display:inline-flex;">
      <button type="button" class="icon-btn small" id="memberDocSaveBtn"><span class="ic">💾</span> Save ▾</button>
      <div class="menu-dropdown" id="memberDocSaveMenu" style="top:auto;bottom:calc(100% + 6px);left:0;min-width:140px;">
        <button type="button" class="menu-dropdown-item" data-export="csv">CSV</button>
        <button type="button" class="menu-dropdown-item" data-export="excel">Excel</button>
        <button type="button" class="menu-dropdown-item" data-export="pdf">PDF / Print</button>
      </div>
    </div>
  `;

  if (canSendToClass1) {
    actions += `<button type="button" class="icon-btn gold" id="memberDocSendClass1"><span class="ic">📤</span> Send to Disciple Class 1</button>`;
  }
  if (canSendToClass2) {
    actions += `<button type="button" class="icon-btn gold" id="memberDocSendClass2"><span class="ic">📤</span> Send to Disciple Class 2</button>`;
  }
  if (canSendToClass3) {
    actions += `<button type="button" class="icon-btn gold" id="memberDocSendClass3"><span class="ic">📤</span> Send to Disciple Class 3</button>`;
  }
  if (canSendToWall) {
    actions += `<button type="button" class="icon-btn gold" id="memberDocToWall"><span class="ic">👥</span> Katoloni Wall</button>`;
  }
  // Certificates for graduation / general batches
  if (mode === 'admin' && (doc.stage === 'class1' || doc.stage === 'class2' || doc.stage === 'class3' || doc.stage === 'general')) {
    actions += `<button type="button" class="icon-btn gold" id="memberDocCertBatch"><span class="ic">📜</span> Certificates (PDF)</button>`;
  }

  document.getElementById('memberDocActions').innerHTML = actions;
  overlay.classList.add('active');

  document.getElementById('memberDocCloseBtn').addEventListener('click', closeMemberDocModal);

  const saveMenu = document.getElementById('memberDocSaveMenu');
  document.getElementById('memberDocSaveBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    saveMenu.classList.toggle('active');
  });
  document.addEventListener('click', () => saveMenu?.classList.remove('active'));
  saveMenu?.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.export;
      if (type === 'csv') exportMembersCSV(doc.members, doc.title);
      else if (type === 'excel') exportMembersExcel(doc.members, doc.title);
      else exportMembersPDF(doc.members, doc.title);
      saveMenu.classList.remove('active');
    });
  });

  document.getElementById('memberDocSendClass1')?.addEventListener('click', () => {
    if (!confirm('Send this intake list to Disciple Class 1? Members will appear in Class 1 Register.')) return;
    const dbNow = loadDB();
    const d = dbNow.memberDocuments.find(x => x.id === docId);
    if (!d) return;
    d.status = 'sent';
    const newDocId = uid('mdoc');
    dbNow.memberDocuments.unshift({
      id: newDocId,
      fromRole: 'super_admin',
      toRole: 'disciple1',
      stage: 'class1',
      title: `Class 1 Intake — ${new Date().toLocaleDateString()}`,
      members: structuredClone(d.members),
      at: new Date().toISOString(),
      status: 'new'
    });
    enrollMembersIntoRegister(dbNow, 'disciple1', d.members, newDocId);
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Sent intake list to Disciple Class 1', `${d.members.length} members`);
    alert('List sent to Disciple Class 1. Members are now in the Class Register.');
    closeMemberDocModal();
    renderAdminMemberControl();
  });

  document.getElementById('memberDocSendClass2')?.addEventListener('click', () => {
    if (!confirm('Send this list to Disciple Class 2? Members will appear in Class 2 Register.')) return;
    const dbNow = loadDB();
    const d = dbNow.memberDocuments.find(x => x.id === docId);
    if (!d) return;
    d.status = 'sent';
    const newDocId = uid('mdoc');
    dbNow.memberDocuments.unshift({
      id: newDocId,
      fromRole: 'super_admin',
      toRole: 'disciple2',
      stage: 'class2',
      title: `Class 2 List — ${new Date().toLocaleDateString()}`,
      members: structuredClone(d.members),
      at: new Date().toISOString(),
      status: 'new'
    });
    enrollMembersIntoRegister(dbNow, 'disciple2', d.members, newDocId);
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Sent list to Disciple Class 2', `${d.members.length} members`);
    alert('List sent to Disciple Class 2. Members are now in the Class Register.');
    closeMemberDocModal();
    renderAdminMemberControl();
  });

  document.getElementById('memberDocSendClass3')?.addEventListener('click', () => {
    if (!confirm('Send this list to Disciple Class 3? Members will appear in Class 3 Register.')) return;
    const dbNow = loadDB();
    const d = dbNow.memberDocuments.find(x => x.id === docId);
    if (!d) return;
    d.status = 'sent';
    const newDocId = uid('mdoc');
    dbNow.memberDocuments.unshift({
      id: newDocId,
      fromRole: 'super_admin',
      toRole: 'disciple3',
      stage: 'class3',
      title: `Class 3 List — ${new Date().toLocaleDateString()}`,
      members: structuredClone(d.members),
      at: new Date().toISOString(),
      status: 'new'
    });
    enrollMembersIntoRegister(dbNow, 'disciple3', d.members, newDocId);
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Sent list to Disciple Class 3', `${d.members.length} members`);
    alert('List sent to Disciple Class 3.');
    closeMemberDocModal();
    renderAdminMemberControl();
  });

  document.getElementById('memberDocSendGrad')?.addEventListener('click', () => {
    if (!confirm('Confirm: only click if this class has graduated. Send graduation list to Admin?')) return;
    const dbNow = loadDB();
    const d = dbNow.memberDocuments.find(x => x.id === docId);
    if (!d) return;
    d.status = 'sent';
    const stageMap = { disciple1: 'class1', disciple2: 'class2', disciple3: 'class3' };
    const stage = stageMap[activePortalKey] || 'class1';
    dbNow.memberDocuments.unshift({
      id: uid('mdoc'),
      fromRole: activePortalKey,
      toRole: 'super_admin',
      stage,
      title: `${PORTAL_DEFS[activePortalKey].label} Graduation — ${new Date().toLocaleDateString()}`,
      members: structuredClone(d.members),
      at: new Date().toISOString(),
      status: 'new'
    });
    saveDB(dbNow);
    logAudit(activePortalKey, dbNow.portalProfiles[activePortalKey].name, 'Sent graduation list to Admin', `${d.members.length} members`);
    alert('Graduation list sent to Admin Member Control.');
    closeMemberDocModal();
    renderDiscipleMembers();
  });

  document.getElementById('memberDocSendGeneral')?.addEventListener('click', () => {
    if (!confirm('Send this list toward the General Wall (fully graduated)?')) return;
    const dbNow = loadDB();
    const d = dbNow.memberDocuments.find(x => x.id === docId);
    if (!d) return;
    d.status = 'sent';
    dbNow.memberDocuments.unshift({
      id: uid('mdoc'),
      fromRole: 'disciple3',
      toRole: 'super_admin',
      stage: 'general',
      title: `General Wall Candidates — ${new Date().toLocaleDateString()}`,
      members: structuredClone(d.members),
      at: new Date().toISOString(),
      status: 'new'
    });
    saveDB(dbNow);
    logAudit('disciple3', dbNow.portalProfiles.disciple3.name, 'Sent general wall candidates to Admin', `${d.members.length} members`);
    alert('List sent to Admin for General Wall.');
    closeMemberDocModal();
    renderDiscipleMembers();
  });

  document.getElementById('memberDocToWall')?.addEventListener('click', () => {
    closeMemberDocModal();
    // Jump to Wall tab and open "from list" mode
    adminActiveTab = 'wall';
    window._wallFromDocId = docId;
    renderAdminSidebar();
    renderAdminWall();
  });

  document.getElementById('memberDocCertBatch')?.addEventListener('click', () => {
    const stageToCat = { class1: 'class1', class2: 'class2', class3: 'class3', general: 'general' };
    const cat = stageToCat[doc.stage] || doc.stage;
    const now = new Date();
    generateBatchCertificates(doc.members, cat, '', now.getFullYear());
  });
}

function closeMemberDocModal() {
  document.getElementById('memberDocOverlay')?.classList.remove('active');
  viewingMemberDocId = null;
  if (activePortalKey === 'admin') {
    renderAdminSidebar();
    if (adminActiveTab === 'memberControl') renderAdminMemberControl();
  } else {
    renderMemberSidebar();
  }
}

/* ---- Admin Member Control ---- */
function renderAdminMemberControl() {
  const db = loadDB();
  const docs = (db.memberDocuments || []).filter(d => d.toRole === 'super_admin')
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  const byStage = {
    intake: docs.filter(d => d.stage === 'intake'),
    class1: docs.filter(d => d.stage === 'class1'),
    class2: docs.filter(d => d.stage === 'class2'),
    class3: docs.filter(d => d.stage === 'class3'),
    general: docs.filter(d => d.stage === 'general')
  };

  const stageMeta = {
    intake: { label: 'Intake (from Protocol)', icon: '🛎' },
    class1: { label: 'Class 1 Graduations', icon: '①' },
    class2: { label: 'Class 2 Graduations', icon: '②' },
    class3: { label: 'Class 3 Graduations', icon: '③' },
    general: { label: 'General Wall Candidates', icon: '🎓' }
  };

  // Full batch history: every document in the system
  const allBatches = [...(db.memberDocuments || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  const stageLabel = (s) => ({
    intake: 'Intake', class1: 'Class 1', class2: 'Class 2', class3: 'Class 3', general: 'General'
  }[s] || s);

  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">👥</span> Member Control</h3>
      <p class="muted" style="margin-bottom:16px;">
        Lists arrive as documents. For a Class 1/2 graduation you can publish to <strong>Katoloni Wall</strong>
        and/or <strong>Forward</strong> the same names to the next class — those are separate actions.
      </p>
    </div>
    ${['intake', 'class1', 'class2', 'class3', 'general'].map(stage => {
      const list = byStage[stage];
      const meta = stageMeta[stage];
      return `
        <div class="admin-panel">
          <h3 class="admin-panel-title"><span class="ic">${meta.icon}</span> ${meta.label}</h3>
          <div class="cms-list">
            ${list.length ? list.map(d => `
              <div class="cms-list-item">
                <div>
                  <strong>${d.title}</strong>
                  <span class="status-badge status-${d.status === 'new' ? 'pending' : d.status === 'sent' ? 'checked-out' : 'checked-in'}">${d.status}</span>
                  <div class="muted small">From ${PORTAL_DEFS[d.fromRole]?.label || d.fromRole} · ${d.members?.length || 0} members · ${new Date(d.at).toLocaleString()}</div>
                </div>
                <button type="button" class="icon-btn small gold" data-viewdoc="${d.id}"><span class="ic">👁</span> View</button>
              </div>
            `).join('') : '<p class="muted">No lists in this stage yet.</p>'}
          </div>
        </div>`;
    }).join('')}

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📜</span> Batch History (all cohorts)</h3>
      <p class="muted small" style="margin-bottom:12px;">Every list ever sent in the pipeline — stage, status, from → to. Use this to see where a cohort is stuck.</p>
      ${allBatches.length ? `
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Title</th>
                <th>Stage</th>
                <th>From → To</th>
                <th>Count</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${allBatches.map(d => `
                <tr>
                  <td class="muted small">${new Date(d.at).toLocaleString()}</td>
                  <td>${d.title}</td>
                  <td>${stageLabel(d.stage)}</td>
                  <td class="muted small">${PORTAL_DEFS[d.fromRole]?.label || d.fromRole} → ${d.toRole === 'super_admin' ? 'Admin' : (PORTAL_DEFS[d.toRole]?.label || d.toRole)}</td>
                  <td>${d.members?.length || 0}</td>
                  <td><span class="status-badge status-${d.status === 'new' ? 'pending' : d.status === 'sent' ? 'checked-out' : 'checked-in'}">${d.status}</span></td>
                  <td><button type="button" class="icon-btn small" data-viewdoc="${d.id}"><span class="ic">👁</span></button></td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p class="muted">No batches yet.</p>'}
    </div>
  `;

  document.querySelectorAll('[data-viewdoc]').forEach(btn => {
    btn.addEventListener('click', () => openMemberDocModal(btn.dataset.viewdoc, 'admin'));
  });
}

/* ============================================================
   COMPLAINTS — ADMIN OVERSIGHT + BISHOP INBOX
   ============================================================ */
let adminComplaintsFilter = 'open';   // 'open' | 'resolved' | 'all'
let bishopComplaintsFilter = 'open';

function complaintListHTML(items) {
  if (!items.length) return '<p class="muted">No complaints here.</p>';
  return items.map(c => `
    <div class="cms-list-item ${c.status === 'open' ? 'complaint-open' : ''}">
      <div>
        <strong>${c.title}</strong>
        <span class="status-badge status-${c.status === 'open' ? 'pending' : 'checked-out'}">${c.status}</span>
        <div class="muted small">From ${PORTAL_DEFS[c.fromRole]?.label || c.fromRole} · ${new Date(c.at).toLocaleString()}</div>
        <div>${c.issue}</div>
        ${c.attachment ? `<div class="muted small">📎 ${c.attachment}</div>` : ''}
        ${c.status === 'resolved' ? `<div class="muted small">✅ Resolved ${c.resolvedAt ? new Date(c.resolvedAt).toLocaleString() : ''} by ${c.resolvedBy || ''}${c.resolutionNote ? ' — "' + c.resolutionNote + '"' : ''}</div>` : ''}
      </div>
      ${c.status === 'open' ? `<button type="button" class="icon-btn small gold" data-complaintresolve="${c.id}"><span class="ic">✅</span> Resolve</button>` : ''}
    </div>
  `).join('');
}

function renderAdminComplaints() {
  const db = loadDB();
  const toAdmin = db.complaints.filter(c => c.toRole === 'super_admin');
  const toBishop = db.complaints.filter(c => c.toRole === 'bishop');
  const filterList = (list) => adminComplaintsFilter === 'all' ? list : list.filter(c => c.status === adminComplaintsFilter);

  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">⚠️</span> Complaints</h3>
      <p class="muted" style="margin-bottom:16px;">Complaints raised by Protocol and the Disciple Class portals. Complaints addressed to the Bishop are shown here too, for oversight — you can resolve either.</p>
      <div class="filter-pills">
        ${['open', 'resolved', 'all'].map(f => `<button type="button" class="filter-pill ${adminComplaintsFilter === f ? 'active' : ''}" data-cfilter="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}
      </div>
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">🔑</span> Sent to Admin</h3>
      <div class="cms-list">${complaintListHTML(filterList(toAdmin))}</div>
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">✝</span> Sent to Bishop <span class="muted small">(oversight)</span></h3>
      <div class="cms-list">${complaintListHTML(filterList(toBishop))}</div>
    </div>
  `;

  document.querySelectorAll('[data-cfilter]').forEach(btn => {
    btn.addEventListener('click', () => { adminComplaintsFilter = btn.dataset.cfilter; renderAdminComplaints(); });
  });
  document.querySelectorAll('[data-complaintresolve]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      openComplaintResolve(btn.dataset.complaintresolve, 'super_admin', dbNow.owner.name, renderAdminComplaints);
    });
  });
}

function renderBishopComplaintsInbox() {
  const db = loadDB();
  const mine = db.complaints.filter(c => c.toRole === 'bishop');
  const filtered = bishopComplaintsFilter === 'all' ? mine : mine.filter(c => c.status === bishopComplaintsFilter);

  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">⚠️</span> Complaints</h3>
      <p class="muted" style="margin-bottom:16px;">Complaints raised by Protocol and the Disciple Class portals, addressed to you.</p>
      <div class="filter-pills">
        ${['open', 'resolved', 'all'].map(f => `<button type="button" class="filter-pill ${bishopComplaintsFilter === f ? 'active' : ''}" data-bcfilter="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}
      </div>
      <div class="cms-list">${complaintListHTML(filtered)}</div>
    </div>
  `;

  document.querySelectorAll('[data-bcfilter]').forEach(btn => {
    btn.addEventListener('click', () => { bishopComplaintsFilter = btn.dataset.bcfilter; renderBishopComplaintsInbox(); });
  });
  document.querySelectorAll('[data-complaintresolve]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      const label = dbNow.portalProfiles.bishop.name || 'Bishop';
      openComplaintResolve(btn.dataset.complaintresolve, 'bishop', label, renderBishopComplaintsInbox);
    });
  });
}

function renderMemberProfile() {
  const db = loadDB();
  const profile = db.portalProfiles[activePortalKey];
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">👤</span> ${PORTAL_DEFS[activePortalKey].label} Profile</h3>
      <div class="profile-grid">
        <div class="avatar-upload">
          <div class="avatar-preview" id="portalAvatarPreview">
            ${profile.photo ? `<img src="${profile.photo}" alt="${profile.name}">` : `<span>${(profile.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}</span>`}
          </div>
          <label class="file-btn">
            <input type="file" id="portalPhotoInput" accept="image/*" hidden>
            Choose File
          </label>
        </div>
        <div class="form-fields">
          <div class="form-row">
            <div class="form-field">
              <label>Department / Leader Name</label>
              <input type="text" id="portalNameInput" value="${profile.name || ''}">
            </div>
            <div class="form-field">
              <label>Phone</label>
              <input type="text" id="portalPhoneInput" value="${profile.phone || ''}">
            </div>
          </div>
          <div class="form-field">
            <label>Email</label>
            <input type="text" id="portalEmailInput" value="${profile.email || ''}">
          </div>
          <button type="button" class="icon-btn gold" id="portalProfileSaveBtn"><span class="ic">💾</span> Save Changes</button>
        </div>
      </div>
    </div>
  `;

  let pendingPhoto = null;
  document.getElementById('portalPhotoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingPhoto = await fileToBase64(file);
    document.getElementById('portalAvatarPreview').innerHTML = `<img src="${pendingPhoto}" alt="preview">`;
  });

  document.getElementById('portalProfileSaveBtn').addEventListener('click', () => {
    const dbNow = loadDB();
    const p = dbNow.portalProfiles[activePortalKey];
    p.name = document.getElementById('portalNameInput').value.trim() || p.name;
    p.phone = document.getElementById('portalPhoneInput').value.trim();
    p.email = document.getElementById('portalEmailInput').value.trim();
    if (pendingPhoto) p.photo = pendingPhoto;
    saveDB(dbNow);
    document.getElementById('adminSignedInName').textContent = p.name;
    logAudit(activePortalKey, p.name, 'Updated portal profile');
    renderMemberProfile();
  });
}

function memberReceivedExportRows(items) {
  return items.map(m => ({
    from: PORTAL_DEFS[m.fromRole]?.label || m.fromRole || '',
    subject: m.subject || '',
    body: (m.body || '').replace(/\n/g, ' '),
    attachment: m.attachment || '',
    date: m.at ? new Date(m.at).toLocaleString() : '',
    status: m.readAt ? 'cleared' : 'new'
  }));
}

function downloadMemberCSV(items) {
  const rows = memberReceivedExportRows(items);
  const header = 'From,Subject,Body,Attachment,Date,Status';
  const lines = rows.map(r => [r.from, r.subject, r.body, r.attachment, r.date, r.status].map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `received-${activePortalKey}.csv`;
  a.click();
}

function downloadMemberExcel(items) {
  // Simple HTML table as .xls
  const rows = memberReceivedExportRows(items);
  let html = '<table><tr><th>From</th><th>Subject</th><th>Body</th><th>Attachment</th><th>Date</th><th>Status</th></tr>';
  rows.forEach(r => {
    html += `<tr><td>${r.from}</td><td>${r.subject}</td><td>${r.body}</td><td>${r.attachment}</td><td>${r.date}</td><td>${r.status}</td></tr>`;
  });
  html += '</table>';
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `received-${activePortalKey}.xls`;
  a.click();
}

function printMemberPDF(items) {
  const rows = memberReceivedExportRows(items);
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>Received Messages</title>
    <style>body{font-family:sans-serif;padding:24px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:12px} th{background:#f5f5f5}</style>
    </head><body><h2>${PORTAL_DEFS[activePortalKey]?.label || ''} — Received</h2>
    <table><thead><tr><th>From</th><th>Subject</th><th>Body</th><th>Attachment</th><th>Date</th><th>Status</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${r.from}</td><td>${r.subject}</td><td>${r.body}</td><td>${r.attachment}</td><td>${r.date}</td><td>${r.status}</td></tr>`).join('') || '<tr><td colspan="6">Nothing received yet.</td></tr>'}
    </tbody></table></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

function renderMemberReceived() {
  const db = loadDB();
  const items = (db.messages || []).filter(m => m.toRole === activePortalKey);
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📥</span> Received</h3>
      <p class="muted small" style="margin-bottom:12px;">${items.length} message${items.length === 1 ? '' : 's'} stored for this portal.</p>
      <div class="cms-list">
        ${items.length ? items.map(m => `
          <div class="cms-list-item">
            <div>
              <strong>${m.subject || '(no subject)'}</strong>
              <div class="muted small">From ${PORTAL_DEFS[m.fromRole]?.label || m.fromRole} · ${new Date(m.at).toLocaleString()}</div>
              <div>${m.body}</div>
              ${m.attachment ? `<div class="muted small">📎 ${m.attachment}</div>` : ''}
            </div>
            ${!m.readAt ? `<button type="button" class="icon-btn small" data-clearmsg="${m.id}"><span class="ic">✅</span> Clear</button>` : `<span class="status-badge status-checked-out">cleared</span>`}
          </div>
        `).join('') : '<p class="muted">Nothing received yet.</p>'}
      </div>
      <div class="export-bar" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px;">
        <button type="button" class="icon-btn small" id="memberExportCSV"><span class="ic">⬇</span> Save CSV</button>
        <button type="button" class="icon-btn small" id="memberExportExcel"><span class="ic">⬇</span> Save Excel</button>
        <button type="button" class="icon-btn small" id="memberExportPDF"><span class="ic">🖨</span> Save / Print PDF</button>
      </div>
    </div>
  `;
  document.getElementById('memberExportCSV')?.addEventListener('click', () => downloadMemberCSV(items));
  document.getElementById('memberExportExcel')?.addEventListener('click', () => downloadMemberExcel(items));
  document.getElementById('memberExportPDF')?.addEventListener('click', () => printMemberPDF(items));
  document.querySelectorAll('[data-clearmsg]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      const msg = dbNow.messages.find(m => m.id === btn.dataset.clearmsg);
      if (msg) msg.readAt = new Date().toISOString();
      saveDB(dbNow);
      renderMemberSidebar();
      renderMemberReceived();
    });
  });
}


function memberSendOptionsHTML() {
  const all = [
    { value: 'super_admin', label: 'Admin' },
    { value: 'bishop', label: 'Bishop' },
    { value: 'protocol', label: 'Protocol' },
    { value: 'disciple1', label: 'Disciple Class 1' },
    { value: 'disciple2', label: 'Disciple Class 2' },
    { value: 'disciple3', label: 'Disciple Class 3' }
  ];
  let list = all;
  if (activePortalKey === 'bishop') {
    list = all.filter(o => o.value !== 'bishop');
  } else {
    // protocol/disciple: can send to admin, bishop, and other portals (not self)
    list = all.filter(o => o.value !== activePortalKey);
  }
  return list.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
}

function renderMemberSend() {
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📤</span> Send</h3>
      <div class="form-field">
        <label>To</label>
        <select id="memberSendTo">${memberSendOptionsHTML()}</select>
      </div>
      <div class="form-field"><label>Subject</label><input type="text" id="memberSendSubject" placeholder="Subject"></div>
      <div class="form-field"><label>Message</label><textarea id="memberSendBody" rows="4" placeholder="Write your message..."></textarea></div>
      <div class="form-field">
        <label>Attach Via</label>
        <div class="attach-grid">
          <label class="attach-btn"><input type="file" id="memberSendFile" hidden><span class="ic">📄</span> File</label>
          <button type="button" class="attach-btn" id="memberSendPasteLink"><span class="ic">🔗</span> Paste Link</button>
          <button type="button" class="attach-btn" id="memberSendNewNote"><span class="ic">📝</span> New Note</button>
        </div>
        <div class="muted small" id="memberSendAttachPreview"></div>
      </div>
      <button type="button" class="complete-booking-btn" id="memberSendBtn"><span class="ic">📤</span> Send</button>
    </div>
  `;
  let attachment = '';
  document.getElementById('memberSendFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) { attachment = f.name; document.getElementById('memberSendAttachPreview').textContent = `📎 ${attachment}`; }
  });
  document.getElementById('memberSendPasteLink').addEventListener('click', () => {
    const link = prompt('Paste a link:');
    if (link) { attachment = link; document.getElementById('memberSendAttachPreview').textContent = `🔗 ${attachment}`; }
  });
  document.getElementById('memberSendNewNote').addEventListener('click', () => {
    const note = prompt('Write a quick note:');
    if (note) { attachment = note; document.getElementById('memberSendAttachPreview').textContent = `📝 ${attachment}`; }
  });
  document.getElementById('memberSendBtn').addEventListener('click', () => {
    const toRole = document.getElementById('memberSendTo').value;
    const subject = document.getElementById('memberSendSubject').value.trim();
    const body = document.getElementById('memberSendBody').value.trim();
    if (!body) { alert('Please write a message.'); return; }
    const dbNow = loadDB();
    dbNow.messages.unshift({ id: uid('msg'), fromRole: activePortalKey, toRole, subject, body, attachment: attachment || null, at: new Date().toISOString(), readAt: null });
    saveDB(dbNow);
    logAudit(activePortalKey, dbNow.portalProfiles[activePortalKey].name, 'Sent message', toRole);
    alert('Message sent.');
    renderMemberSend();
  });
}

function renderMemberComplaints() {
  const db = loadDB();
  const mine = db.complaints.filter(c => c.fromRole === activePortalKey);
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">⚠️</span> Raise a Complaint</h3>
      <div class="form-field">
        <label>Send To</label>
        <select id="complaintTo">
          <option value="super_admin">Admin</option>
          <option value="bishop">Bishop</option>
        </select>
      </div>
      <div class="form-field"><label>Title</label><input type="text" id="complaintTitle" placeholder="Complaint title"></div>
      <div class="form-field"><label>Issue</label><textarea id="complaintIssue" rows="4" placeholder="Describe the issue..."></textarea></div>
      <div class="form-field">
        <label>Attachment (optional)</label>
        <label class="file-btn"><input type="file" id="complaintFile" hidden>Upload File</label>
        <div class="muted small" id="complaintAttachPreview"></div>
      </div>
      <button type="button" class="complete-booking-btn" id="complaintSendBtn"><span class="ic">⚠️</span> Submit Complaint</button>
    </div>
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📋</span> My Complaints</h3>
      <div class="cms-list">
        ${mine.length ? mine.map(c => `
          <div class="cms-list-item">
            <div>
              <strong>${c.title}</strong> <span class="muted small">→ ${PORTAL_DEFS[c.toRole]?.label || c.toRole} · ${new Date(c.at).toLocaleString()}</span>
              <div class="muted small">${c.issue}</div>
              ${c.attachment ? `<div class="muted small">📎 ${c.attachment}</div>` : ''}
            </div>
            <span class="status-badge status-${c.status === 'resolved' ? 'checked-out' : 'pending'}">${c.status}</span>
          </div>
        `).join('') : '<p class="muted">No complaints raised yet.</p>'}
      </div>
    </div>
  `;
  let attachment = '';
  document.getElementById('complaintFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) { attachment = f.name; document.getElementById('complaintAttachPreview').textContent = `📎 ${attachment}`; }
  });
  document.getElementById('complaintSendBtn').addEventListener('click', () => {
    const toRole = document.getElementById('complaintTo').value;
    const title = document.getElementById('complaintTitle').value.trim();
    const issue = document.getElementById('complaintIssue').value.trim();
    if (!title || !issue) { alert('Please enter a title and describe the issue.'); return; }
    const dbNow = loadDB();
    dbNow.complaints.unshift({ id: uid('cmp'), fromRole: activePortalKey, toRole, title, issue, attachment: attachment || null, at: new Date().toISOString(), status: 'open' });
    saveDB(dbNow);
    logAudit(activePortalKey, dbNow.portalProfiles[activePortalKey].name, 'Raised complaint', title);
    alert('Complaint submitted.');
    renderMemberComplaints();
  });
}

function renderMemberReport() {
  const db = loadDB();
  const sent = db.messages.filter(m => m.fromRole === activePortalKey).length;
  const received = db.messages.filter(m => m.toRole === activePortalKey).length;
  const complaints = db.complaints.filter(c => c.fromRole === activePortalKey).length;
  const stats = [
    { label: 'Sent', value: sent, color: 'var(--gold)' },
    { label: 'Received', value: received, color: '#5b7cf0' },
    { label: 'Complaints', value: complaints, color: '#e8607a' }
  ];
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📊</span> ${PORTAL_DEFS[activePortalKey].label} Report</h3>
      <div class="admin-stats-grid">
        ${adminStatCard('📤', 'Sent', sent)}
        ${adminStatCard('📥', 'Received', received)}
        ${adminStatCard('⚠️', 'Complaints', complaints)}
      </div>
      ${svgBarChartHTML(stats, 560, 220)}
    </div>
  `;
}

/* ---------- Profile tab ---------- */
function renderAdminProfile() {
  const db = loadDB();
  const owner = db.owner;
  const el = document.getElementById('adminContent');
  el.innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">👤</span> Owner Profile</h3>
      <div class="profile-grid">
        <div class="avatar-upload">
          <div class="avatar-preview" id="ownerAvatarPreview">
            ${owner.photo ? `<img src="${owner.photo}" alt="${owner.name}">` : `<span>${(owner.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}</span>`}
          </div>
          <label class="file-btn">
            <input type="file" id="ownerPhotoInput" accept="image/*" hidden>
            Choose File
          </label>
        </div>
        <div class="form-fields">
          <div class="form-row">
            <div class="form-field">
              <label>Full Name</label>
              <input type="text" id="ownerNameInput" value="${owner.name || ''}">
            </div>
            <div class="form-field">
              <label>Phone</label>
              <input type="text" id="ownerPhoneInput" value="${owner.phone || ''}">
            </div>
          </div>
          <div class="form-field">
            <label>Email (sign-in ID, contact support to change)</label>
            <input type="text" value="${owner.email || ''}" disabled>
          </div>
          <button type="button" class="icon-btn gold" id="ownerSaveBtn"><span class="ic">💾</span> Save Changes</button>
        </div>
      </div>
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">🏛</span> Ownership History</h3>
      <div class="history-list">
        ${(owner.history || []).map(h => `
          <div class="history-card ${h.current ? 'current' : ''}">
            ${h.current ? `<span class="current-badge">CURRENT</span>` : ''}
            <div class="history-avatar">
              ${h.photo ? `<img src="${h.photo}" alt="${h.name}">` : `<span>${(h.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}</span>`}
            </div>
            <div class="history-name">${h.name}</div>
            <div class="history-dates">${h.from} — ${h.to}</div>
          </div>
        `).join('') || '<p class="muted">No previous owners yet.</p>'}
      </div>
    </div>

    ${leadershipManagementPanelHTML(db)}
  `;

  let pendingPhoto = null;
  document.getElementById('ownerPhotoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingPhoto = await fileToBase64(file);
    document.getElementById('ownerAvatarPreview').innerHTML = `<img src="${pendingPhoto}" alt="preview">`;
  });

  document.getElementById('ownerSaveBtn').addEventListener('click', () => {
    const dbNow = loadDB();
    dbNow.owner.name = document.getElementById('ownerNameInput').value.trim() || dbNow.owner.name;
    dbNow.owner.phone = document.getElementById('ownerPhoneInput').value.trim();
    if (pendingPhoto) dbNow.owner.photo = pendingPhoto;
    if (dbNow.owner.history.length) {
      dbNow.owner.history[0].name = dbNow.owner.name;
      if (pendingPhoto) dbNow.owner.history[0].photo = pendingPhoto;
    }
    saveDB(dbNow);
    document.getElementById('adminSignedInName').textContent = dbNow.owner.name;
    logAudit('super_admin', dbNow.owner.name, 'Updated owner profile');
    renderAdminProfile();
  });

  initLeadershipManagementHandlers();
}

/* ---------- Leadership — Control & Management (Profile tab) ----------
   Mirrors "The People Behind The Mess" from the reference system, but
   drives db.leadership — the cards on the public Home page pyramid.
   Each card is independently editable: photo, name, role, tier (rank),
   plus per-card Save / Delete. A form at the bottom adds new leaders. */
const LEADERSHIP_TIER_LABELS = {
  1: 'Tier 1 — Leadership',
  2: 'Tier 2 — Deacons',
  3: 'Tier 3 — Officers'
};

function leadershipTierOptionsHTML(selected) {
  return [1, 2, 3].map(t => `<option value="${t}" ${+selected === t ? 'selected' : ''}>${LEADERSHIP_TIER_LABELS[t]}</option>`).join('');
}

function leadershipCardEditHTML(p) {
  const initials = (p.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('');
  return `
    <div class="lead-mgmt-card" data-leadcard="${p.id}">
      <div class="lead-mgmt-photo">
        <div class="lead-mgmt-avatar" id="leadAvatarPreview-${p.id}">
          ${p.photo ? `<img src="${p.photo}" alt="${p.name}">` : `<span>${initials}</span>`}
        </div>
        <label class="file-btn small">
          <input type="file" class="leadPhotoInput" data-id="${p.id}" accept="image/*" hidden>
          Upload Photo
        </label>
        <span class="lead-mgmt-tier-badge">${LEADERSHIP_TIER_LABELS[p.tier] || 'Unranked'}</span>
      </div>
      <div class="lead-mgmt-fields">
        <div class="form-field">
          <label>Full Name</label>
          <input type="text" class="leadNameInput" data-id="${p.id}" value="${p.name || ''}">
        </div>
        <div class="form-field">
          <label>Role / Title</label>
          <input type="text" class="leadRoleInput" data-id="${p.id}" value="${p.role || ''}">
        </div>
        <div class="form-field">
          <label>Rank (Pyramid Tier)</label>
          <select class="leadTierInput" data-id="${p.id}">
            ${leadershipTierOptionsHTML(p.tier)}
          </select>
        </div>
      </div>
      <div class="lead-mgmt-actions">
        <button type="button" class="icon-btn gold small" data-leadsave="${p.id}"><span class="ic">💾</span> Save</button>
        <button type="button" class="icon-btn small" style="background:rgba(232,96,122,.15); color:#e8607a; border-color:transparent;" data-leaddelete="${p.id}"><span class="ic">🗑</span> Delete</button>
      </div>
    </div>
  `;
}

function leadershipManagementPanelHTML(db) {
  const people = (db.leadership || []).slice().sort((a, b) => a.tier - b.tier);
  return `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">👥</span> Leadership — Control &amp; Management</h3>
      <p class="muted" style="margin-bottom:18px;">These cards appear in the flip-card pyramid on the public Home page. Edit a name, role or rank and press Save — or add a brand-new leader below.</p>

      <div id="leadershipCardsList">
        ${people.map(leadershipCardEditHTML).join('') || '<p class="muted">No leaders added yet.</p>'}
      </div>

      <div class="cms-subpanel">
        <h4><span class="ic">➕</span> Add New Leader</h4>
        <div class="lead-mgmt-card" style="background:var(--bg-panel-3);">
          <div class="lead-mgmt-photo">
            <div class="lead-mgmt-avatar" id="leadNewAvatarPreview">
              <span>+</span>
            </div>
            <label class="file-btn small">
              <input type="file" id="leadNewPhotoInput" accept="image/*" hidden>
              Upload Photo
            </label>
          </div>
          <div class="lead-mgmt-fields">
            <div class="form-field">
              <label>Full Name</label>
              <input type="text" id="leadNewName" placeholder="e.g. Deacon James Mutuku">
            </div>
            <div class="form-field">
              <label>Role / Title</label>
              <input type="text" id="leadNewRole" placeholder="e.g. Deacon">
            </div>
            <div class="form-field">
              <label>Rank (Pyramid Tier)</label>
              <select id="leadNewTier">
                ${leadershipTierOptionsHTML(2)}
              </select>
            </div>
          </div>
          <div class="lead-mgmt-actions">
            <button type="button" class="icon-btn gold small" id="leadAddBtn"><span class="ic">➕</span> Add Leader</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function initLeadershipManagementHandlers() {
  // Per-card photo upload (preview only, applied on Save)
  const pendingLeadPhotos = {};

  document.querySelectorAll('.leadPhotoInput').forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const id = inp.dataset.id;
      const b64 = await fileToBase64(file, 500, 0.75);
      pendingLeadPhotos[id] = b64;
      const preview = document.getElementById(`leadAvatarPreview-${id}`);
      if (preview) preview.innerHTML = `<img src="${b64}" alt="preview">`;
    });
  });

  // New-leader photo upload
  let pendingNewLeadPhoto = '';
  document.getElementById('leadNewPhotoInput')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    pendingNewLeadPhoto = await fileToBase64(file, 500, 0.75);
    document.getElementById('leadNewAvatarPreview').innerHTML = `<img src="${pendingNewLeadPhoto}" alt="preview">`;
  });

  // Save (per card): name, role, tier, photo
  document.querySelectorAll('[data-leadsave]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.leadsave;
      const dbNow = loadDB();
      const person = dbNow.leadership.find(p => p.id === id);
      if (!person) return;
      const nameInput = document.querySelector(`.leadNameInput[data-id="${id}"]`);
      const roleInput = document.querySelector(`.leadRoleInput[data-id="${id}"]`);
      const tierInput = document.querySelector(`.leadTierInput[data-id="${id}"]`);
      const newName = nameInput.value.trim();
      const newRole = roleInput.value.trim();
      if (!newName || !newRole) { alert('Please enter both a name and a role.'); return; }
      person.name = newName;
      person.role = newRole;
      person.tier = +tierInput.value;
      if (pendingLeadPhotos[id]) person.photo = pendingLeadPhotos[id];
      saveDB(dbNow);
      logAudit('super_admin', dbNow.owner.name, 'Updated leadership card', person.name);
      renderLeadershipPyramid(dbNow);
      renderAdminProfile();
    });
  });

  // Delete (per card)
  document.querySelectorAll('[data-leaddelete]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.leaddelete;
      const dbNow = loadDB();
      const person = dbNow.leadership.find(p => p.id === id);
      if (!confirm(`Remove ${person ? person.name : 'this leader'} from the leadership pyramid?`)) return;
      dbNow.leadership = dbNow.leadership.filter(p => p.id !== id);
      saveDB(dbNow);
      logAudit('super_admin', dbNow.owner.name, 'Removed leadership card', person ? person.name : id);
      renderLeadershipPyramid(dbNow);
      renderAdminProfile();
    });
  });

  // Add new leader
  document.getElementById('leadAddBtn')?.addEventListener('click', () => {
    const name = document.getElementById('leadNewName').value.trim();
    const role = document.getElementById('leadNewRole').value.trim();
    const tier = +document.getElementById('leadNewTier').value;
    if (!name || !role) { alert('Please enter both a name and a role for the new leader.'); return; }
    const dbNow = loadDB();
    dbNow.leadership.push({ id: uid('p'), tier, name, role, photo: pendingNewLeadPhoto || '' });
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Added leadership card', name);
    renderLeadershipPyramid(dbNow);
    renderAdminProfile();
  });
}

/* ---------- Invite tab (placeholder only) ---------- */
function renderAdminInvite() {
  const db = loadDB();
  const portalRoles = ['bishop', 'protocol', 'disciple1', 'disciple2', 'disciple3'];
  const issued = db.passcodes.filter(p => portalRoles.includes(p.role));

  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">🔑</span> Invite a Portal Leader</h3>
      <p class="muted" style="margin-bottom:18px;">Enter the leader's details, choose their portal, then generate a passcode for them to log in with.</p>
      <div class="form-row">
        <div class="form-field"><label>Full Name</label><input type="text" id="inviteName" placeholder="Full name"></div>
        <div class="form-field"><label>Phone</label><input type="text" id="invitePhone" placeholder="07XX XXX XXX"></div>
      </div>
      <div class="form-row">
        <div class="form-field"><label>Email</label><input type="text" id="inviteEmail" placeholder="name@email.com"></div>
        <div class="form-field">
          <label>Portal</label>
          <select id="invitePortal">
            <option value="bishop">Bishop</option>
            <option value="protocol">Protocol</option>
            <option value="disciple1">Disciple Class 1</option>
            <option value="disciple2">Disciple Class 2</option>
            <option value="disciple3">Disciple Class 3</option>
          </select>
        </div>
      </div>
      <button type="button" class="icon-btn gold" id="inviteGenerateBtn"><span class="ic">🔑</span> Generate Passcode</button>
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📋</span> Issued Passcodes</h3>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Portal</th><th>Leader</th><th>Passcode</th><th>Issued</th><th>Actions</th></tr></thead>
          <tbody>
            ${issued.length ? issued.map(p => `
              <tr>
                <td>${PORTAL_DEFS[p.role]?.label || p.role}</td>
                <td>${p.label}</td>
                <td style="font-family:monospace; color:var(--gold); font-weight:700;">${p.revoked ? 'REVOKED' : p.code}</td>
                <td>${new Date(p.generatedAt).toLocaleDateString()}</td>
                <td class="table-actions">
                  ${!p.revoked ? `<button type="button" class="mini-del" data-revokepass="${p.id}" title="Revoke">✕</button>` : ''}
                </td>
              </tr>
            `).join('') : `<tr><td colspan="5" class="muted" style="text-align:center; padding:24px;">No passcodes issued yet</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('inviteGenerateBtn').addEventListener('click', () => {
    const name = document.getElementById('inviteName').value.trim();
    const phone = document.getElementById('invitePhone').value.trim();
    const email = document.getElementById('inviteEmail').value.trim();
    const portal = document.getElementById('invitePortal').value;
    if (!name || !phone) { alert("Please enter the leader's full name and phone number."); return; }
    const prefix = PORTAL_PASSCODE_PREFIX[portal];
    const rand = Math.floor(1000 + Math.random() * 9000);
    const code = `${prefix}-2026-${rand}`;
    const dbNow = loadDB();
    dbNow.passcodes.push({
      id: uid('pc'), role: portal, label: name, code,
      generatedBy: dbNow.owner.name, generatedAt: new Date().toISOString(), revoked: false
    });
    dbNow.portalProfiles[portal].name = name;
    dbNow.portalProfiles[portal].phone = phone;
    dbNow.portalProfiles[portal].email = email;
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Generated portal passcode', `${PORTAL_DEFS[portal].label} — ${name}`);
    alert(`Passcode generated: ${code}\n\nShare this with ${name} to access the ${PORTAL_DEFS[portal].label} portal.`);
    renderAdminInvite();
  });

  document.querySelectorAll('[data-revokepass]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      const rec = dbNow.passcodes.find(p => p.id === btn.dataset.revokepass);
      if (rec && confirm(`Revoke passcode for ${rec.label}?`)) {
        rec.revoked = true;
        saveDB(dbNow);
        logAudit('super_admin', dbNow.owner.name, 'Revoked portal passcode', rec.label);
        renderAdminInvite();
      }
    });
  });
}

/* ---------- Received tab: New contact messages, Store, Internal messages ---------- */
function renderAdminReceived() {
  const db = loadDB();
  const newMsgs = db.contactSubmissions.filter(c => c.status === 'new');
  const storedMsgs = db.contactSubmissions.filter(c => c.status === 'stored');
  const internalMsgs = db.messages.filter(m => m.toRole === 'super_admin');

  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title">
        <span class="ic">🔔</span> New Messages
        ${newMsgs.length ? `<span class="badge-count inline">${newMsgs.length} new</span>` : ''}
      </h3>
      ${newMsgs.length ? newMsgs.map(m => `
        <div class="cms-list-item">
          <div>
            <strong>${m.name}</strong> <span class="muted small">· ${m.email || 'no email'} · ${new Date(m.at).toLocaleString()}</span>
            <div class="muted small">${m.message.length > 90 ? m.message.slice(0, 90) + '…' : m.message}</div>
          </div>
          <button type="button" class="icon-btn small" data-review="${m.id}"><span class="ic">👁</span> Review</button>
        </div>
      `).join('') : '<p class="muted">No new messages.</p>'}
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">🗄</span> Store — Contact Messages</h3>
      ${storedMsgs.length ? storedMsgs.map(m => `
        <div class="cms-list-item">
          <div>
            <strong>${m.name}</strong> <span class="muted small">· ${m.email || 'no email'} · saved ${new Date(m.storedAt).toLocaleString()}</span>
            <div class="muted small">${m.message.length > 90 ? m.message.slice(0, 90) + '…' : m.message}</div>
          </div>
          <div class="table-actions">
            <button type="button" class="mini-del" data-delcontact="${m.id}" title="Delete">✕</button>
            <button type="button" class="icon-btn small" data-regen="${m.id}"><span class="ic">↺</span> Regenerate</button>
            <button type="button" class="icon-btn small gold" data-download="${m.id}"><span class="ic">💾</span> Save</button>
          </div>
        </div>
      `).join('') : '<p class="muted">No stored messages yet.</p>'}
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📥</span> Internal Messages</h3>
      ${internalMsgs.length ? internalMsgs.map(m => `
        <div class="cms-list-item">
          <div>
            <strong>${m.subject || '(no subject)'}</strong>
            <div class="muted small">From ${m.fromRole} · ${new Date(m.at).toLocaleString()}</div>
            <div>${m.body}</div>
          </div>
        </div>
      `).join('') : '<p class="muted">No internal messages yet.</p>'}
    </div>
  `;

  document.querySelectorAll('[data-review]').forEach(btn => {
    btn.addEventListener('click', () => openMessageReview(btn.dataset.review));
  });
  document.querySelectorAll('[data-delcontact]').forEach(btn => {
    btn.addEventListener('click', () => openDeleteReason(btn.dataset.delcontact));
  });
  document.querySelectorAll('[data-regen]').forEach(btn => {
    btn.addEventListener('click', () => regenerateContactMessage(btn.dataset.regen));
  });
  document.querySelectorAll('[data-download]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      const msg = dbNow.contactSubmissions.find(c => c.id === btn.dataset.download);
      if (msg) downloadContactMessage(msg);
    });
  });
}

/* ---- Review popup: view full message, Save moves it from New → Store ---- */
let reviewingMessageId = null;

function openMessageReview(id) {
  const db = loadDB();
  const msg = db.contactSubmissions.find(c => c.id === id);
  if (!msg) return;
  reviewingMessageId = id;
  document.getElementById('reviewName').textContent = msg.name;
  document.getElementById('reviewEmail').textContent = msg.email || '—';
  document.getElementById('reviewDate').textContent = new Date(msg.at).toLocaleString();
  document.getElementById('reviewBody').textContent = msg.message;
  document.getElementById('messageReviewOverlay').classList.add('active');
}

function closeMessageReview() {
  document.getElementById('messageReviewOverlay').classList.remove('active');
  reviewingMessageId = null;
}

function saveReviewedMessage() {
  if (!reviewingMessageId) return;
  const db = loadDB();
  const msg = db.contactSubmissions.find(c => c.id === reviewingMessageId);
  if (msg) {
    msg.status = 'stored';
    msg.storedAt = new Date().toISOString();
    saveDB(db);
    logAudit('super_admin', db.owner.name, 'Reviewed & stored contact message', msg.name);
  }
  closeMessageReview();
  const dbNow = loadDB();
  renderAdminReceived();
  renderAdminSidebar();
  updateHeaderBellBadge(dbNow);
}

/* ---- Delete with required reason ----
   Generalized to serve two flows:
   1. Contact messages: permanent delete.
   2. Katoloni Wall records: a leader's "Revoke" sends a record here
      for the admin to decide — Regenerate (restore to active) or
      Permanently Delete — either way a reason is required. */
let deleteReasonContext = null; // { type: 'contact' | 'graduate-regenerate' | 'graduate-delete', id }

function openDeleteReason(id) {
  deleteReasonContext = { type: 'contact', id };
  document.getElementById('deleteReasonText').value = '';
  document.getElementById('deleteReasonTitle').innerHTML = `<span class="ic">🗑</span> Delete Message`;
  document.getElementById('deleteReasonPromptText').textContent = 'Please give a reason for deleting this message.';
  document.getElementById('deleteReasonConfirmIcon').textContent = '🗑';
  document.getElementById('deleteReasonConfirmLabel').textContent = 'Delete';
  document.getElementById('deleteReasonOverlay').classList.add('active');
}

function openGraduateDecision(id, action) {
  deleteReasonContext = { type: action === 'regenerate' ? 'graduate-regenerate' : 'graduate-delete', id };
  document.getElementById('deleteReasonText').value = '';
  document.getElementById('deleteReasonTitle').innerHTML = action === 'regenerate'
    ? `<span class="ic">↺</span> Regenerate Wall Record`
    : `<span class="ic">🗑</span> Permanently Delete Wall Record`;
  document.getElementById('deleteReasonPromptText').textContent = action === 'regenerate'
    ? 'Please give a reason for regenerating this record.'
    : 'Please give a reason for permanently deleting this record.';
  document.getElementById('deleteReasonConfirmIcon').textContent = action === 'regenerate' ? '↺' : '🗑';
  document.getElementById('deleteReasonConfirmLabel').textContent = action === 'regenerate' ? 'Regenerate' : 'Delete';
  document.getElementById('deleteReasonOverlay').classList.add('active');
}

/* NEW */
function openComplaintResolve(id, resolverRole, resolverLabel, refreshFn) {
  deleteReasonContext = { type: 'complaint-resolve', id, resolverRole, resolverLabel, refresh: refreshFn };
  document.getElementById('deleteReasonText').value = '';
  document.getElementById('deleteReasonTitle').innerHTML = `<span class="ic">✅</span> Resolve Complaint`;
  document.getElementById('deleteReasonPromptText').textContent = 'Add a resolution note (optional).';
  document.getElementById('deleteReasonConfirmIcon').textContent = '✅';
  document.getElementById('deleteReasonConfirmLabel').textContent = 'Resolve';
  document.getElementById('deleteReasonOverlay').classList.add('active');
}

function closeDeleteReason() {
  document.getElementById('deleteReasonOverlay').classList.remove('active');
  deleteReasonContext = null;
}

function confirmDeleteReasonAction() {
  if (!deleteReasonContext) return;
  const reason = document.getElementById('deleteReasonText').value.trim();
  const db = loadDB();

  if (deleteReasonContext.type === 'contact') {
    const msg = db.contactSubmissions.find(c => c.id === deleteReasonContext.id);
    db.contactSubmissions = db.contactSubmissions.filter(c => c.id !== deleteReasonContext.id);
    saveDB(db);
    logAudit('super_admin', db.owner.name, 'Deleted contact message', `${msg ? msg.name : ''} — reason: ${reason || '(none given)'}`);
    closeDeleteReason();
    renderAdminReceived();
    renderAdminSidebar();
    updateHeaderBellBadge(loadDB());

  } else if (deleteReasonContext.type === 'graduate-regenerate') {
    const g = db.graduates.find(x => x.id === deleteReasonContext.id);
    if (g) { g.status = 'active'; g.revokeReason = null; }
    saveDB(db);
    logAudit('super_admin', db.owner.name, 'Regenerated wall record', `${g ? g.name : ''} — reason: ${reason || '(none given)'}`);
    closeDeleteReason();
    renderAdminWall();

  } else if (deleteReasonContext.type === 'graduate-delete') {
    const g = db.graduates.find(x => x.id === deleteReasonContext.id);
    db.graduates = db.graduates.filter(x => x.id !== deleteReasonContext.id);
    saveDB(db);
    logAudit('super_admin', db.owner.name, 'Permanently deleted wall record', `${g ? g.name : ''} — reason: ${reason || '(none given)'}`);
    closeDeleteReason();
    renderAdminWall();

  } else if (deleteReasonContext.type === 'complaint-resolve') {  /* NEW */
    const c = db.complaints.find(x => x.id === deleteReasonContext.id);
    if (c) {
      c.status = 'resolved';
      c.resolutionNote = reason || null;
      c.resolvedAt = new Date().toISOString();
      c.resolvedBy = deleteReasonContext.resolverLabel || 'Admin';
    }
    saveDB(db);
    logAudit(deleteReasonContext.resolverRole || 'super_admin', deleteReasonContext.resolverLabel || 'Admin', 'Resolved complaint', c ? c.title : '');
    const refreshFn = deleteReasonContext.refresh;
    closeDeleteReason();
    if (typeof refreshFn === 'function') refreshFn();
    if (activePortalKey === 'admin') renderAdminSidebar(); else renderMemberSidebar();
    updateHeaderBellBadge(loadDB());
  }
}

/* ---- Regenerate: send a stored message back to New ---- */
function regenerateContactMessage(id) {
  const db = loadDB();
  const msg = db.contactSubmissions.find(c => c.id === id);
  if (msg) {
    msg.status = 'new';
    delete msg.storedAt;
    saveDB(db);
    logAudit('super_admin', db.owner.name, 'Regenerated contact message to new', msg.name);
  }
  renderAdminReceived();
  renderAdminSidebar();
  updateHeaderBellBadge(loadDB());
}

/* ---- Save (download) a stored message to the admin's own computer ---- */
function downloadContactMessage(msg) {
  const content = `Contact Message\n\nName: ${msg.name}\nEmail: ${msg.email || '—'}\nDate: ${new Date(msg.at).toLocaleString()}\nStored: ${msg.storedAt ? new Date(msg.storedAt).toLocaleString() : '—'}\n\nMessage:\n${msg.message}\n`;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `contact-message-${msg.id}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Send tab ---------- */
function renderAdminSend() {
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📤</span> Send</h3>
      <div class="form-field">
        <label>To</label>
        <select id="sendToRole">
          <option value="bishop">Bishop</option>
          <option value="protocol">Protocol</option>
          <option value="disciple1">Disciple Class 1</option>
          <option value="disciple2">Disciple Class 2</option>
          <option value="disciple3">Disciple Class 3</option>
        </select>
      </div>
      <div class="form-field"><label>Subject</label><input type="text" id="sendSubject" placeholder="Subject"></div>
      <div class="form-field"><label>Message</label><textarea id="sendBody" rows="4" placeholder="Write your message..."></textarea></div>
      <div class="form-field">
        <label>Attach Via</label>
        <div class="attach-grid">
          <label class="attach-btn"><input type="file" id="sendFile" hidden><span class="ic">📄</span> File</label>
          <button type="button" class="attach-btn" id="sendPasteLink"><span class="ic">🔗</span> Paste Link</button>
          <button type="button" class="attach-btn" id="sendNewNote"><span class="ic">📝</span> New Note</button>
        </div>
        <div class="muted small" id="sendAttachPreview"></div>
      </div>
      <button type="button" class="icon-btn gold" id="sendBtn"><span class="ic">📤</span> Send Message</button>
    </div>
  `;
  let attachment = '';
  document.getElementById('sendFile').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) { attachment = f.name; document.getElementById('sendAttachPreview').textContent = `📎 ${attachment}`; }
  });
  document.getElementById('sendPasteLink').addEventListener('click', () => {
    const link = prompt('Paste a link:');
    if (link) { attachment = link; document.getElementById('sendAttachPreview').textContent = `🔗 ${attachment}`; }
  });
  document.getElementById('sendNewNote').addEventListener('click', () => {
    const note = prompt('Write a quick note:');
    if (note) { attachment = note; document.getElementById('sendAttachPreview').textContent = `📝 ${attachment}`; }
  });
  document.getElementById('sendBtn').addEventListener('click', () => {
    const toRole = document.getElementById('sendToRole').value;
    const subject = document.getElementById('sendSubject').value.trim();
    const body = document.getElementById('sendBody').value.trim();
    if (!toRole || !body) { alert('Please select a recipient and write a message.'); return; }
    const dbNow = loadDB();
    dbNow.messages.unshift({ id: uid('msg'), fromRole: 'super_admin', toRole, subject, body, attachment: attachment || null, at: new Date().toISOString(), readAt: null });
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Sent message', toRole);
    alert('Message sent.');
    renderAdminSend();
  });
}

/* ---------- Tour CMS ---------- */
function tourGroupPanelHTML(db, key) {
  const meta = TOUR_GROUP_META[key];
  const items = db.tour.groups[key] || [];
  return `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">${meta.icon}</span> ${meta.label}</h3>
      <div class="cms-image-grid">
        ${items.map(it => `
          <div class="cms-image-slot">
            <div class="cms-image-preview group-slot-preview">
              ${it.image ? `<img src="${it.image}">` : `<span>${it.name}</span>`}
              <button type="button" class="mini-del thumb-del-abs" data-delgroupitem="${key}|${it.id}">✕</button>
            </div>
            <div class="cms-slot-label">${it.name}</div>
            <label class="file-btn small">
              <input type="file" class="groupItemImgInput" data-group="${key}" data-id="${it.id}" accept="image/*" hidden>
              Choose File
            </label>
          </div>
        `).join('') || '<p class="muted">No photos added yet.</p>'}
      </div>
      <div class="cms-add-row">
        <input type="text" class="groupNewName" data-group="${key}" placeholder="New slot name (e.g. Secretary's Office)">
        <button type="button" class="icon-btn small" data-addgroupslot="${key}">+ Add Slot</button>
      </div>
    </div>
  `;
}

function renderAdminTour() {
  const db = loadDB();
  const t = db.tour;

  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">🗺</span> Tour — Story</h3>
      <div class="form-field">
        <label>History / Story</label>
        <textarea id="tourHistory" rows="4">${t.history}</textarea>
      </div>
      <button type="button" class="icon-btn gold" id="tourHistorySaveBtn"><span class="ic">💾</span> Save Story</button>
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📷</span> Grounds — Single Photos</h3>
      <div class="cms-image-grid">
        ${TOUR_SINGLES.map(v => `
          <div class="cms-image-slot">
            <div class="cms-image-preview" id="tourPreview-${v.key}">
              ${t.singles[v.key] ? `<img src="${t.singles[v.key]}">` : `<span>${v.label}</span>`}
            </div>
            <div class="cms-slot-label">${v.label}</div>
            <label class="file-btn small">
              <input type="file" data-single="${v.key}" class="tourSingleInput" accept="image/*" hidden>
              Choose File
            </label>
          </div>
        `).join('')}
      </div>
    </div>

    ${TOUR_GROUP_ORDER.map(key => tourGroupPanelHTML(db, key)).join('')}
  `;

  document.getElementById('tourHistorySaveBtn').addEventListener('click', () => {
    const dbNow = loadDB();
    dbNow.tour.history = document.getElementById('tourHistory').value.trim();
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Updated Tour story');
    alert('Story saved.');
  });

  document.querySelectorAll('.tourSingleInput').forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const key = inp.dataset.single;
      const b64 = await fileToBase64(file);
      const dbNow = loadDB();
      dbNow.tour.singles[key] = b64;
      saveDB(dbNow);
      logAudit('super_admin', dbNow.owner.name, 'Updated tour photo', key);
      renderAdminTour();
    });
  });

  document.querySelectorAll('.groupItemImgInput').forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const group = inp.dataset.group, id = inp.dataset.id;
      const b64 = await fileToBase64(file);
      const dbNow = loadDB();
      const item = (dbNow.tour.groups[group] || []).find(x => x.id === id);
      if (item) item.image = b64;
      saveDB(dbNow);
      logAudit('super_admin', dbNow.owner.name, 'Updated tour photo', `${group} — ${item ? item.name : ''}`);
      renderAdminTour();
    });
  });

  document.querySelectorAll('[data-addgroupslot]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.addgroupslot;
      const nameInput = document.querySelector(`.groupNewName[data-group="${group}"]`);
      const name = (nameInput?.value || '').trim();
      if (!name) { alert('Please enter a name for the new slot.'); return; }
      const dbNow = loadDB();
      if (!dbNow.tour.groups[group]) dbNow.tour.groups[group] = [];
      dbNow.tour.groups[group].push({ id: uid('tg'), name, image: '' });
      saveDB(dbNow);
      logAudit('super_admin', dbNow.owner.name, 'Added tour slot', `${group} — ${name}`);
      renderAdminTour();
    });
  });

  document.querySelectorAll('[data-delgroupitem]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [group, id] = btn.dataset.delgroupitem.split('|');
      const dbNow = loadDB();
      dbNow.tour.groups[group] = (dbNow.tour.groups[group] || []).filter(it => it.id !== id);
      saveDB(dbNow);
      logAudit('super_admin', dbNow.owner.name, 'Removed tour slot', group);
      renderAdminTour();
    });
  });
}

/* ---------- Project CMS ---------- */
function renderAdminProject() {
  const db = loadDB();
  const p = db.project;
  const stages = ['past', 'present', 'upcoming'];
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">🏗</span> Project — Manage Content</h3>
      <div class="form-field">
        <label>History / Story</label>
        <textarea id="projHistory" rows="4">${p.history}</textarea>
      </div>
      ${stages.map(s => `
        <div class="cms-subpanel">
          <h4>${s[0].toUpperCase() + s.slice(1)}</h4>
          <div class="form-field">
            <label>Caption</label>
            <input type="text" id="projCaption-${s}" value="${p[s].caption}">
          </div>
          <div class="cms-media-row" id="projMedia-${s}">
            ${p[s].media.map((m, i) => `<div class="cms-media-thumb"><img src="${m}"><button type="button" class="thumb-del" data-stage="${s}" data-idx="${i}">✕</button></div>`).join('')}
          </div>
          <label class="file-btn small">
            <input type="file" class="projImgInput" data-stage="${s}" accept="image/*" hidden>
            Add Photo
          </label>
        </div>
      `).join('')}
      <button type="button" class="icon-btn gold" id="projSaveBtn"><span class="ic">💾</span> Save Project</button>
    </div>
  `;

  document.querySelectorAll('.projImgInput').forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const stage = inp.dataset.stage;
      const b64 = await fileToBase64(file);
      const dbNow = loadDB();
      dbNow.project[stage].media.push(b64);
      saveDB(dbNow);
      renderAdminProject();
    });
  });

  document.querySelectorAll('.thumb-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const stage = btn.dataset.stage, idx = +btn.dataset.idx;
      const dbNow = loadDB();
      dbNow.project[stage].media.splice(idx, 1);
      saveDB(dbNow);
      renderAdminProject();
    });
  });

  document.getElementById('projSaveBtn').addEventListener('click', () => {
    const dbNow = loadDB();
    dbNow.project.history = document.getElementById('projHistory').value.trim();
    stages.forEach(s => {
      dbNow.project[s].caption = document.getElementById(`projCaption-${s}`).value.trim();
    });
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Updated Project content');
    alert('Project content saved.');
    renderAdminProject();
  });
}

/* ---------- Notice Board CMS ---------- */
function renderAdminNotices() {
  const db = loadDB();
  const nb = db.noticeboard;
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📢</span> Notice Board — Manage Content</h3>
      <div class="form-field"><label>Theme</label><input type="text" id="nbTheme" value="${nb.theme}"></div>
      <div class="form-field"><label>Verse Reference</label><input type="text" id="nbVerseRef" value="${nb.verseRef}"></div>
      <div class="form-field"><label>Verse Text</label><textarea id="nbVerseText" rows="2">${nb.verseText}</textarea></div>
      <div class="form-field"><label>Mission</label><textarea id="nbMission" rows="3">${nb.mission}</textarea></div>
      <div class="form-field"><label>Vision</label><textarea id="nbVision" rows="3">${nb.vision}</textarea></div>
      <div class="form-field">
        <label>Objectives</label>
        <div id="nbObjectivesList">
          ${nb.objectives.map((o, i) => `
            <div class="cms-list-row">
              <input type="text" class="nbObjInput" data-idx="${i}" value="${o}">
              <button type="button" class="mini-del" data-objidx="${i}">✕</button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="icon-btn small" id="nbAddObjective">+ Add Objective</button>
      </div>
      <div class="form-field"><label>Values</label><textarea id="nbValues" rows="2">${nb.values}</textarea></div>
      <div class="form-field"><label>Tagline</label><input type="text" id="nbTagline" value="${nb.tagline}"></div>
      <button type="button" class="icon-btn gold" id="nbSaveBtn"><span class="ic">💾</span> Save Notice Board</button>
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📌</span> Announcements</h3>
      <div class="cms-list">
        ${nb.posts.map(post => `
          <div class="cms-list-item">
            <div>
              <div class="muted small">${post.postedBy.toUpperCase()} · ${new Date(post.at).toLocaleDateString()} · ${post.urgency}</div>
              <div>${post.text}</div>
            </div>
            <button type="button" class="mini-del" data-post="${post.id}">✕</button>
          </div>
        `).join('') || '<p class="muted">No announcements yet.</p>'}
      </div>
      <div class="cms-add-row">
        <select id="nbNewUrgency">
          <option value="normal">Normal</option>
          <option value="important">Important</option>
        </select>
        <input type="text" id="nbNewText" placeholder="New announcement text...">
        <button type="button" class="icon-btn small" id="nbAddPost">+ Post</button>
      </div>
    </div>
  `;

  document.getElementById('nbAddObjective').addEventListener('click', () => {
    const dbNow = loadDB();
    dbNow.noticeboard.objectives.push('New objective');
    saveDB(dbNow);
    renderAdminNotices();
  });
  document.querySelectorAll('[data-objidx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      dbNow.noticeboard.objectives.splice(+btn.dataset.objidx, 1);
      saveDB(dbNow);
      renderAdminNotices();
    });
  });

  document.getElementById('nbAddPost').addEventListener('click', () => {
    const text = document.getElementById('nbNewText').value.trim();
    if (!text) return;
    const urgency = document.getElementById('nbNewUrgency').value;
    const dbNow = loadDB();
    dbNow.noticeboard.posts.unshift({ id: uid('n'), scope: 'global', postedBy: 'Admin', urgency, text, at: new Date().toISOString() });
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Posted announcement');
    renderAdminNotices();
  });

  document.querySelectorAll('[data-post]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      dbNow.noticeboard.posts = dbNow.noticeboard.posts.filter(p => p.id !== btn.dataset.post);
      saveDB(dbNow);
      renderAdminNotices();
    });
  });

  document.getElementById('nbSaveBtn').addEventListener('click', () => {
    const dbNow = loadDB();
    const nbNow = dbNow.noticeboard;
    nbNow.theme = document.getElementById('nbTheme').value.trim();
    nbNow.verseRef = document.getElementById('nbVerseRef').value.trim();
    nbNow.verseText = document.getElementById('nbVerseText').value.trim();
    nbNow.mission = document.getElementById('nbMission').value.trim();
    nbNow.vision = document.getElementById('nbVision').value.trim();
    nbNow.values = document.getElementById('nbValues').value.trim();
    nbNow.tagline = document.getElementById('nbTagline').value.trim();
    document.querySelectorAll('.nbObjInput').forEach(inp => {
      nbNow.objectives[+inp.dataset.idx] = inp.value.trim();
    });
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Updated Notice Board content');
    alert('Notice Board saved.');
    renderAdminNotices();
  });
}

/* ---------- Katoloni Wall CMS (graduates) ----------
   Admin adds records with a photo into one of the 4 categories.
   Active records show a Revoke button; revoked records show
   Regenerate / Permanent Delete (both require a reason via the
   shared delete-reason modal). Search filters by name/month/year. */
let wallSearchQuery = { name: '', month: '', year: '' };

function renderAdminWall() {
  const db = loadDB();
  // Available graduation / general documents for pipeline pick
  const pipelineDocs = (db.memberDocuments || []).filter(d =>
    d.toRole === 'super_admin' &&
    (d.stage === 'class1' || d.stage === 'class2' || d.stage === 'class3' || d.stage === 'general')
  ).sort((a, b) => new Date(b.at) - new Date(a.at));

  const fromDocId = window._wallFromDocId || '';
  const fromDoc = fromDocId ? pipelineDocs.find(d => d.id === fromDocId) : null;
  const nameOptions = fromDoc
    ? (fromDoc.members || []).map(m => `<option value="${m.name}">${m.name}</option>`).join('')
    : '';

  // Pre-select category from stage
  const stageToCat = { class1: 'class1', class2: 'class2', class3: 'class3', general: 'general' };
  const preCat = fromDoc ? (stageToCat[fromDoc.stage] || 'class1') : 'class1';

  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">➕</span> Add to Katoloni Wall</h3>
      ${pipelineDocs.length ? `
        <div class="form-field" style="margin-bottom:16px;">
          <label>From pipeline list (optional)</label>
          <select id="wallFromDoc">
            <option value="">— Manual entry —</option>
            ${pipelineDocs.map(d => `<option value="${d.id}" ${d.id === fromDocId ? 'selected' : ''}>${d.title} (${d.members?.length || 0})</option>`).join('')}
          </select>
        </div>
      ` : ''}
      <div class="lead-mgmt-card" style="background:var(--bg-panel-3);">
        <div class="lead-mgmt-photo">
          <div class="lead-mgmt-avatar" id="wallNewAvatarPreview"><span>+</span></div>
          <label class="file-btn small"><input type="file" id="wallNewPhoto" accept="image/*" hidden>Upload Photo</label>
        </div>
        <div class="lead-mgmt-fields">
          <div class="form-field">
            <label>Full Name</label>
            ${fromDoc ? `
              <select id="wallNewNameSelect">
                <option value="">— Select name from list —</option>
                ${nameOptions}
              </select>
              <input type="hidden" id="wallNewName" value="">
            ` : `<input type="text" id="wallNewName" placeholder="Full name">`}
          </div>
          <div class="form-field">
            <label>Category</label>
            <select id="wallNewCategory">
              ${Object.entries(WALL_CATEGORY_META).map(([k, m]) => `<option value="${k}" ${k === preCat ? 'selected' : ''}>${m.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label>Month</label>
            <select id="wallNewMonth">${WALL_MONTHS.map(m => `<option value="${m}">${m}</option>`).join('')}</select>
          </div>
          <div class="form-field"><label>Year</label><input type="number" id="wallNewYear" value="${new Date().getFullYear()}"></div>
        </div>
        <div class="lead-mgmt-actions">
          <button type="button" class="icon-btn gold small" id="wallAddBtn"><span class="ic">➕</span> Add Record</button>
        </div>
      </div>
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">🔍</span> Search &amp; Filter</h3>
      <div class="cms-add-row">
        <input type="text" id="wallSearchName" placeholder="Search by name..." value="${wallSearchQuery.name}">
        <select id="wallSearchMonth">
          <option value="">All Months</option>
          ${WALL_MONTHS.map(m => `<option value="${m}" ${wallSearchQuery.month === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <input type="number" id="wallSearchYear" placeholder="Year" value="${wallSearchQuery.year}">
      </div>
    </div>

    ${WALL_CATEGORY_ORDER.map(cat => wallCategoryPanelHTML(db, cat)).join('')}
  `;

  // Clear one-shot from-doc flag after first paint (keep selection via select)
  if (window._wallFromDocId) {
    // keep it so re-render of same session still works; clear only when user changes doc
  }

  document.getElementById('wallFromDoc')?.addEventListener('change', () => {
    window._wallFromDocId = document.getElementById('wallFromDoc').value || '';
    renderAdminWall();
  });

  document.getElementById('wallNewNameSelect')?.addEventListener('change', () => {
    const sel = document.getElementById('wallNewNameSelect');
    document.getElementById('wallNewName').value = sel.value;
  });

  document.getElementById('wallNewPhoto').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await fileToBase64(file, 500, 0.75);
    const preview = document.getElementById('wallNewAvatarPreview');
    preview.innerHTML = `<img src="${b64}">`;
    preview.dataset.photo = b64;
  });

  document.getElementById('wallAddBtn').addEventListener('click', () => {
    let name = '';
    if (document.getElementById('wallNewNameSelect')) {
      name = document.getElementById('wallNewNameSelect').value.trim();
    } else {
      name = document.getElementById('wallNewName').value.trim();
    }
    const category = document.getElementById('wallNewCategory').value;
    const month = document.getElementById('wallNewMonth').value;
    const year = +document.getElementById('wallNewYear').value;
    const photo = document.getElementById('wallNewAvatarPreview').dataset.photo || '';
    if (!name) { alert('Please enter or select a name.'); return; }
    const dbNow = loadDB();
    dbNow.graduates.push({ id: uid('g'), name, photo, category, month, year, status: 'active', revokeReason: null, at: new Date().toISOString() });
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Added wall record', `${name} — ${WALL_CATEGORY_META[category].label}`);
    // Keep the same from-doc so admin can add next name from the list
    renderAdminWall();
  });

  ['wallSearchName', 'wallSearchMonth', 'wallSearchYear'].forEach(id => {
    const handler = () => {
      wallSearchQuery.name = document.getElementById('wallSearchName').value.trim().toLowerCase();
      wallSearchQuery.month = document.getElementById('wallSearchMonth').value;
      wallSearchQuery.year = document.getElementById('wallSearchYear').value;
      renderAdminWall();
    };
    document.getElementById(id).addEventListener('input', handler);
    document.getElementById(id).addEventListener('change', handler);
  });

  document.querySelectorAll('[data-wallcert]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      const g = dbNow.graduates.find(x => x.id === btn.dataset.wallcert);
      if (!g) return;
      downloadCertificatePDF(buildCertData({
        name: g.name,
        classKey: g.category,
        month: g.month,
        year: g.year,
        photo: g.photo
      }));
    });
  });
  document.querySelectorAll('[data-wallrevoke]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      const g = dbNow.graduates.find(x => x.id === btn.dataset.wallrevoke);
      if (g) g.status = 'revoked';
      saveDB(dbNow);
      logAudit('super_admin', dbNow.owner.name, 'Revoked wall record', g ? g.name : '');
      renderAdminWall();
    });
  });
  document.querySelectorAll('[data-wallregenerate]').forEach(btn => {
    btn.addEventListener('click', () => openGraduateDecision(btn.dataset.wallregenerate, 'regenerate'));
  });
  document.querySelectorAll('[data-walldelete]').forEach(btn => {
    btn.addEventListener('click', () => openGraduateDecision(btn.dataset.walldelete, 'delete'));
  });
}

function wallCategoryPanelHTML(db, cat) {
  const meta = WALL_CATEGORY_META[cat];
  let items = db.graduates.filter(g => g.category === cat);
  if (wallSearchQuery.name) items = items.filter(g => g.name.toLowerCase().includes(wallSearchQuery.name));
  if (wallSearchQuery.month) items = items.filter(g => g.month === wallSearchQuery.month);
  if (wallSearchQuery.year) items = items.filter(g => String(g.year) === String(wallSearchQuery.year));

  return `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">${meta.icon}</span> ${meta.label}</h3>
      <div class="cms-list">
        ${items.length ? items.map(g => `
          <div class="cms-list-item">
            <div style="display:flex; gap:12px; align-items:center;">
              <div class="lead-mgmt-avatar" style="width:44px; height:44px;">
                ${g.photo ? `<img src="${g.photo}">` : `<span>${(g.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('')}</span>`}
              </div>
              <div>
                <strong>${g.name}</strong>
                <span class="status-badge status-${g.status === 'revoked' ? 'pending' : 'checked-in'}">${g.status}</span>
                <div class="muted small">${g.month} ${g.year}</div>
              </div>
            </div>
            <div class="table-actions">
              <button type="button" class="icon-btn small gold" data-wallcert="${g.id}" title="Certificate PDF"><span class="ic">📜</span> Certificate</button>
              ${g.status === 'active'
                ? `<button type="button" class="icon-btn small" data-wallrevoke="${g.id}"><span class="ic">🚩</span> Revoke</button>`
                : `<button type="button" class="icon-btn small" data-wallregenerate="${g.id}"><span class="ic">↺</span> Regenerate</button>
                   <button type="button" class="icon-btn small" style="background:rgba(232,96,122,.15); color:#e8607a; border-color:transparent;" data-walldelete="${g.id}"><span class="ic">🗑</span> Permanent Delete</button>`
              }
            </div>
          </div>
        `).join('') : '<p class="muted">No records in this category yet.</p>'}
      </div>
    </div>
  `;
}

/* ---------- Booking dashboard (stats + Bookings / Room Rates / Item Tracking / Reports) ---------- */
let adminBookingSubTab = 'bookings';
let adminBookingFilter = 'all';

function todayStr() { return new Date().toISOString().slice(0, 10); }

function bookingTotalEarnings(db) {
  const bookingsTotal = db.booking.bookings.reduce((sum, b) => sum + (b.total || 0), 0);
  const chargesTotal = db.booking.itemCharges.reduce((sum, c) => sum + (c.amount || 0), 0);
  return bookingsTotal + chargesTotal;
}

function occupancyRate(db) {
  const rooms = db.booking.rooms.length;
  if (!rooms) return 0;
  const checkedIn = db.booking.bookings.filter(b => b.status === 'checked-in').length;
  return Math.round((checkedIn / rooms) * 100);
}

function adminStatCard(icon, label, value) {
  return `
    <div class="admin-stat-card">
      <div class="stat-icon">${icon}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value}</div>
    </div>
  `;
}

function renderAdminBooking() {
  const db = loadDB();
  const el = document.getElementById('adminContent');
  el.innerHTML = `
    <div class="admin-stats-grid">
      ${adminStatCard('📅', 'Total Bookings', db.booking.bookings.length)}
      ${adminStatCard('✅', "Today's Check-ins", db.booking.bookings.filter(b => b.checkIn === todayStr()).length)}
      ${adminStatCard('💰', 'Total Earnings', `KES ${bookingTotalEarnings(db).toLocaleString()}`)}
      ${adminStatCard('🛏', 'Occupancy Rate', `${occupancyRate(db)}%`)}
    </div>
    <div class="admin-subnav" id="bookingSubnav">
      ${[
        ['bookings', '📋', 'Bookings'],
        ['rates', '🏨', 'Room Rates'],
        ['items', '👕', 'Item Tracking'],
        ['reports', '📊', 'Reports']
      ].map(([key, ic, label]) => `<button type="button" class="admin-subnav-btn ${adminBookingSubTab === key ? 'active' : ''}" data-sub="${key}"><span class="ic">${ic}</span> ${label}</button>`).join('')}
    </div>
    <div id="bookingSubContent"></div>
  `;
  el.querySelectorAll('.admin-subnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      adminBookingSubTab = btn.dataset.sub;
      renderAdminBooking();
    });
  });
  const renderers = {
    bookings: renderAdminBookingsList,
    rates: renderAdminRoomRates,
    items: renderAdminItemTracking,
    reports: renderAdminReports
  };
  (renderers[adminBookingSubTab] || renderAdminBookingsList)();
}

/* ---- Bookings sub-tab ---- */
function bookingNextAction(b) {
  const flow = { pending: 'confirmed', confirmed: 'checked-in', 'checked-in': 'checked-out' };
  const next = flow[b.status];
  if (!next) return '';
  const labels = { confirmed: 'Confirm', 'checked-in': 'Check-in', 'checked-out': 'Check-out' };
  return `<button type="button" class="icon-btn small" data-advance="${b.id}" data-to="${next}">${labels[next]}</button>`;
}

function renderAdminBookingsList() {
  const db = loadDB();
  const filters = ['all', 'pending', 'confirmed', 'checked-in', 'checked-out'];
  const filtered = adminBookingFilter === 'all' ? db.booking.bookings : db.booking.bookings.filter(b => b.status === adminBookingFilter);
  document.getElementById('bookingSubContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📋</span> All Bookings</h3>
      <div class="filter-pills">
        ${filters.map(f => `<button type="button" class="filter-pill ${adminBookingFilter === f ? 'active' : ''}" data-filter="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Guest</th><th>Room</th><th>Check In</th><th>Check Out</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${filtered.length ? filtered.map(b => `
              <tr>
                <td>${b.id.slice(-6)}</td>
                <td>${b.fullName}<br><span class="muted small">${b.phone}</span></td>
                <td>${b.roomName}</td>
                <td>${b.checkIn}</td>
                <td>${b.checkOut}</td>
                <td>KES ${b.total.toLocaleString()}</td>
                <td><span class="status-badge status-${b.status}">${b.status}</span></td>
                <td class="table-actions">
                  ${bookingNextAction(b)}
                  <button type="button" class="mini-del" data-delbooking="${b.id}">✕</button>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="8" class="muted" style="text-align:center; padding:24px;">No bookings found</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      adminBookingFilter = btn.dataset.filter;
      renderAdminBookingsList();
    });
  });
  document.querySelectorAll('[data-advance]').forEach(btn => {
    btn.addEventListener('click', () => advanceBookingStatus(btn.dataset.advance, btn.dataset.to));
  });
  document.querySelectorAll('[data-delbooking]').forEach(btn => {
    btn.addEventListener('click', () => deleteBooking(btn.dataset.delbooking));
  });
}

function advanceBookingStatus(id, to) {
  const db = loadDB();
  const b = db.booking.bookings.find(x => x.id === id);
  if (!b) return;
  b.status = to;
  saveDB(db);
  logAudit('super_admin', db.owner.name, `Booking marked ${to}`, b.fullName);
  renderAdminBookingsList();
  renderAdminSidebar();
  updateHeaderBellBadge(db);
}

function deleteBooking(id) {
  const db = loadDB();
  db.booking.bookings = db.booking.bookings.filter(b => b.id !== id);
  saveDB(db);
  renderAdminBookingsList();
  renderAdminSidebar();
  updateHeaderBellBadge(db);
}

/* ---- Room Rates sub-tab ---- */
function renderAdminRoomRates() {
  const db = loadDB();
  document.getElementById('bookingSubContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">✏️</span> Edit Room Rates</h3>
      <div class="cms-list" id="roomRatesList">
        ${db.booking.rooms.map(r => `
          <div class="cms-list-item">
            <div class="room-rate-edit-row">
              <input type="text" class="roomEditName" data-room="${r.id}" value="${r.name}">
              <input type="number" class="roomEditRate" data-room="${r.id}" value="${r.rate}">
              <input type="number" class="roomEditCap" data-room="${r.id}" value="${r.capacity}">
            </div>
            <button type="button" class="mini-del" data-delroom="${r.id}">✕</button>
          </div>
        `).join('') || '<p class="muted">No room types added yet.</p>'}
      </div>
      <div class="cms-add-row">
        <input type="text" id="roomName" placeholder="Room name">
        <input type="number" id="roomRate" placeholder="Rate/night (KES)">
        <input type="number" id="roomCap" placeholder="Capacity">
        <button type="button" class="icon-btn small" id="roomAddBtn">+ Add Room</button>
      </div>
      <button type="button" class="icon-btn gold" id="roomRatesSaveBtn" style="margin-top:16px;"><span class="ic">💾</span> Save Changes</button>
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📞</span> Payment Settings</h3>
      <div class="form-row">
        <div class="form-field"><label>M-Pesa Number 1</label><input type="text" id="mpesaPrimaryInput" value="${db.booking.mpesaNumbers.primary}"></div>
        <div class="form-field"><label>M-Pesa Number 2</label><input type="text" id="mpesaAltInput" value="${db.booking.mpesaNumbers.alternative}"></div>
      </div>
      <div class="form-field"><label>Bishop's Contact Phone</label><input type="text" id="bishopPhoneInput" value="${db.booking.bishopContact.phone}"></div>
      <button type="button" class="icon-btn gold" id="paymentSettingsSaveBtn"><span class="ic">💾</span> Save Payment Settings</button>
    </div>
  `;

  document.getElementById('roomAddBtn').addEventListener('click', () => {
    const name = document.getElementById('roomName').value.trim();
    const rate = +document.getElementById('roomRate').value;
    const capacity = +document.getElementById('roomCap').value || 1;
    if (!name || !rate) { alert('Please enter a room name and rate.'); return; }
    const dbNow = loadDB();
    dbNow.booking.rooms.push({ id: uid('room'), name, rate, capacity });
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Added room type', name);
    renderAdminRoomRates();
  });

  document.querySelectorAll('[data-delroom]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      dbNow.booking.rooms = dbNow.booking.rooms.filter(r => r.id !== btn.dataset.delroom);
      saveDB(dbNow);
      renderAdminRoomRates();
    });
  });

  document.getElementById('roomRatesSaveBtn').addEventListener('click', () => {
    const dbNow = loadDB();
    document.querySelectorAll('.roomEditName').forEach(inp => {
      const room = dbNow.booking.rooms.find(r => r.id === inp.dataset.room);
      if (room) room.name = inp.value.trim();
    });
    document.querySelectorAll('.roomEditRate').forEach(inp => {
      const room = dbNow.booking.rooms.find(r => r.id === inp.dataset.room);
      if (room) room.rate = +inp.value;
    });
    document.querySelectorAll('.roomEditCap').forEach(inp => {
      const room = dbNow.booking.rooms.find(r => r.id === inp.dataset.room);
      if (room) room.capacity = +inp.value;
    });
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Updated room rates');
    alert('Room rates saved.');
    renderAdminRoomRates();
  });

  document.getElementById('paymentSettingsSaveBtn').addEventListener('click', () => {
    const dbNow = loadDB();
    dbNow.booking.mpesaNumbers.primary = document.getElementById('mpesaPrimaryInput').value.trim();
    dbNow.booking.mpesaNumbers.alternative = document.getElementById('mpesaAltInput').value.trim();
    dbNow.booking.bishopContact.phone = document.getElementById('bishopPhoneInput').value.trim();
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Updated payment settings');
    alert('Payment settings saved.');
  });
}

/* ---- Item Tracking sub-tab (checked-in guests + lost/damaged charges) ---- */
function renderAdminItemTracking() {
  const db = loadDB();
  const checkedIn = db.booking.bookings.filter(b => b.status === 'checked-in');
  document.getElementById('bookingSubContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📋</span> Item Tracking (Checked-in Guests)</h3>
      ${checkedIn.length ? checkedIn.map(b => `
        <div class="cms-list-item">
          <div><strong>${b.fullName}</strong> <span class="muted small">— ${b.roomName}</span></div>
        </div>
      `).join('') : '<p class="muted">No guests currently checked in.</p>'}
    </div>

    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">⚠️</span> Lost/Damaged Items &amp; Charges</h3>
      <div class="cms-list">
        ${db.booking.itemCharges.map(c => `
          <div class="cms-list-item">
            <div>
              <strong>${c.itemName}</strong> <span class="muted small">— ${c.guestName} · ${c.type} · KES ${c.amount} · ${new Date(c.at).toLocaleDateString()}</span>
            </div>
            <button type="button" class="mini-del" data-delcharge="${c.id}">✕</button>
          </div>
        `).join('') || '<p class="muted">No charges logged yet.</p>'}
      </div>
      <div class="cms-add-row">
        <select id="chargeBookingSelect">
          <option value="">-- Select checked-in guest --</option>
          ${checkedIn.map(b => `<option value="${b.id}">${b.fullName} — ${b.roomName}</option>`).join('')}
        </select>
        <input type="text" id="chargeItemName" placeholder="Item name">
        <select id="chargeType">
          <option value="lost">Lost</option>
          <option value="damaged">Damaged</option>
          <option value="extra">Extra item</option>
        </select>
        <input type="number" id="chargeAmount" placeholder="Amount (KES)">
        <button type="button" class="icon-btn small" id="addChargeBtn">+ Add Charge</button>
      </div>
    </div>
  `;

  document.getElementById('addChargeBtn').addEventListener('click', () => {
    const bookingId = document.getElementById('chargeBookingSelect').value;
    const itemName = document.getElementById('chargeItemName').value.trim();
    const type = document.getElementById('chargeType').value;
    const amount = +document.getElementById('chargeAmount').value;
    if (!bookingId || !itemName || !amount) { alert('Please select a guest, item name and amount.'); return; }
    const dbNow = loadDB();
    const b = dbNow.booking.bookings.find(x => x.id === bookingId);
    if (!b) return;
    dbNow.booking.itemCharges.unshift({ id: uid('chg'), bookingId, guestName: b.fullName, itemName, type, amount, at: new Date().toISOString() });
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Logged item charge', `${itemName} — ${b.fullName}`);
    renderAdminItemTracking();
  });

  document.querySelectorAll('[data-delcharge]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      dbNow.booking.itemCharges = dbNow.booking.itemCharges.filter(c => c.id !== btn.dataset.delcharge);
      saveDB(dbNow);
      renderAdminItemTracking();
    });
  });
}

/* ---- Reports sub-tab ---- */
function renderAdminReports() {
  const db = loadDB();
  const today = todayStr();
  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const earningsInRange = (start) => {
    const bookingsSum = db.booking.bookings.filter(b => new Date(b.createdAt) >= start).reduce((s, b) => s + (b.total || 0), 0);
    const chargesSum = db.booking.itemCharges.filter(c => new Date(c.at) >= start).reduce((s, c) => s + (c.amount || 0), 0);
    return bookingsSum + chargesSum;
  };
  const todayEarnings = earningsInRange(new Date(today));
  const weekEarnings = earningsInRange(startOfWeek);
  const monthEarnings = earningsInRange(startOfMonth);
  const lostCharges = db.booking.itemCharges.reduce((s, c) => s + (c.amount || 0), 0);
  const currentGuests = db.booking.bookings.filter(b => b.status === 'checked-in');

  document.getElementById('bookingSubContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📊</span> Financial Reports</h3>
      <div class="admin-stats-grid">
        ${adminStatCard('📅', "Today's Earnings", `KES ${todayEarnings.toLocaleString()}`)}
        ${adminStatCard('📅', "This Week's Earnings", `KES ${weekEarnings.toLocaleString()}`)}
        ${adminStatCard('📅', "This Month's Earnings", `KES ${monthEarnings.toLocaleString()}`)}
        ${adminStatCard('⚠️', 'Lost Items Charges', `KES ${lostCharges.toLocaleString()}`)}
      </div>
    </div>
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">👥</span> Current Guests</h3>
      ${currentGuests.length ? currentGuests.map(g => `
        <div class="cms-list-item"><div><strong>${g.fullName}</strong> <span class="muted small">— ${g.roomName} · in since ${g.checkIn}</span></div></div>
      `).join('') : '<p class="muted">No guests currently checked in.</p>'}
    </div>
  `;
}

/* ---------- Library CMS ---------- */

/* ---------- Library helpers ---------- */
function libAvailable(db, item) {
  const out = (db.library.loans || []).filter(l => l.itemId === item.id && l.status === 'out').length;
  return Math.max(0, (item.qty || 0) - out);
}

function libDueDate(days = 14) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/* ---------- Public Library page ---------- */
function renderPublicLibrary(db) {
  const el = document.getElementById('libraryContent');
  if (!el) return;
  const lib = db.library || { sections: [], items: [], loans: [], requests: [], rules: '' };
  const items = lib.items || [];
  const sections = lib.sections || [];

  el.innerHTML = `
    <p class="section-lede">Browse our church library. Request a book and pick it up from the library desk or a deacon on duty.</p>
    ${lib.rules ? `<div class="lib-rules"><strong>Library rules:</strong> ${lib.rules}</div>` : ''}
    <div class="lib-toolbar">
      <input type="search" id="libSearch" placeholder="Search by title or author..." class="lib-search">
      <div class="filter-pills" id="libSectionFilters">
        <button type="button" class="filter-pill active" data-sec="all">All</button>
        ${sections.map(s => `<button type="button" class="filter-pill" data-sec="${s.id}">${s.name}</button>`).join('')}
      </div>
    </div>
    <div class="lib-grid" id="libGrid"></div>
    <div id="libEmpty" class="coming-soon" style="display:none;"><div class="ic">📚</div>No books match your search.</div>
  `;

  const grid = document.getElementById('libGrid');
  const empty = document.getElementById('libEmpty');
  let activeSec = 'all';
  let query = '';

  function paint() {
    const q = query.toLowerCase().trim();
    const filtered = items.filter(it => {
      if (activeSec !== 'all' && it.sectionId !== activeSec) return false;
      if (!q) return true;
      const hay = `${it.title || it.name || ''} ${it.author || ''}`.toLowerCase();
      return hay.includes(q);
    });
    empty.style.display = filtered.length ? 'none' : 'block';
    grid.innerHTML = filtered.map(it => {
      const sec = sections.find(s => s.id === it.sectionId);
      const avail = libAvailable(db, it);
      const statusClass = avail > 0 ? 'lib-avail' : 'lib-out';
      const statusText = avail > 0 ? `${avail} available` : 'All out';
      return `
        <div class="lib-card">
          <div class="lib-card-icon">📖</div>
          <div class="lib-card-title">${it.title || it.name || 'Untitled'}</div>
          ${it.author ? `<div class="lib-card-author">${it.author}</div>` : ''}
          <div class="lib-card-meta">${sec ? sec.name : 'Uncategorized'} · qty ${it.qty || 0}</div>
          <div class="lib-card-status ${statusClass}">${statusText}</div>
          ${it.notes ? `<div class="lib-card-notes">${it.notes}</div>` : ''}
          <button type="button" class="icon-btn gold small lib-req-btn" data-req="${it.id}" ${avail < 1 ? 'disabled' : ''}>
            ${avail > 0 ? 'Request Book' : 'Unavailable'}
          </button>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-req]').forEach(btn => {
      btn.addEventListener('click', () => openLibRequest(btn.dataset.req));
    });
  }

  document.getElementById('libSearch').addEventListener('input', e => {
    query = e.target.value;
    paint();
  });
  document.querySelectorAll('#libSectionFilters .filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#libSectionFilters .filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeSec = btn.dataset.sec;
      paint();
    });
  });
  paint();
}

function openLibRequest(itemId) {
  const db = loadDB();
  const item = (db.library.items || []).find(i => i.id === itemId);
  if (!item) return;
  const name = prompt('Your full name (required):');
  if (!name || !name.trim()) return;
  const phone = prompt('Phone number (required):') || '';
  if (!phone.trim()) { alert('Phone is required so we can reach you.'); return; }
  const message = prompt('Optional message (e.g. when you can pick up):') || '';
  const dbNow = loadDB();
  if (!dbNow.library.requests) dbNow.library.requests = [];
  dbNow.library.requests.unshift({
    id: uid('lreq'),
    itemId,
    itemTitle: item.title || item.name,
    name: name.trim(),
    phone: phone.trim(),
    message: message.trim(),
    at: new Date().toISOString(),
    status: 'pending'
  });
  saveDB(dbNow);
  logAudit('guest', name.trim(), 'Requested library book', item.title || item.name);
  alert('Request sent! The library team will contact you.');
  updateHeaderBellBadge(dbNow);
  renderPublicLibrary(dbNow);
}

/* ---------- Library CMS (Admin) ---------- */
function renderAdminLibrary() {
  const db = loadDB();
  const lib = db.library;
  if (!lib.loans) lib.loans = [];
  if (!lib.requests) lib.requests = [];
  if (!lib.rules) lib.rules = '';

  const pendingReq = (lib.requests || []).filter(r => r.status === 'pending');
  const activeLoans = (lib.loans || []).filter(l => l.status === 'out');
  const overdue = activeLoans.filter(l => l.dueAt && l.dueAt < new Date().toISOString().slice(0, 10));

  document.getElementById('adminContent').innerHTML = `
    <div class="admin-stats-grid">
      ${adminStatCard('📚', 'Titles', lib.items.length)}
      ${adminStatCard('📤', 'On Loan', activeLoans.length)}
      ${adminStatCard('⚠️', 'Overdue', overdue.length)}
      ${adminStatCard('📥', 'Requests', pendingReq.length)}
    </div>

    <div class="admin-subnav" id="libSubnav">
      <button type="button" class="admin-subnav-btn active" data-libtab="catalog"><span class="ic">📖</span> Catalog</button>
      <button type="button" class="admin-subnav-btn" data-libtab="loans"><span class="ic">📤</span> Loans</button>
      <button type="button" class="admin-subnav-btn" data-libtab="requests"><span class="ic">📥</span> Requests ${pendingReq.length ? `<span class="badge-count inline">${pendingReq.length}</span>` : ''}</button>
      <button type="button" class="admin-subnav-btn" data-libtab="sections"><span class="ic">🗂</span> Sections</button>
      <button type="button" class="admin-subnav-btn" data-libtab="rules"><span class="ic">📋</span> Rules</button>
    </div>
    <div id="libSubContent"></div>
  `;

  const sub = document.getElementById('libSubContent');
  document.querySelectorAll('#libSubnav .admin-subnav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#libSubnav .admin-subnav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      paintLibTab(btn.dataset.libtab);
    });
  });

  function paintLibTab(tab) {
    if (tab === 'catalog') paintCatalog();
    else if (tab === 'loans') paintLoans();
    else if (tab === 'requests') paintRequests();
    else if (tab === 'sections') paintSections();
    else if (tab === 'rules') paintRules();
  }

  function paintCatalog() {
    sub.innerHTML = `
      <div class="admin-panel">
        <h3 class="admin-panel-title"><span class="ic">📖</span> Catalog</h3>
        <div class="cms-list">
          ${lib.items.map(it => {
            const sec = lib.sections.find(s => s.id === it.sectionId);
            const avail = libAvailable(db, it);
            return `
              <div class="cms-list-item">
                <div>
                  <strong>${it.title || it.name}</strong>
                  ${it.author ? `<span class="muted small"> — ${it.author}</span>` : ''}
                  <div class="muted small">${sec ? sec.name : 'Uncategorized'} · total ${it.qty} · available ${avail}${it.notes ? ' · ' + it.notes : ''}</div>
                </div>
                <div class="table-actions">
                  <button type="button" class="icon-btn small" data-loanitem="${it.id}" ${avail < 1 ? 'disabled' : ''}>Loan out</button>
                  <button type="button" class="mini-del" data-item="${it.id}">✕</button>
                </div>
              </div>`;
          }).join('') || '<p class="muted">No items yet. Add your first book below.</p>'}
        </div>
        <div class="cms-add-row" style="flex-wrap:wrap;">
          <input type="text" id="libTitle" placeholder="Title *">
          <input type="text" id="libAuthor" placeholder="Author">
          <select id="libSection">
            ${lib.sections.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>
          <input type="number" id="libQty" placeholder="Qty" value="1" min="1" style="width:80px;flex:0;">
          <input type="text" id="libNotes" placeholder="Notes (optional)">
          <button type="button" class="icon-btn gold small" id="libAddBtn">+ Add Book</button>
        </div>
      </div>`;

    document.getElementById('libAddBtn').addEventListener('click', () => {
      const title = document.getElementById('libTitle').value.trim();
      if (!title) { alert('Title is required.'); return; }
      const dbNow = loadDB();
      dbNow.library.items.push({
        id: uid('lib'),
        sectionId: document.getElementById('libSection').value,
        title,
        name: title,
        author: document.getElementById('libAuthor').value.trim(),
        qty: +document.getElementById('libQty').value || 1,
        notes: document.getElementById('libNotes').value.trim()
      });
      saveDB(dbNow);
      logAudit('super_admin', dbNow.owner.name, 'Added library item', title);
      renderAdminLibrary();
    });
    sub.querySelectorAll('[data-item]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Remove this book from the catalog?')) return;
        const dbNow = loadDB();
        dbNow.library.items = dbNow.library.items.filter(it => it.id !== btn.dataset.item);
        saveDB(dbNow);
        renderAdminLibrary();
      });
    });
    sub.querySelectorAll('[data-loanitem]').forEach(btn => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.loanitem;
        const borrowerName = prompt('Borrower full name:');
        if (!borrowerName || !borrowerName.trim()) return;
        const borrowerPhone = prompt('Borrower phone:') || '';
        const due = libDueDate(14);
        const dbNow = loadDB();
        if (!dbNow.library.loans) dbNow.library.loans = [];
        dbNow.library.loans.unshift({
          id: uid('loan'),
          itemId,
          borrowerName: borrowerName.trim(),
          borrowerPhone: borrowerPhone.trim(),
          borrowedAt: new Date().toISOString().slice(0, 10),
          dueAt: due,
          returnedAt: null,
          status: 'out'
        });
        saveDB(dbNow);
        logAudit('super_admin', dbNow.owner.name, 'Loaned library item', borrowerName.trim());
        alert(`Loaned out. Due: ${due}`);
        updateHeaderBellBadge(dbNow);
        renderAdminSidebar();
        renderAdminLibrary();
      });
    });
  }

  function paintLoans() {
    const loans = [...(lib.loans || [])].sort((a, b) => (a.status === 'out' ? 0 : 1) - (b.status === 'out' ? 0 : 1));
    sub.innerHTML = `
      <div class="admin-panel">
        <h3 class="admin-panel-title"><span class="ic">📤</span> Loans</h3>
        ${loans.filter(l => l.status === 'out' && l.dueAt && l.dueAt < new Date().toISOString().slice(0, 10)).length ? `
          <div class="lib-overdue-banner">⚠ ${loans.filter(l => l.status === 'out' && l.dueAt && l.dueAt < new Date().toISOString().slice(0, 10)).length} overdue loan(s) — follow up with the borrower.</div>
        ` : ''}
        <div class="cms-list">
          ${loans.map(l => {
            const item = lib.items.find(i => i.id === l.itemId);
            const today = new Date().toISOString().slice(0, 10);
            const overdueFlag = l.status === 'out' && l.dueAt && l.dueAt < today;
            let daysHeld = 0;
            if (l.borrowedAt) {
              const end = l.returnedAt || today;
              daysHeld = Math.max(0, Math.round((new Date(end) - new Date(l.borrowedAt)) / 86400000));
            }
            return `
              <div class="cms-list-item ${overdueFlag ? 'lib-overdue-row' : ''}">
                <div>
                  <strong>${item ? (item.title || item.name) : 'Unknown book'}</strong>
                  <div class="muted small">${l.borrowerName}${l.borrowerPhone ? ' · ' + l.borrowerPhone : ''} · out ${l.borrowedAt} · due ${l.dueAt || '—'} · <strong>${daysHeld} day${daysHeld === 1 ? '' : 's'} held</strong></div>
                </div>
                <div class="table-actions">
                  ${overdueFlag ? '<span class="status-badge status-pending">⚠ Overdue</span>' : ''}
                  ${l.status === 'out'
                    ? `<button type="button" class="icon-btn small gold" data-return="${l.id}">Mark Returned</button>`
                    : `<span class="status-badge status-checked-out">Returned ${l.returnedAt || ''}</span>`}
                </div>
              </div>`;
          }).join('') || '<p class="muted">No loans recorded yet.</p>'}
        </div>
      </div>`;
    sub.querySelectorAll('[data-return]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dbNow = loadDB();
        const loan = dbNow.library.loans.find(l => l.id === btn.dataset.return);
        if (!loan) return;
        loan.status = 'returned';
        loan.returnedAt = new Date().toISOString().slice(0, 10);
        saveDB(dbNow);
        logAudit('super_admin', dbNow.owner.name, 'Returned library item', loan.borrowerName);
        updateHeaderBellBadge(dbNow);
        renderAdminSidebar();
        renderAdminLibrary();
      });
    });
  }

  function paintRequests() {
    const reqs = lib.requests || [];
    sub.innerHTML = `
      <div class="admin-panel">
        <h3 class="admin-panel-title"><span class="ic">📥</span> Book Requests</h3>
        <div class="cms-list">
          ${reqs.map(r => `
            <div class="cms-list-item">
              <div>
                <strong>${r.itemTitle || 'Book'}</strong>
                <div class="muted small">${r.name} · ${r.phone} · ${new Date(r.at).toLocaleDateString()}${r.message ? ' · "' + r.message + '"' : ''}</div>
              </div>
              <div class="table-actions">
                <span class="status-badge status-${r.status === 'pending' ? 'pending' : r.status === 'fulfilled' ? 'checked-in' : 'checked-out'}">${r.status}</span>
                ${r.status === 'pending' ? `
                  <button type="button" class="icon-btn small gold" data-fulfill="${r.id}">Fulfill</button>
                  <button type="button" class="icon-btn small" data-decline="${r.id}">Decline</button>
                ` : ''}
              </div>
            </div>`).join('') || '<p class="muted">No requests yet.</p>'}
        </div>
      </div>`;
    sub.querySelectorAll('[data-fulfill]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dbNow = loadDB();
        const r = dbNow.library.requests.find(x => x.id === btn.dataset.fulfill);
        if (!r) return;
        r.status = 'fulfilled';
        // auto-create loan
        if (!dbNow.library.loans) dbNow.library.loans = [];
        dbNow.library.loans.unshift({
          id: uid('loan'),
          itemId: r.itemId,
          borrowerName: r.name,
          borrowerPhone: r.phone,
          borrowedAt: new Date().toISOString().slice(0, 10),
          dueAt: libDueDate(14),
          returnedAt: null,
          status: 'out'
        });
        saveDB(dbNow);
        alert('Request fulfilled and loan recorded.');
        updateHeaderBellBadge(loadDB());
        renderAdminSidebar();
        renderAdminLibrary();
      });
    });
    sub.querySelectorAll('[data-decline]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dbNow = loadDB();
        const r = dbNow.library.requests.find(x => x.id === btn.dataset.decline);
        if (r) r.status = 'declined';
        saveDB(dbNow);
        updateHeaderBellBadge(dbNow);
        renderAdminSidebar();
        renderAdminLibrary();
      });
    });
  }

  function paintSections() {
    sub.innerHTML = `
      <div class="admin-panel">
        <h3 class="admin-panel-title"><span class="ic">🗂</span> Sections</h3>
        <div class="cms-list">
          ${lib.sections.map(s => `
            <div class="cms-list-item">
              <div><strong>${s.name}</strong></div>
              <button type="button" class="mini-del" data-sec="${s.id}">✕</button>
            </div>`).join('') || '<p class="muted">No sections.</p>'}
        </div>
        <div class="cms-add-row">
          <input type="text" id="libNewSec" placeholder="New section name">
          <button type="button" class="icon-btn gold small" id="libAddSecBtn">+ Add Section</button>
        </div>
      </div>`;
    document.getElementById('libAddSecBtn').addEventListener('click', () => {
      const name = document.getElementById('libNewSec').value.trim();
      if (!name) return;
      const dbNow = loadDB();
      dbNow.library.sections.push({ id: uid('sec'), name });
      saveDB(dbNow);
      renderAdminLibrary();
    });
    sub.querySelectorAll('[data-sec]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Delete this section? Books keep their sectionId but will show as Uncategorized.')) return;
        const dbNow = loadDB();
        dbNow.library.sections = dbNow.library.sections.filter(s => s.id !== btn.dataset.sec);
        saveDB(dbNow);
        renderAdminLibrary();
      });
    });
  }

  function paintRules() {
    sub.innerHTML = `
      <div class="admin-panel">
        <h3 class="admin-panel-title"><span class="ic">📋</span> Library Rules</h3>
        <p class="muted small" style="margin-bottom:12px;">Shown on the public Library page.</p>
        <div class="form-field">
          <textarea id="libRulesText" rows="4">${lib.rules || ''}</textarea>
        </div>
        <button type="button" class="icon-btn gold" id="libSaveRules"><span class="ic">💾</span> Save Rules</button>
      </div>`;
    document.getElementById('libSaveRules').addEventListener('click', () => {
      const dbNow = loadDB();
      dbNow.library.rules = document.getElementById('libRulesText').value.trim();
      saveDB(dbNow);
      alert('Rules saved.');
      renderAdminLibrary();
    });
  }

  paintLibTab('catalog');
}


function renderAdminContact() {
  const db = loadDB();
  const c = db.contact;
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">✉</span> Contact Page — Get in Touch</h3>
      <p class="muted small" style="margin-bottom:16px;">These details are what visitors see on the public Contact page. Incoming messages from that page's form now appear under <strong>Received</strong>.</p>
      <div class="form-field"><label>Email</label><input type="text" id="contactEmailInput" value="${c.email}"></div>
      <div class="form-field"><label>Phone</label><input type="text" id="contactPhoneInput" value="${c.phone}"></div>
      <div class="form-field"><label>Location</label><input type="text" id="contactLocationInput" value="${c.location}"></div>
      <div class="form-field"><label>Hours of Operation</label><textarea id="contactHoursInput" rows="2">${c.hours}</textarea></div>
      <div class="form-row">
        <div class="form-field"><label>Facebook URL</label><input type="text" id="contactFbInput" value="${c.facebook}"></div>
        <div class="form-field"><label>YouTube URL</label><input type="text" id="contactYtInput" value="${c.youtube}"></div>
      </div>
      <button type="button" class="icon-btn gold" id="contactSaveBtn"><span class="ic">💾</span> Save Changes</button>
    </div>
  `;

  document.getElementById('contactSaveBtn').addEventListener('click', () => {
    const dbNow = loadDB();
    dbNow.contact.email = document.getElementById('contactEmailInput').value.trim();
    dbNow.contact.phone = document.getElementById('contactPhoneInput').value.trim();
    dbNow.contact.location = document.getElementById('contactLocationInput').value.trim();
    dbNow.contact.hours = document.getElementById('contactHoursInput').value.trim();
    dbNow.contact.facebook = document.getElementById('contactFbInput').value.trim();
    dbNow.contact.youtube = document.getElementById('contactYtInput').value.trim();
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Updated contact page settings');
    renderContactPublic(dbNow);
    alert('Contact settings saved.');
  });
}

/* ============================================================
   REPORT TAB — system-wide SVG dashboard + Portal Control
   ============================================================ */
function renderAdminReport() {
  const db = loadDB();
  const stats = [
    { label: 'Received', value: db.contactSubmissions.length + db.messages.filter(m => m.toRole === 'super_admin').length, color: '#5b7cf0' },
    { label: 'Send', value: db.messages.filter(m => m.fromRole === 'super_admin').length, color: 'var(--gold)' },
    { label: 'Tour', value: TOUR_GROUP_ORDER.reduce((s, k) => s + (db.tour.groups[k] || []).length, 0) + TOUR_SINGLES.filter(v => db.tour.singles[v.key]).length, color: '#4caf6e' },
    { label: 'Project', value: PROJECT_STAGE_ORDER.reduce((s, k) => s + (db.project[k]?.media.length || 0), 0), color: '#e8b34c' },
    { label: 'Katoloni Wall', value: db.graduates.length, color: '#c23f8a' },
    { label: 'Booking', value: db.booking.bookings.length, color: '#f0a15b' },
    { label: 'Library', value: db.library.items.length, color: '#8a6ae0' },
    { label: 'Contact', value: db.contactSubmissions.length, color: '#e8607a' }
  ];

  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📊</span> System Overview</h3>
      ${svgBarChartHTML(stats, 760, 260)}
      <div class="admin-stats-grid" style="margin-top:18px;">
        ${stats.map(s => adminStatCard('📌', s.label, s.value)).join('')}
      </div>
    </div>
  `;
}

function renderAdminPortalControl() {
  const db = loadDB();
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">🗂</span> Portal Control</h3>
      <p class="muted" style="margin-bottom:18px;">Manage the Protocol and Disciple Class portals. <strong>View</strong> checks status only, with no editing. <strong>Update</strong> opens that portal's sections for you to edit directly.</p>
      <div class="portal-cards-grid">
        ${['bishop', 'protocol', 'disciple1', 'disciple2', 'disciple3'].map(key => portalControlCardHTML(db, key)).join('')}
      </div>
    </div>
  `;
  document.querySelectorAll('[data-portalview]').forEach(btn => {
    btn.addEventListener('click', () => openPortalViewModal(btn.dataset.portalview));
  });
  document.querySelectorAll('[data-portalupdate]').forEach(btn => {
    btn.addEventListener('click', () => {
      activePortalKey = btn.dataset.portalupdate;
      adminEditingPortal = true;
      memberActiveTab = 'profile';
      setAdminPortalTitle(`${PORTAL_DEFS[activePortalKey].label} Portal (Admin Editing)`, PORTAL_DEFS[activePortalKey].icon);
      renderMemberSidebar();
      switchMemberTab('profile');
    });
  });
}

function portalControlCardHTML(db, key) {
  const profile = db.portalProfiles[key];
  const hasPasscode = db.passcodes.some(p => p.role === key && !p.revoked);
  return `
    <div class="portal-card">
      <div class="portal-card-avatar">
        ${profile.photo ? `<img src="${profile.photo}">` : `<span>${PORTAL_DEFS[key].icon}</span>`}
      </div>
      <div class="portal-card-name">${PORTAL_DEFS[key].label}</div>
      <div class="portal-card-status ${hasPasscode ? 'linked' : 'unlinked'}">${hasPasscode ? 'Passcode Issued' : 'No Passcode Yet'}</div>
      <div class="portal-card-actions">
        <button type="button" class="icon-btn small" data-portalview="${key}"><span class="ic">👁</span> View</button>
        <button type="button" class="icon-btn small gold" data-portalupdate="${key}"><span class="ic">✏️</span> Update</button>
      </div>
    </div>
  `;
}

function openPortalViewModal(key) {
  const db = loadDB();
  const profile = db.portalProfiles[key];
  const sent = db.messages.filter(m => m.fromRole === key).length;
  const received = db.messages.filter(m => m.toRole === key).length;
  const complaints = db.complaints.filter(c => c.fromRole === key).length;
  const passcodeRec = db.passcodes.find(p => p.role === key && !p.revoked);
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <button type="button" class="icon-btn small" id="portalViewBackBtn" style="margin-bottom:16px;"><span class="ic">←</span> Back to Portal Control</button>
      <h3 class="admin-panel-title"><span class="ic">👁</span> ${PORTAL_DEFS[key].label} — Status (Read-only)</h3>
      <div class="profile-grid">
        <div class="avatar-upload">
          <div class="avatar-preview">${profile.photo ? `<img src="${profile.photo}">` : `<span>${PORTAL_DEFS[key].icon}</span>`}</div>
        </div>
        <div class="form-fields">
          <p class="muted">Leader: <strong style="color:var(--text-hi);">${profile.name || '—'}</strong></p>
          <p class="muted">Phone: ${profile.phone || '—'}</p>
          <p class="muted">Email: ${profile.email || '—'}</p>
          <p class="muted">Passcode: ${passcodeRec ? passcodeRec.code : 'Not yet generated'}</p>
        </div>
      </div>
      <div class="admin-stats-grid" style="margin-top:20px;">
        ${adminStatCard('📤', 'Sent', sent)}
        ${adminStatCard('📥', 'Received', received)}
        ${adminStatCard('⚠️', 'Complaints', complaints)}
      </div>
    </div>
  `;
  document.getElementById('portalViewBackBtn').addEventListener('click', () => switchAdminTab('portalControl'));
}

/* ============================================================
   PUBLIC BOOKING FLOW (guest-facing)
   ============================================================ */

function renderPublicRooms(db) {
  const el = document.getElementById('roomsGrid');
  if (!el) return;
  const rooms = db.booking.rooms;
  el.innerHTML = rooms.length ? `
    <div class="rooms-grid">
      ${rooms.map(r => `
        <div class="room-card">
          <div class="room-card-icon">🛏</div>
          <div class="room-card-name">${r.name}</div>
          <div class="room-card-rate">KES ${r.rate.toLocaleString()} <span>/ night</span></div>
          <div class="room-card-cap">Sleeps ${r.capacity}</div>
          <button type="button" class="icon-btn gold small" data-selectroom="${r.id}">Book Now →</button>
        </div>
      `).join('')}
    </div>
  ` : '<p class="muted">No room types available yet. Please check back soon.</p>';

  el.querySelectorAll('[data-selectroom]').forEach(btn => {
    btn.addEventListener('click', () => {
      const sel = document.getElementById('bookRoomSelect');
      if (sel) sel.value = btn.dataset.selectroom;
      updateBookingSummary();
      document.querySelector('.booking-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderRoomOptions(db) {
  const sel = document.getElementById('bookRoomSelect');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = `<option value="">-- Select Room --</option>` + db.booking.rooms.map(r => `<option value="${r.id}">${r.name} — KES ${r.rate}/night</option>`).join('');
  sel.value = current;
}

function renderItemOptions(db) {
  const el = document.getElementById('requestItemsList');
  if (!el) return;
  const items = db.booking.itemCatalog;
  el.innerHTML = items.length ? items.map(it => `
    <label class="request-item-row">
      <input type="checkbox" class="requestItemChk" data-item="${it.id}" data-cost="${it.extraCost}">
      Extra ${it.name} <span class="muted small">(${it.freeQty} free, then KES ${it.extraCost}/night each)</span>
    </label>
  `).join('') : '<p class="muted">No items available</p>';
  el.querySelectorAll('.requestItemChk').forEach(chk => chk.addEventListener('change', updateBookingSummary));
}

function updateBookingSummary() {
  const db = loadDB();
  const roomSel = document.getElementById('bookRoomSelect');
  if (!roomSel) return;
  const room = db.booking.rooms.find(r => r.id === roomSel.value);
  const checkin = document.getElementById('bookCheckin')?.value;
  const checkout = document.getElementById('bookCheckout')?.value;

  let nights = 0;
  if (checkin && checkout) {
    const d1 = new Date(checkin), d2 = new Date(checkout);
    nights = Math.max(0, Math.round((d2 - d1) / 86400000));
  }

  const rate = room ? room.rate : 0;
  const roomTotal = rate * nights;

  let itemsTotal = 0;
  document.querySelectorAll('.requestItemChk:checked').forEach(chk => {
    itemsTotal += (+chk.dataset.cost) * nights;
  });

  document.getElementById('summaryRate').textContent = `KES ${rate.toLocaleString()}`;
  document.getElementById('summaryNights').textContent = nights;
  document.getElementById('summaryTotal').textContent = `KES ${(roomTotal + itemsTotal).toLocaleString()}`;
}

function handleCompleteBooking() {
  const db = loadDB();
  if (!db.booking) db.booking = { rooms: [], itemCatalog: [], bookings: [], itemCharges: [], mpesaNumbers: {}, bishopContact: {} };
  if (!db.booking.bookings) db.booking.bookings = [];

  const roomId = document.getElementById('bookRoomSelect').value;
  const room = db.booking.rooms.find(r => r.id === roomId);
  const checkin = document.getElementById('bookCheckin').value;
  const checkout = document.getElementById('bookCheckout').value;
  const guestsCount = +document.getElementById('bookGuests').value || 1;
  const fullName = document.getElementById('bookFullName').value.trim();
  const phone = document.getElementById('bookPhone').value.trim();
  const email = document.getElementById('bookEmail').value.trim();
  const mpesaTxnId = document.getElementById('bookMpesaTxn').value.trim();

  if (!room || !checkin || !checkout || !fullName || !phone || !mpesaTxnId) {
    alert('Please fill in all required fields (room, dates, name, phone, M-Pesa transaction ID).');
    return;
  }
  const nights = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
  if (nights <= 0) { alert('Check-out date must be after check-in date.'); return; }

  const requestedItems = [];
  let itemsTotal = 0;
  document.querySelectorAll('.requestItemChk:checked').forEach(chk => {
    const item = db.booking.itemCatalog.find(it => it.id === chk.dataset.item);
    const cost = (+chk.dataset.cost) * nights;
    itemsTotal += cost;
    requestedItems.push({ itemId: chk.dataset.item, name: item ? item.name : '', cost });
  });

  const roomTotal = room.rate * nights;
  const total = roomTotal + itemsTotal;

  const booking = {
    id: uid('bk'),
    roomId: room.id,
    roomName: room.name,
    rate: room.rate,
    checkIn: checkin,
    checkOut: checkout,
    nights,
    guestsCount,
    fullName,
    phone,
    email,
    requestedItems,
    itemsTotal,
    roomTotal,
    total,
    mpesaTxnId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  const dbNow = loadDB();
  if (!dbNow.booking) dbNow.booking = db.booking;
  if (!dbNow.booking.bookings) dbNow.booking.bookings = [];
  dbNow.booking.bookings.unshift(booking);
  saveDB(dbNow);
  logAudit('guest', fullName, 'Made a booking', room.name);

  /* ---- Notify admin: bell badge + sidebar badge (mirrors library/contact flow) ---- */
  updateHeaderBellBadge(dbNow);
  if (document.getElementById('adminSidebar')) renderAdminSidebar();

  alert(`Booking submitted! Your booking ID is ${booking.id.slice(-6)}. We'll confirm shortly once your M-Pesa payment is verified.`);

  ['bookFullName', 'bookPhone', 'bookEmail', 'bookMpesaTxn'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('bookRoomSelect').value = '';
  document.getElementById('bookCheckin').value = '';
  document.getElementById('bookCheckout').value = '';
  document.getElementById('bookGuests').value = 1;
  document.querySelectorAll('.requestItemChk').forEach(chk => { chk.checked = false; });
  updateBookingSummary();

  /* ---- Immediately show the guest their own booking in "Check My Booking" ---- */
  const checkNameInput = document.getElementById('checkBookingName');
  if (checkNameInput) {
    checkNameInput.value = fullName;
    handleCheckBooking();
    document.getElementById('checkBookingResults')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function handleCheckBooking() {
  const db = loadDB();
  const bookings = (db.booking && db.booking.bookings) || [];
  const name = (document.getElementById('checkBookingName').value || '').trim().toLowerCase();
  const el = document.getElementById('checkBookingResults');
  if (!name) { el.innerHTML = '<p class="muted">Enter your full name to search.</p>'; return; }
  const matches = bookings.filter(b => (b.fullName || '').toLowerCase().includes(name));
  el.innerHTML = matches.length ? matches.map(b => `
    <div class="cms-list-item">
      <div>
        <strong>${b.roomName}</strong> <span class="muted small">— ${b.checkIn} to ${b.checkOut} · ${b.nights} night(s)</span>
        <div class="muted small">Total: KES ${b.total.toLocaleString()} · Status: <span class="status-badge status-${b.status}">${b.status}</span></div>
      </div>
    </div>
  `).join('') : '<p class="muted">No booking found under that name.</p>';
}

function initBookingPublic() {
  const db = loadDB();
  renderPublicRooms(db);
  renderRoomOptions(db);
  renderItemOptions(db);

  const mp = document.getElementById('mpesaPrimary');
  if (mp) {
    mp.textContent = db.booking.mpesaNumbers.primary;
    document.getElementById('mpesaAlt').textContent = db.booking.mpesaNumbers.alternative;
    document.getElementById('bishopPhone').textContent = db.booking.bishopContact.phone;
    document.getElementById('bishopNote').textContent = db.booking.bishopContact.note;
  }

  ['bookRoomSelect', 'bookCheckin', 'bookCheckout'].forEach(id => {
    const inp = document.getElementById(id);
    if (inp) inp.addEventListener('change', updateBookingSummary);
  });
  document.getElementById('completeBookingBtn')?.addEventListener('click', handleCompleteBooking);
  document.getElementById('checkBookingBtn')?.addEventListener('click', handleCheckBooking);
  document.getElementById('checkBookingName')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleCheckBooking();
  });

  updateBookingSummary();
}

/* ============================================================
   PUBLIC CONTACT PAGE (guest-facing)
   ============================================================ */

function renderContactPublic(db) {
  const c = db.contact;
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('contactEmailDisplay', c.email);
  setText('contactPhoneDisplay', c.phone);
  setText('contactLocationDisplay', c.location);
  setText('contactHoursDisplay', c.hours);
  const fb = document.getElementById('contactFbLink');
  if (fb) fb.href = c.facebook;
  const yt = document.getElementById('contactYtLink');
  if (yt) yt.href = c.youtube;
}

function handleContactSubmit() {
  const name = document.getElementById('contactFormName').value.trim();
  const email = document.getElementById('contactFormEmail').value.trim();
  const message = document.getElementById('contactFormMessage').value.trim();
  if (!name || !message) {
    alert('Please enter your name and a message.');
    return;
  }
  const db = loadDB();
  db.contactSubmissions.unshift({ id: uid('msg'), name, email, message, at: new Date().toISOString(), status: 'new' });
  saveDB(db);
  updateHeaderBellBadge(db);
  alert('Message sent! We will get back to you soon.');
  document.getElementById('contactFormName').value = '';
  document.getElementById('contactFormEmail').value = '';
  document.getElementById('contactFormMessage').value = '';
}

function initContactPublic() {
  const db = loadDB();
  renderContactPublic(db);
  document.getElementById('contactSendBtn')?.addEventListener('click', handleContactSubmit);
}