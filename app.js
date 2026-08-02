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

const SEED_DATA = {
  meta: {
    version: 6,
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

  /* ---------- Katoloni Wall — disciple class graduates ---------- */
  graduates: [
    // { id, name, discipleClass: 1|2|3, graduatedAt }
  ],

  /* ---------- Library ---------- */
  library: {
    sections: [
      { id: 's1', name: 'Sunday School' },
      { id: 's2', name: 'Theology' },
      { id: 's3', name: 'Youth Materials' }
    ],
    items: [
      // { id, sectionId, name, qty }
    ]
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
    return parsed;
  } catch (e) {
    console.error('DB parse failed, reseeding', e);
    localStorage.setItem(DB_KEY, JSON.stringify(SEED_DATA));
    return structuredClone(SEED_DATA);
  }
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
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
  const db = loadDB();

  initNav();
  initThemeToggle();
  initTyping();
  renderLeadershipPyramid(db);
  initCardTapFlip();
  renderNoticeboard(db);
  renderPublicTour(db);
  initMenuAndSettings();
  initAdminPortal();
  initBookingPublic();
  initContactPublic();
  updateHeaderBellBadge(db);
});

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

/* ---------------- Public Tour page render ---------------- */
function tourCardHTML(label, image) {
  return `
    <div class="tour-card">
      <div class="tour-card-img">
        ${image ? `<img src="${image}" alt="${label}">` : `<div class="tour-card-empty"><span class="ic">📷</span></div>`}
      </div>
      <div class="tour-card-label">${label}</div>
    </div>
  `;
}

