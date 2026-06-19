import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  getAuth, setPersistence, browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  collection, query, where, getDocs, getDoc, doc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyBNOe75cdHgw0kqL6xHACaUm0EUt83-cbE",
  authDomain: "tvza-11d44.firebaseapp.com",
  projectId: "tvza-11d44",
  storageBucket: "tvza-11d44.firebasestorage.app",
  messagingSenderId: "214201333283",
  appId: "1:214201333283:web:08adcd69499ef4046e2396",
  measurementId: "G-RP54PM439B"
};

export const app = initializeApp(firebaseConfig);

// Firestore with offline persistence (modern API)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager() })
});

// Auth with permanent local persistence (stays logged in offline)
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.warn);

/* ── Shared helpers ────────────────────────────── */

// Redirect to login if not authenticated. Returns a promise of the user.
export function requireAuth(loginPath = 'https://ti30x.github.io/tvza-app/login.html') {
  return new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(user => {
      unsub();
      if (!user) { window.location.href = loginPath; return; }
      resolve(user);
    });
  });
}

// Wire up the standard offline banner (element with id="offlineBanner")
export function wireOfflineBanner() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;
  const update = () => banner.classList.toggle('visible', !navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

export function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Module-Registry (erweiterbar) ─────────────────
   Neue Module hier ergänzen — Dashboard, Einstellungen
   und Teilen ziehen sich automatisch daraus.            */
export const MODULES = {
  ski:  { key:'ski',  name:'Ski Tracker',    sub:'Schliff & Wachs',        emoji:'🎿', page:'https://ti30x.github.io/tvza-app/pages/skitracker.html',  perUser:true,  shareable:true  },
  food: { key:'food', name:'Food Tracker',   sub:'Kalorien & Nährstoffe',  emoji:'🍎', page:'https://ti30x.github.io/tvza-app/pages/foodtracker.html', perUser:true,  shareable:true  },
  browser: { key:'browser', name:'TVZA Browser', sub:'Tabs, Favoriten & Verlauf', emoji:'🌐', page:'browser.html', perUser:false, shareable:false },
  trip: { key:'trip', name:'Familienreisen', sub:'Gemeinsam planen',       emoji:'🧳', page:'https://ti30x.github.io/tvza-app/pages/tripplanner.html', perUser:false, shareable:false },
  matura: { key:'matura', name:'Maturaarbeit', sub:'Status & Fortschritt', emoji:'📊', page:'https://ti30x.github.io/tvza-app/pages/maturaarbeit.html', perUser:false, shareable:false },
  maturatracker: { key:'maturatracker', name:'Maturaarbeit-Tracker', sub:'To-dos & Countdown', emoji:'🧵', page:'https://ti30x.github.io/tvza-app/pages/maturaarbeit-tracker.html', perUser:true, shareable:false },
  publicProjects: { key:'publicProjects', name:'Öffentliche Projekte', sub:'Von allen geteilt', emoji:'🌐', perUser:false, shareable:false },
};

// Neue Nutzer starten schlank; weitere Module schaltet ein Admin frei.
export const DEFAULT_MODULES = { ski:false, food:true, browser:true, trip:true, matura:false, maturatracker:true, publicProjects:false };
export const ALL_MODULES = Object.fromEntries(Object.keys(MODULES).map(key => [key, true]));

export async function getProfile(user) {
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    return snap.exists() ? snap.data() : {};
  } catch (e) { console.warn(e); return {}; }
}

// Admin-Freigabe eines Nutzers.
export function allowedModules(profile) {
  if (profile?.isTimo === true) return { ...ALL_MODULES };
  return { ...DEFAULT_MODULES, ...(profile?.allowedModules || {}) };
}

// Effektive Modul-Auswahl: Admin-Freigabe UND persönliche Sichtbarkeit.
export function enabledModules(profile) {
  const allowed = allowedModules(profile);
  const visible = { ...allowed, ...(profile?.modules || {}) };
  return Object.fromEntries(Object.keys(MODULES).map(key => [key, !!allowed[key] && !!visible[key]]));
}

/* ── Teilen (Module mit anderen Nutzern) ──────────── */

// Freigaben, die AN diese E-Mail gerichtet sind (mit mir geteilt).
export async function sharesForEmail(email) {
  if (!email) return [];
  try {
    const qs = await getDocs(query(collection(db, 'shares'), where('targetEmail', '==', email.toLowerCase())));
    return qs.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.warn(e); return []; }
}

// Freigaben, die ICH (als Eigentümer) erstellt habe.
export async function sharesByOwner(uid) {
  try {
    const qs = await getDocs(query(collection(db, 'shares'), where('ownerUid', '==', uid)));
    return qs.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.warn(e); return []; }
}

// Welche Daten soll eine Tracker-Seite für `moduleKey` zeigen?
// Beachtet ?owner=<uid>; fällt sonst auf eigene Daten zurück.
// Liefert { dataUid, role:'owner'|'edit'|'view', ownerName }.
export async function resolveAccess(user, moduleKey) {
  const owner = new URLSearchParams(location.search).get('owner');
  if (!owner || owner === user.uid) return { dataUid: user.uid, role: 'owner', ownerName: '' };
  const shares = await sharesForEmail(user.email);
  const s = shares.find(x => x.ownerUid === owner && x.module === moduleKey);
  if (!s) return { dataUid: user.uid, role: 'owner', ownerName: '', denied: true };
  return { dataUid: owner, role: s.role === 'edit' ? 'edit' : 'view', ownerName: s.ownerName || '' };
}
