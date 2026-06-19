(() => {
  const SETTINGS_KEY = 'tvza.browser.settings';
  const QUICK_LINKS_KEY = 'tvza.browser.quickLinks';
  const HISTORY_KEY = 'tvza.browser.history';
  const ASSISTANTS = {
    claude: 'https://claude.ai/new',
    chatgpt: 'https://chatgpt.com/',
    copilot: 'https://copilot.microsoft.com/',
    custom: ''
  };
  const DEFAULT_SETTINGS = {
    searchEngine: 'google',
    assistantProvider: 'claude',
    assistantUrl: 'https://claude.ai/new',
    homeMode: 'start',
    homeUrl: ''
  };
  const DEFAULT_QUICK_LINKS = [
    { title: 'Wikipedia', url: 'https://www.wikipedia.org' },
    { title: 'MDN', url: 'https://developer.mozilla.org' },
    { title: 'YouTube', url: 'https://www.youtube.com' },
    { title: 'Google', url: 'https://www.google.com' }
  ];

  const $ = selector => document.querySelector(selector);
  let authApi = null;
  let firestoreApi = null;
  let currentUser = null;
  let currentProfile = {};
  let moduleRegistry = {};

  function readSettings() {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
    } catch (error) {
      localStorage.removeItem(SETTINGS_KEY);
      return { ...DEFAULT_SETTINGS };
    }
  }

  function writeSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function readJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
    } catch (error) {
      localStorage.removeItem(key);
      return fallback;
    }
  }

  function readQuickLinks() {
    const saved = readJson(QUICK_LINKS_KEY, null);
    const source = Array.isArray(saved) && saved.length ? saved : DEFAULT_QUICK_LINKS;
    return [...source, ...Array(Math.max(0, 8 - source.length)).fill({ title: '', url: '' })].slice(0, 8);
  }

  function load() {
    const settings = readSettings();
    $('#searchEngine').value = settings.searchEngine;
    $('#assistantProvider').value = settings.assistantProvider;
    $('#assistantUrl').value = settings.assistantUrl;
    $('#homeMode').value = settings.homeMode;
    $('#homeUrl').value = settings.homeUrl;
    renderQuickLinks();
    renderHistory();
  }

  function escHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  async function initProfileManagement() {
    try {
      const firebase = await import('./firebase-config.js');
      const authModule = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
      const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      authApi = { ...firebase, ...authModule };
      firestoreApi = { ...firebase, ...firestoreModule };
      moduleRegistry = firebase.MODULES || {};

      firebase.auth.onAuthStateChanged(async user => {
        currentUser = user;
        if (!user) {
          renderSignedOutProfile();
          return;
        }
        currentProfile = await firebase.getProfile(user);
        renderSignedInProfile(firebase.allowedModules(currentProfile), firebase.enabledModules(currentProfile));
      });
    } catch (error) {
      $('#profileStatus').textContent = 'Firebase konnte hier nicht geladen werden. Prüfe die App-Domain in Firebase Auth.';
    }
  }

  function renderSignedOutProfile() {
    $('#profileTitle').textContent = 'Nicht angemeldet';
    $('#profileSub').textContent = 'Melde dich mit dem gleichen TVZA Konto an.';
    $('#profileControls').hidden = true;
    $('#profileSaveRow').hidden = true;
    $('#profileSignOut').hidden = true;
    $('#profileLoginLink').hidden = false;
    $('#profileStatus').textContent = 'Login öffnet die TVZA Website. Für die Windows-App muss die App-Domain in Firebase erlaubt sein.';
  }

  function renderSignedInProfile(allowed, enabled) {
    const displayName = currentProfile.displayName || currentUser.displayName || '';
    $('#profileTitle').textContent = displayName || 'TVZA Profil';
    $('#profileSub').textContent = currentUser.email || 'Angemeldet';
    $('#profileDisplayName').value = displayName;
    $('#profileEmail').value = currentUser.email || '';
    $('#profileControls').hidden = false;
    $('#profileSaveRow').hidden = false;
    $('#profileSignOut').hidden = false;
    $('#profileLoginLink').hidden = true;
    $('#profileStatus').textContent = 'Verbunden mit dem TVZA Firebase Projekt.';

    const available = Object.values(moduleRegistry).filter(module => allowed[module.key]);
    $('#profileModules').innerHTML = available.length
      ? available.map(module => `
        <label class="browser-module-toggle">
          <input type="checkbox" data-profile-module="${escHtml(module.key)}" ${enabled[module.key] ? 'checked' : ''} />
          <span>${escHtml(module.emoji || '')}</span>
          <strong>${escHtml(module.name)}</strong>
        </label>
      `).join('')
      : '<p class="browser-empty">Noch keine Module freigeschaltet.</p>';
  }

  async function saveProfile() {
    if (!currentUser || !firestoreApi) return;
    const displayName = $('#profileDisplayName').value.trim();
    const modules = {};
    document.querySelectorAll('[data-profile-module]').forEach(input => {
      modules[input.dataset.profileModule] = input.checked;
    });
    try {
      await authApi.updateProfile(currentUser, { displayName }).catch(() => {});
      await firestoreApi.setDoc(
        firestoreApi.doc(firestoreApi.db, 'users', currentUser.uid),
        { displayName, email: currentUser.email || '', modules },
        { merge: true }
      );
      currentProfile = { ...currentProfile, displayName, email: currentUser.email || '', modules };
      $('#profileTitle').textContent = displayName || 'TVZA Profil';
      $('#profileStatus').textContent = 'Profil gespeichert. Die TVZA App nutzt dieselben Daten.';
    } catch (error) {
      $('#profileStatus').textContent = 'Profil konnte nicht gespeichert werden. Prüfe Firebase-Regeln und Auth-Domain.';
    }
  }

  function save() {
    const provider = $('#assistantProvider').value;
    const settings = {
      searchEngine: $('#searchEngine').value,
      assistantProvider: provider,
      assistantUrl: provider === 'custom' ? $('#assistantUrl').value.trim() : ASSISTANTS[provider],
      homeMode: $('#homeMode').value,
      homeUrl: $('#homeUrl').value.trim()
    };
    writeSettings(settings);
    $('#settingsStatus').textContent = 'Gespeichert. Der Browser nutzt die neuen Einstellungen sofort.';
  }

  function renderQuickLinks() {
    const links = readQuickLinks();
    $('#quickLinkEditor').innerHTML = links.map((link, index) => `
      <div class="browser-shortcut-row">
        <span>${index + 1}</span>
        <input data-quick-title="${index}" type="text" value="${escHtml(link.title || '')}" placeholder="Name" />
        <input data-quick-url="${index}" type="url" value="${escHtml(link.url || '')}" placeholder="https://..." />
      </div>
    `).join('');
  }

  function saveQuickLinks() {
    const links = [];
    for (let index = 0; index < 8; index += 1) {
      const title = document.querySelector(`[data-quick-title="${index}"]`)?.value.trim();
      let url = document.querySelector(`[data-quick-url="${index}"]`)?.value.trim();
      if (!title || !url) continue;
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      links.push({ title, url });
    }
    localStorage.setItem(QUICK_LINKS_KEY, JSON.stringify(links));
    $('#quickLinksStatus').textContent = 'Shortcuts gespeichert.';
  }

  function renderHistory() {
    const history = readJson(HISTORY_KEY, []);
    $('#historySettingsList').innerHTML = history.length
      ? history.map(item => `
        <button type="button" class="browser-history-row" data-history-url="${escHtml(item.url)}">
          <strong>${escHtml(item.title || item.url)}</strong>
          <small>${escHtml(item.url)}</small>
        </button>
      `).join('')
      : '<p class="browser-empty">Noch kein Verlauf.</p>';
  }

  $('#saveSettings').addEventListener('click', save);
  $('#saveQuickLinks').addEventListener('click', saveQuickLinks);
  $('#resetQuickLinks').addEventListener('click', () => {
    localStorage.setItem(QUICK_LINKS_KEY, JSON.stringify(DEFAULT_QUICK_LINKS));
    renderQuickLinks();
    $('#quickLinksStatus').textContent = 'Standard-Shortcuts wiederhergestellt.';
  });
  $('#clearHistory').addEventListener('click', () => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
    renderHistory();
  });
  $('#profileSave').addEventListener('click', saveProfile);
  $('#profileSignOut').addEventListener('click', async () => {
    if (!authApi) return;
    await authApi.signOut(authApi.auth);
  });
  $('#resetSettings').addEventListener('click', () => {
    writeSettings({ ...DEFAULT_SETTINGS });
    load();
    $('#settingsStatus').textContent = 'Zurückgesetzt: Google Suche, Claude Assistant, TVZA Browser Home.';
  });

  $('#assistantProvider').addEventListener('change', event => {
    const url = ASSISTANTS[event.target.value] || '';
    if (url) $('#assistantUrl').value = url;
  });

  load();
  initProfileManagement();
})();