function renderPublicTour(db) {
  const el = document.getElementById('tourContent');
  if (!el) return;
  const t = db.tour;

  const groupSection = (key) => {
    const meta = TOUR_GROUP_META[key];
    const items = (t.groups[key] || []).filter(it => it.image);
    if (!items.length) return '';
    return `
      <div class="tour-group">
        <h3 class="tour-group-title"><span class="ic">${meta.icon}</span> ${meta.label}</h3>
        <div class="tour-grid">
          ${items.map(it => tourCardHTML(it.name, it.image)).join('')}
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
          ${singlesWithImages.map(v => tourCardHTML(v.label, t.singles[v.key])).join('')}
        </div>
      </div>
    ` : ''}
    ${TOUR_GROUP_ORDER.map(groupSection).join('')}
    ${!singlesWithImages.length && TOUR_GROUP_ORDER.every(k => !(t.groups[k] || []).some(it => it.image)) ? `
      <div class="coming-soon"><div class="ic">🗺</div>Photos of the grounds are being added — check back soon.</div>
    ` : ''}
  `;
}

/* ---------------- Header buttons: Menu → Admin Portal, Settings ---------------- */
function initMenuAndSettings() {
  document.getElementById('settingsBtn').addEventListener('click', () => {
    alert('Settings panel builds next — theme default, notification preferences, session timeout, and passcode shortcuts.');
  });
}

/* ============================================================
   ADMIN PORTAL
   ------------------------------------------------------------
   Menu button → passcode gate (checked against db.passcodes,
   seeded with admin-4321) → Owner/Admin Portal with a sidebar
   of CMS sections mirroring the public nav.
   ============================================================ */

const ADMIN_TABS = [
  { key: 'profile',  label: 'Profile',       icon: '👤' },
  { key: 'invite',   label: 'Invite',        icon: '🔑' },
  { key: 'received', label: 'Received',      icon: '📥' },
  { key: 'send',     label: 'Send',          icon: '📤' },
  { key: 'tour',     label: 'Tour',          icon: '🗺' },
  { key: 'project',  label: 'Project',       icon: '🏗' },
  { key: 'notices',  label: 'Notice Board',  icon: '📢' },
  { key: 'wall',     label: 'Katoloni Wall', icon: '👥' },
  { key: 'booking',  label: 'Booking',       icon: '🛏' },
  { key: 'library',  label: 'Library',       icon: '📚' },
  { key: 'contact',  label: 'Contact',       icon: '✉' }
];

let adminActiveTab = 'profile';
let pendingAdminTarget = 'profile';

function initAdminPortal() {
  document.getElementById('menuBtn').addEventListener('click', () => openPasscodeGate('profile'));
  document.getElementById('headerBellBtn')?.addEventListener('click', () => openPasscodeGate('received'));
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

  // Delete-reason modal
  document.getElementById('deleteReasonCancelBtn')?.addEventListener('click', closeDeleteReason);
  document.getElementById('deleteReasonConfirmBtn')?.addEventListener('click', confirmDeleteMessage);
  document.getElementById('deleteReasonOverlay')?.addEventListener('click', e => {
    if (e.target.id === 'deleteReasonOverlay') closeDeleteReason();
  });
}

function openPasscodeGate(target = 'profile') {
  pendingAdminTarget = target;
  document.getElementById('passcodeError').textContent = '';
  document.getElementById('passcodeInput').value = '';
  document.getElementById('passcodeOverlay').classList.add('active');
  setTimeout(() => document.getElementById('passcodeInput').focus(), 50);
}

function closePasscodeGate() {
  document.getElementById('passcodeOverlay').classList.remove('active');
}

function attemptPasscode() {
  const entered = document.getElementById('passcodeInput').value.trim();
  const db = loadDB();
  const match = db.passcodes.find(p => p.code === entered && !p.revoked);
  if (match) {
    closePasscodeGate();
    openAdminPortal(match);
  } else {
    document.getElementById('passcodeError').textContent = 'Incorrect passcode. Try again.';
  }
}

function openAdminPortal(passcodeRecord) {
  const db = loadDB();
  document.getElementById('adminSignedInName').textContent = db.owner?.name || passcodeRecord.label || 'Admin';
  document.getElementById('adminOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  adminActiveTab = pendingAdminTarget || 'profile';
  renderAdminSidebar();
  switchAdminTab(adminActiveTab);
  logAudit(passcodeRecord.role, passcodeRecord.label, 'Logged in to Admin Portal');
}

function closeAdminPortal() {
  document.getElementById('adminOverlay').classList.remove('active');
  document.body.style.overflow = '';
  // Reflect any CMS edits made while inside the portal back onto the public page
  const db = loadDB();
  renderLeadershipPyramid(db);
  renderNoticeboard(db);
  renderPublicTour(db);
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
function combinedUnreadCount(db) {
  const newContact = db.contactSubmissions.filter(c => c.status === 'new').length;
  const unreadInternal = db.messages.filter(m => m.toRole === 'super_admin' && !m.readAt).length;
  return newContact + unreadInternal;
}

function updateHeaderBellBadge(db) {
  const el = document.getElementById('headerBellCount');
  if (!el) return;
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
  const el = document.getElementById('adminSidebar');
  el.innerHTML = ADMIN_TABS.map(t => `
    <button type="button" class="admin-side-btn ${t.key === adminActiveTab ? 'active' : ''}" data-tab="${t.key}">
      <span class="ic">${t.icon}</span> ${t.label}
      ${t.key === 'received' && unread > 0 ? `<span class="badge-count">${unread}</span>` : ''}
    </button>
  `).join('');
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
    send: renderAdminSend,
    tour: renderAdminTour,
    project: renderAdminProject,
    notices: renderAdminNotices,
    wall: renderAdminWall,
    booking: renderAdminBooking,
    library: renderAdminLibrary,
    contact: renderAdminContact
  };
  (renderers[tab] || renderAdminProfile)();
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
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">🔑</span> Invite Agent</h3>
      <p class="muted">Invite flow builds next.</p>
      <button type="button" class="icon-btn gold" id="inviteBtn"><span class="ic">➕</span> Invite</button>
    </div>
  `;
  document.getElementById('inviteBtn').addEventListener('click', () => {
    alert('Invite flow builds next.');
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

/* ---- Delete with required reason ---- */
let deletingMessageId = null;

function openDeleteReason(id) {
  deletingMessageId = id;
  document.getElementById('deleteReasonText').value = '';
  document.getElementById('deleteReasonOverlay').classList.add('active');
}

function closeDeleteReason() {
  document.getElementById('deleteReasonOverlay').classList.remove('active');
  deletingMessageId = null;
}

function confirmDeleteMessage() {
  if (!deletingMessageId) return;
  const reason = document.getElementById('deleteReasonText').value.trim();
  const db = loadDB();
  const msg = db.contactSubmissions.find(c => c.id === deletingMessageId);
  db.contactSubmissions = db.contactSubmissions.filter(c => c.id !== deletingMessageId);
  saveDB(db);
  logAudit('super_admin', db.owner.name, 'Deleted contact message', `${msg ? msg.name : ''} — reason: ${reason || '(none given)'}`);
  closeDeleteReason();
  renderAdminReceived();
  renderAdminSidebar();
  updateHeaderBellBadge(loadDB());
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
        <label>To Role</label>
        <input type="text" id="sendToRole" placeholder="e.g. deacon, treasurer">
      </div>
      <div class="form-field">
        <label>Subject</label>
        <input type="text" id="sendSubject" placeholder="Subject">
      </div>
      <div class="form-field">
        <label>Message</label>
        <textarea id="sendBody" rows="4" placeholder="Write your message..."></textarea>
      </div>
      <button type="button" class="icon-btn gold" id="sendBtn"><span class="ic">📤</span> Send Message</button>
    </div>
  `;
  document.getElementById('sendBtn').addEventListener('click', () => {
    const toRole = document.getElementById('sendToRole').value.trim();
    const subject = document.getElementById('sendSubject').value.trim();
    const body = document.getElementById('sendBody').value.trim();
    if (!toRole || !body) { alert('Please fill in recipient role and message.'); return; }
    const dbNow = loadDB();
    dbNow.messages.unshift({ id: uid('msg'), fromRole: 'super_admin', toRole, subject, body, attachment: null, at: new Date().toISOString(), readAt: null });
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

/* ---------- Katoloni Wall CMS (graduates) ---------- */
function renderAdminWall() {
  const db = loadDB();
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">👥</span> Katoloni Wall — Graduates</h3>
      <div class="cms-list">
        ${db.graduates.map(g => `
          <div class="cms-list-item">
            <div><strong>${g.name}</strong> <span class="muted small">— Class ${g.discipleClass} · ${new Date(g.graduatedAt).toLocaleDateString()}</span></div>
            <button type="button" class="mini-del" data-grad="${g.id}">✕</button>
          </div>
        `).join('') || '<p class="muted">No graduates added yet.</p>'}
      </div>
      <div class="cms-add-row">
        <input type="text" id="gradName" placeholder="Full name">
        <select id="gradClass">
          <option value="1">Class 1</option>
          <option value="2">Class 2</option>
          <option value="3">Class 3</option>
        </select>
        <button type="button" class="icon-btn small" id="gradAddBtn">+ Add Graduate</button>
      </div>
    </div>
  `;
  document.getElementById('gradAddBtn').addEventListener('click', () => {
    const name = document.getElementById('gradName').value.trim();
    if (!name) return;
    const discipleClass = +document.getElementById('gradClass').value;
    const dbNow = loadDB();
    dbNow.graduates.push({ id: uid('g'), name, discipleClass, graduatedAt: new Date().toISOString() });
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Added graduate', name);
    renderAdminWall();
  });
  document.querySelectorAll('[data-grad]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      dbNow.graduates = dbNow.graduates.filter(g => g.id !== btn.dataset.grad);
      saveDB(dbNow);
      renderAdminWall();
    });
  });
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
}

function deleteBooking(id) {
  const db = loadDB();
  db.booking.bookings = db.booking.bookings.filter(b => b.id !== id);
  saveDB(db);
  renderAdminBookingsList();
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
function renderAdminLibrary() {
  const db = loadDB();
  document.getElementById('adminContent').innerHTML = `
    <div class="admin-panel">
      <h3 class="admin-panel-title"><span class="ic">📚</span> Library — Items</h3>
      <div class="cms-list">
        ${db.library.items.map(it => {
          const sec = db.library.sections.find(s => s.id === it.sectionId);
          return `
            <div class="cms-list-item">
              <div><strong>${it.name}</strong> <span class="muted small">— ${sec ? sec.name : 'Uncategorized'} · qty ${it.qty}</span></div>
              <button type="button" class="mini-del" data-item="${it.id}">✕</button>
            </div>
          `;
        }).join('') || '<p class="muted">No items added yet.</p>'}
      </div>
      <div class="cms-add-row">
        <input type="text" id="libItemName" placeholder="Item name">
        <select id="libItemSection">
          ${db.library.sections.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
        <input type="number" id="libItemQty" placeholder="Qty" value="1">
        <button type="button" class="icon-btn small" id="libAddBtn">+ Add Item</button>
      </div>
    </div>
  `;
  document.getElementById('libAddBtn').addEventListener('click', () => {
    const name = document.getElementById('libItemName').value.trim();
    if (!name) return;
    const sectionId = document.getElementById('libItemSection').value;
    const qty = +document.getElementById('libItemQty').value || 1;
    const dbNow = loadDB();
    dbNow.library.items.push({ id: uid('lib'), sectionId, name, qty });
    saveDB(dbNow);
    logAudit('super_admin', dbNow.owner.name, 'Added library item', name);
    renderAdminLibrary();
  });
  document.querySelectorAll('[data-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dbNow = loadDB();
      dbNow.library.items = dbNow.library.items.filter(it => it.id !== btn.dataset.item);
      saveDB(dbNow);
      renderAdminLibrary();
    });
  });
}

/* ---------- Contact CMS (view submissions) ---------- */
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
  dbNow.booking.bookings.unshift(booking);
  saveDB(dbNow);
  logAudit('guest', fullName, 'Made a booking', room.name);

  alert(`Booking submitted! Your booking ID is ${booking.id.slice(-6)}. We'll confirm shortly once your M-Pesa payment is verified.`);

  ['bookFullName', 'bookPhone', 'bookEmail', 'bookMpesaTxn'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('bookRoomSelect').value = '';
  document.getElementById('bookCheckin').value = '';
  document.getElementById('bookCheckout').value = '';
  document.getElementById('bookGuests').value = 1;
  document.querySelectorAll('.requestItemChk').forEach(chk => { chk.checked = false; });
  updateBookingSummary();
}

function handleCheckBooking() {
  const db = loadDB();
  const name = document.getElementById('checkBookingName').value.trim().toLowerCase();
  const el = document.getElementById('checkBookingResults');
  if (!name) { el.innerHTML = '<p class="muted">Enter your full name to search.</p>'; return; }
  const matches = db.booking.bookings.filter(b => b.fullName.toLowerCase().includes(name));
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