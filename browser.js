(() => {
  const START_URL = 'tvza://start';
  const TVZA_INDEX_URL = 'https://ti30x.github.io/tvza-app/index.html';
  const TVZA_PUBLIC_URL = 'https://ti30x.github.io/tvza-app/public.html';
  const TVZA_LOGIN_URL = 'https://ti30x.github.io/tvza-app/login.html';
  const TAB_KEY = 'tvza.browser.tabs';
  const ACTIVE_KEY = 'tvza.browser.activeTab';
  const FAVORITES_KEY = 'tvza.browser.favorites';
  const HISTORY_KEY = 'tvza.browser.history';
  const PROJECTS_KEY = 'tvza.browser.projects';
  const SETTINGS_KEY = 'tvza.browser.settings';
  const LAYOUT_KEY = 'tvza.browser.layout';
  const SEARCH_ENGINES = {
    google: 'https://www.google.com/search?q=',
    bing: 'https://www.bing.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q='
  };
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

  const $ = selector => document.querySelector(selector);
  const tabStrip = $('#tabStrip');
  const addressInput = $('#addressInput');
  const heroSearchInput = $('#heroSearchInput');
  const frame = $('#browserFrame');
  const startPanel = $('#startPanel');
  const status = $('#browserStatus');
  const favoritesList = $('#favoritesList');
  const recentsList = $('#recentsList');
  const historyList = $('#historyList');
  const tvzaSignedOutPanel = $('#tvzaSignedOutPanel');
  const tvzaFamilyFrame = $('#tvzaFamilyFrame');
  const tvzaUserLine = $('#tvzaUserLine');
  const tvzaSideApp = $('#tvzaSideApp');
  const tvzaSideSignedOut = $('#tvzaSideSignedOut');
  const tvzaSideLoginBtn = $('#tvzaSideLoginBtn');
  const tvzaSideFullBtn = $('#tvzaSideFullBtn');
  const tvzaSidebarStatus = $('#tvzaSidebarStatus');
  const tvzaHomeHint = $('#tvzaHomeHint');
  const assistantDrawer = $('#assistantDrawer');
  const assistantFrame = $('#assistantFrame');
  const browserWorkspace = $('#browserWorkspace');
  const loginPromptBtn = $('#loginPromptBtn');

  let tabs = readJson(TAB_KEY, null);
  let activeTabId = localStorage.getItem(ACTIVE_KEY);
  let favorites = readJson(FAVORITES_KEY, []);
  let browserHistory = readJson(HISTORY_KEY, []);
  let projects = readJson(PROJECTS_KEY, null);
  let settings = readSettings();
  let layout = readLayout();
  let tvzaLoggedIn = false;

  if (!Array.isArray(tabs) || !tabs.length) {
    tabs = [makeTab()];
    activeTabId = tabs[0].id;
  }
  if (!tabs.some(tab => tab.id === activeTabId)) activeTabId = tabs[0].id;
  projects = normalizeProjects(projects);
  tabs.forEach(tab => {
    tab.projectId = tab.projectId || projectIdForUrl(tab.url);
    ensureProject(tab.projectId, projectForUrl(tab.url), tab.url);
  });

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed ?? fallback;
    } catch (error) {
      localStorage.removeItem(key);
      return fallback;
    }
  }

  function readSettings() {
    const saved = readJson(SETTINGS_KEY, {});
    return { ...DEFAULT_SETTINGS, ...(saved || {}) };
  }

  function readLayout() {
    const saved = readJson(LAYOUT_KEY, {});
    return {
      sidebarWidth: clamp(Number(saved.sidebarWidth) || 260, 64, 460),
      assistantWidth: clamp(Number(saved.assistantWidth) || 430, 320, assistantMaxWidth()),
      sidebarMode: saved.sidebarMode === 'slim' ? 'closed' : (saved.sidebarMode || 'normal')
    };
  }

  function saveLayout() {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function assistantMaxWidth() {
    return Math.max(360, Math.floor(window.innerWidth * 0.5));
  }

  function searchPrefix() {
    return SEARCH_ENGINES[settings.searchEngine] || SEARCH_ENGINES.google;
  }

  function assistantUrl() {
    if (settings.assistantProvider === 'custom') return settings.assistantUrl || ASSISTANTS.claude;
    return ASSISTANTS[settings.assistantProvider] || settings.assistantUrl || ASSISTANTS.claude;
  }

  function homeTarget() {
    if (settings.homeMode === 'tvza') return TVZA_INDEX_URL;
    if (settings.homeMode === 'public') return TVZA_PUBLIC_URL;
    if (settings.homeMode === 'custom' && settings.homeUrl) return settings.homeUrl;
    return START_URL;
  }

  function uid() {
    return crypto?.randomUUID?.() || `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function makeTab(url = START_URL) {
    const projectId = projectIdForUrl(url);
    return {
      id: uid(),
      title: url === START_URL ? 'Start' : titleFromUrl(url),
      url,
      projectId,
      entries: [url],
      index: 0
    };
  }

  function activeTab() {
    return tabs.find(tab => tab.id === activeTabId) || tabs[0];
  }

  function saveState() {
    localStorage.setItem(TAB_KEY, JSON.stringify(tabs));
    localStorage.setItem(ACTIVE_KEY, activeTabId);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    localStorage.setItem(HISTORY_KEY, JSON.stringify(browserHistory.slice(0, 80)));
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  }

  function normalizeInput(raw) {
    const value = String(raw || '').trim();
    if (!value) return START_URL;
    if (value === START_URL) return START_URL;
    if (value === 'index.html') return TVZA_INDEX_URL;
    if (value === 'public.html') return TVZA_PUBLIC_URL;
    if (value === 'login.html') return TVZA_LOGIN_URL;
    if (/^(https?:\/\/|file:\/\/)/i.test(value)) return value;
    if (/^\.?\/?[\w./-]+\.html(?:[?#].*)?$/i.test(value)) return new URL(value, location.href).href;
    if (/^(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(value)) return `http://${value}`;
    if (/^[\w.-]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(value)) return `https://${value}`;
    return `${searchPrefix()}${encodeURIComponent(value)}`;
  }

  function titleFromUrl(url) {
    if (url === START_URL) return 'Start';
    try {
      const parsed = new URL(url, location.href);
      const path = parsed.pathname.toLowerCase();
      const host = parsed.hostname.toLowerCase();
      if (host === 'ti30x.github.io' && path.endsWith('/tvza-app/index.html')) return 'TVZA Family App';
      if (host === 'ti30x.github.io' && path.endsWith('/tvza-app/public.html')) return 'TVZA Online';
      if (host === 'ti30x.github.io' && path.endsWith('/tvza-app/login.html')) return 'TVZA Login';
      if (host === 'index.html') return 'TVZA Family App';
      if (host === 'public.html') return 'TVZA Online';
      if (host === 'login.html') return 'TVZA Login';
      if (parsed.origin === location.origin && path.endsWith('/index.html')) return 'TVZA Family App';
      if (parsed.origin === location.origin && path.endsWith('/public.html')) return 'TVZA Online';
      if (parsed.origin === location.origin && path.endsWith('/browser-settings.html')) return 'Browser Settings';
      return parsed.hostname.replace(/^www\./, '') || url;
    } catch (error) {
      return url;
    }
  }

  function displayUrl(url) {
    return url === START_URL ? '' : url;
  }

  function setStatus(text) {
    status.textContent = text;
  }

  function addHistory(tab) {
    if (tab.url === START_URL) return;
    tab.projectId = tab.projectId || projectIdForUrl(tab.url);
    browserHistory = [
      { title: tab.title, url: tab.url, projectId: tab.projectId, project: projectNameForId(tab.projectId, tab.url), visitedAt: Date.now() },
      ...browserHistory.filter(item => item.url !== tab.url)
    ].slice(0, 80);
    updateProjectFromTab(tab);
  }

  function projectIdForUrl(url) {
    if (!url || url === START_URL) return 'project:start';
    return `project:${projectForUrl(url).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'web'}`;
  }

  function projectNameForId(projectId, url = '') {
    return projects?.[projectId]?.name || projectForUrl(url);
  }

  function projectForUrl(url) {
    if (!url || url === START_URL) return 'Start';
    try {
      const parsed = new URL(url, location.href);
      const path = parsed.pathname.toLowerCase();
      const host = parsed.hostname.replace(/^www\./, '');
      if (host === 'ti30x.github.io' && path.endsWith('/tvza-app/index.html')) return 'TVZA Family App';
      if (host === 'ti30x.github.io' && path.endsWith('/tvza-app/public.html')) return 'TVZA Online';
      if (host === 'ti30x.github.io' && path.endsWith('/tvza-app/login.html')) return 'TVZA Login';
      if (host === 'index.html') return 'TVZA Family App';
      if (host === 'public.html') return 'TVZA Online';
      if (host === 'login.html') return 'TVZA Login';
      if (host === location.hostname && path.endsWith('/index.html')) return 'TVZA Family App';
      if (host === location.hostname && path.endsWith('/public.html')) return 'TVZA Online';
      if (host.includes('google.') || path.includes('/search')) return 'Google Search';
      if (host.includes('claude.ai')) return 'Claude Assistant';
      if (host.includes('youtube.')) return 'YouTube';
      if (host.includes('wikipedia.')) return 'Wikipedia';
      if (host.includes('developer.mozilla.')) return 'MDN';
      return host || 'Websites';
    } catch (error) {
      if (url.includes('index.html')) return 'TVZA Family App';
      if (url.includes('public.html')) return 'TVZA Online';
      return 'Websites';
    }
  }

  function normalizeProjects(saved) {
    const normalized = {};
    if (saved && typeof saved === 'object') {
      Object.entries(saved).forEach(([id, project]) => {
        normalized[id] = {
          id,
          name: project.name || 'Projekt',
          custom: !!project.custom,
          tabs: Array.isArray(project.tabs) ? project.tabs : [],
          recents: Array.isArray(project.recents) ? project.recents : [],
          updatedAt: Number(project.updatedAt) || Date.now()
        };
      });
    }
    browserHistory.forEach(item => {
      const id = item.projectId || projectIdForUrl(item.url);
      const project = ensureProject(id, item.project || projectForUrl(item.url), item.url, normalized);
      if (!project) return;
      project.recents = [
        { title: titleFromUrl(item.url), url: item.url, visitedAt: item.visitedAt || Date.now() },
        ...project.recents.filter(recent => recent.url !== item.url)
      ].slice(0, 8);
    });
    return normalized;
  }

  function ensureProject(id, name, url = '', target = projects) {
    if (!id || id === 'project:start') return null;
    if (!target[id]) target[id] = { id, name, custom: id.startsWith('custom:'), tabs: [], recents: [], updatedAt: Date.now() };
    if (url && url !== START_URL && !target[id].tabs.some(tab => tab.url === url)) {
      target[id].tabs.push({ title: titleFromUrl(url), url, active: false });
    }
    return target[id];
  }

  function updateProjectFromTab(tab) {
    if (!tab || tab.url === START_URL) return;
    const project = ensureProject(tab.projectId, projectNameForId(tab.projectId, tab.url), tab.url);
    if (!project) return;
    project.updatedAt = Date.now();
    project.recents = [
      { title: titleFromUrl(tab.url), url: tab.url, visitedAt: Date.now() },
      ...project.recents.filter(item => item.url !== tab.url)
    ].slice(0, 8);

    const projectTabs = tabs
      .filter(openTab => openTab.projectId === tab.projectId && openTab.url !== START_URL)
      .map(openTab => ({ title: titleFromUrl(openTab.url), url: openTab.url, active: openTab.id === activeTabId }));
    project.tabs.forEach(savedTab => {
      if (!projectTabs.some(item => item.url === savedTab.url)) projectTabs.push(savedTab);
    });
    project.tabs = projectTabs.slice(0, 12);
  }

  function orderedProjects() {
    return Object.values(projects)
      .filter(project => project.id !== 'project:start' && (project.tabs.length || project.recents.length || project.custom))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  function navigate(raw, options = {}) {
    const tab = activeTab();
    const url = normalizeInput(raw);
    tab.url = url;
    tab.title = titleFromUrl(url);
    tab.projectId = targetProjectIdForNavigation(tab, url);

    if (options.replace) {
      tab.entries[tab.index] = url;
    } else {
      tab.entries = tab.entries.slice(0, tab.index + 1);
      tab.entries.push(url);
      tab.index = tab.entries.length - 1;
    }

    addHistory(tab);
    saveState();
    render();
  }

  function targetProjectIdForNavigation(tab, url) {
    if (tab?.projectId && projects[tab.projectId]?.custom) return tab.projectId;
    return projectIdForUrl(url);
  }

  function go(delta) {
    const tab = activeTab();
    const next = tab.index + delta;
    if (next < 0 || next >= tab.entries.length) return;
    tab.index = next;
    tab.url = tab.entries[tab.index];
    tab.title = titleFromUrl(tab.url);
    tab.projectId = targetProjectIdForNavigation(tab, tab.url);
    addHistory(tab);
    saveState();
    render();
  }

  function render() {
    const tab = activeTab();
    renderTabs();
    renderPage(tab);
    renderLists();
    updateButtons(tab);
    applyLayout();
  }

  function renderTabs() {
    tabStrip.innerHTML = tabs.map(tab => `
      <button class="browser-tab ${tab.id === activeTabId ? 'is-active' : ''}" type="button" data-tab="${tab.id}">
        <span class="browser-tab-title">${escapeHtml(tab.title)}</span>
        <span class="browser-tab-close" data-close="${tab.id}" aria-label="Tab schliessen">×</span>
      </button>
    `).join('');
  }

  function renderPage(tab) {
    addressInput.value = displayUrl(tab.url);
    heroSearchInput.value = '';

    if (tab.url === START_URL) {
      startPanel.hidden = false;
      frame.hidden = true;
      frame.removeAttribute('src');
      setStatus('Bereit');
      document.title = 'TVZA Browser';
      return;
    }

    startPanel.hidden = true;
    frame.hidden = false;
    frame.src = tab.url;
    document.title = `${tab.title} - TVZA Browser`;
    setStatus(`Lade ${tab.url}`);
  }

  function renderLists() {
    favoritesList.innerHTML = favorites.length
      ? favorites.map(itemButton).join('')
      : '<p class="browser-empty">Noch keine Favoriten.</p>';

    recentsList.innerHTML = browserHistory.length
      ? browserHistory.slice(0, 5).map(itemButton).join('')
      : '<p class="browser-empty">Noch keine Recents.</p>';

    historyList.innerHTML = orderedProjects().length
      ? renderProjectGroups()
      : '<p class="browser-empty">Noch kein Projektverlauf.</p>';
  }

  function renderProjectGroups() {
    return orderedProjects().map(project => `
      <div class="browser-project-group">
        <button class="browser-project-title" type="button" data-open-project="${escapeAttr(project.id)}">
          <span>${escapeHtml(project.name)}</span>
          <small>${project.tabs.length} Tabs</small>
        </button>
        ${project.recents.slice(0, 3).map(itemButton).join('')}
      </div>
    `).join('');
  }

  function itemButton(item) {
    return `
      <button type="button" data-url="${escapeAttr(item.url)}">
        <strong>${escapeHtml(titleFromUrl(item.url))}</strong>
        <small>${escapeHtml(item.url)}</small>
      </button>
    `;
  }

  function updateButtons(tab) {
    $('#backBtn').disabled = tab.index <= 0;
    $('#forwardBtn').disabled = tab.index >= tab.entries.length - 1;
    $('#favoriteBtn').classList.toggle('is-active', favorites.some(item => item.url === tab.url));
    $('#copyBtn').disabled = tab.url === START_URL;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, '&#39;');
  }

  function newTab(url = START_URL, projectId = null) {
    const normalized = normalizeInput(url);
    const inheritedProject = projectId || (activeTab()?.projectId && projects[activeTab().projectId]?.custom ? activeTab().projectId : null);
    const tab = makeTab(normalized);
    if (inheritedProject) tab.projectId = inheritedProject;
    tabs.push(tab);
    activeTabId = tab.id;
    updateProjectFromTab(tab);
    saveState();
    render();
  }

  function closeTab(id) {
    const index = tabs.findIndex(tab => tab.id === id);
    if (index === -1) return;
    tabs.splice(index, 1);
    if (!tabs.length) tabs.push(makeTab());
    if (activeTabId === id) activeTabId = tabs[Math.max(0, index - 1)].id;
    Object.values(projects).forEach(project => {
      const openUrls = new Set(tabs.filter(tab => tab.projectId === project.id).map(tab => tab.url));
      project.tabs = project.tabs.map(savedTab => ({ ...savedTab, active: openUrls.has(savedTab.url) }));
    });
    saveState();
    render();
  }

  function createProject() {
    const count = Object.values(projects).filter(project => project.custom).length + 1;
    const name = `Projekt ${count}`;
    const id = `custom:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid()}`;
    projects[id] = projects[id] || { id, name, custom: true, tabs: [], recents: [], updatedAt: Date.now() };
    newTab(START_URL, id);
    setStatus(`${name} wurde erstellt.`);
  }

  function openProject(projectId) {
    const project = projects[projectId];
    if (!project) return;
    if (!project.tabs.length) {
      newTab(START_URL, projectId);
      return;
    }

    const existingUrls = new Set(tabs.map(tab => tab.url));
    project.tabs.forEach(savedTab => {
      if (!existingUrls.has(savedTab.url)) {
        const restored = makeTab(savedTab.url);
        restored.projectId = projectId;
        tabs.push(restored);
      }
    });
    const target = tabs.find(tab => tab.projectId === projectId && tab.url === project.tabs[0].url)
      || tabs.find(tab => tab.projectId === projectId);
    if (target) activeTabId = target.id;
    project.updatedAt = Date.now();
    saveState();
    render();
  }

  function toggleFavorite() {
    const tab = activeTab();
    if (tab.url === START_URL) return;
    const exists = favorites.some(item => item.url === tab.url);
    favorites = exists
      ? favorites.filter(item => item.url !== tab.url)
      : [{ title: tab.title, url: tab.url }, ...favorites].slice(0, 30);
    saveState();
    renderLists();
    updateButtons(tab);
    setStatus(exists ? 'Favorit entfernt' : 'Favorit gespeichert');
  }

  function applyLayout() {
    layout.assistantWidth = clamp(layout.assistantWidth, 320, assistantMaxWidth());
    document.documentElement.style.setProperty('--browser-sidebar-width', `${layout.sidebarWidth}px`);
    document.documentElement.style.setProperty('--assistant-width', `${layout.assistantWidth}px`);
    browserWorkspace.classList.toggle('is-sidebar-closed', layout.sidebarMode === 'closed');
  }

  function openSidebarTo(sectionId = '') {
    layout.sidebarMode = 'normal';
    layout.sidebarWidth = Math.max(layout.sidebarWidth, 240);
    applyLayout();
    saveLayout();
    if (!sectionId) return;
    window.requestAnimationFrame(() => {
      const section = document.getElementById(sectionId);
      section?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  function startResize(kind, event) {
    event.preventDefault();
    const startX = event.clientX;
    const initialSidebar = layout.sidebarWidth;
    const initialAssistant = layout.assistantWidth;

    function move(moveEvent) {
      if (kind === 'left') {
        layout.sidebarMode = 'normal';
        layout.sidebarWidth = clamp(initialSidebar + moveEvent.clientX - startX, 180, 460);
      } else {
        layout.assistantWidth = clamp(initialAssistant + startX - moveEvent.clientX, 320, assistantMaxWidth());
      }
      applyLayout();
    }

    function end() {
      saveLayout();
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    }

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  }

  function assistantPrompt() {
    const tab = activeTab();
    return tab.url === START_URL
      ? 'Help me browse, research, and build inside the TVZA Browser.'
      : `Help me with this page: ${tab.url}`;
  }

  async function copyAssistantPrompt() {
    try {
      await navigator.clipboard.writeText(assistantPrompt());
      setStatus('Claude Kontext wurde kopiert.');
    } catch (error) {
      setStatus('Kopieren ist in diesem Browser nicht verfügbar.');
    }
  }

  function openAssistantExternal() {
    window.open(assistantUrl(), '_blank', 'noopener');
  }

  async function openAssistant() {
    const provider = settings.assistantProvider === 'custom' ? 'AI Assistant' : settings.assistantProvider;
    assistantFrame.src = assistantUrl();
    assistantDrawer.hidden = false;
    try {
      await navigator.clipboard.writeText(assistantPrompt());
      setStatus(`${provider} Seitenleiste geöffnet. Kontext wurde kopiert.`);
    } catch (error) {
      setStatus(`${provider} Seitenleiste geöffnet.`);
    }
  }

  function closeAssistant() {
    assistantDrawer.hidden = true;
  }

  function openTvzaApp() {
    tvzaSideApp.hidden = false;
    if (tvzaLoggedIn) {
      tvzaFamilyFrame.src = TVZA_INDEX_URL;
      setStatus('TVZA Family App links geöffnet.');
      return;
    }
    tvzaFamilyFrame.removeAttribute('src');
    setStatus('Bitte bei TVZA einloggen.');
  }

  function closeTvzaApp() {
    tvzaSideApp.hidden = true;
  }

  function openTvzaFull() {
    navigate(tvzaLoggedIn ? TVZA_INDEX_URL : TVZA_LOGIN_URL);
  }

  async function initTvzaHomeIntegration() {
    try {
      const { auth, getProfile } = await import('./firebase-config.js');
      auth.onAuthStateChanged(async user => {
        tvzaLoggedIn = !!user;
        if (!user) {
          tvzaSignedOutPanel.hidden = false;
          tvzaSideSignedOut.hidden = false;
          tvzaSideLoginBtn.hidden = false;
          tvzaSideFullBtn.textContent = 'Login im Tab';
          tvzaFamilyFrame.removeAttribute('src');
          tvzaUserLine.textContent = 'Melde dich an, um TVZA hier zu nutzen.';
          tvzaSidebarStatus.textContent = 'Einloggen benötigt';
          tvzaHomeHint.textContent = 'Öffne TVZA links als Sidebar-App. Zum Entsperren nutzt du den normalen TVZA Login.';
          loginPromptBtn.textContent = 'Einloggen';
          loginPromptBtn.dataset.url = TVZA_LOGIN_URL;
          return;
        }

        const profile = await getProfile(user);
        const name = profile.displayName || user.displayName || user.email || 'TVZA';
        tvzaUserLine.textContent = `${name} ist angemeldet.`;
        if (!tvzaSideApp.hidden) tvzaFamilyFrame.src = TVZA_INDEX_URL;
        tvzaSignedOutPanel.hidden = true;
        tvzaSideSignedOut.hidden = true;
        tvzaSideLoginBtn.hidden = true;
        tvzaSideFullBtn.textContent = 'Im Tab öffnen';
        tvzaSidebarStatus.textContent = name.length > 22 ? `${name.slice(0, 20)}…` : name;
        tvzaHomeHint.textContent = 'TVZA Family ist bereit und links als Sidebar-App angeheftet.';
        loginPromptBtn.textContent = name.length > 18 ? `${name.slice(0, 16)}…` : name;
        loginPromptBtn.dataset.url = 'browser-settings.html';
      });
    } catch (error) {
      tvzaSignedOutPanel.hidden = false;
      tvzaSideSignedOut.hidden = false;
      tvzaSidebarStatus.textContent = 'Firebase prüfen';
    }
  }

  $('#addressForm').addEventListener('submit', event => {
    event.preventDefault();
    navigate(addressInput.value);
  });

  $('#heroSearchForm').addEventListener('submit', event => {
    event.preventDefault();
    navigate(heroSearchInput.value);
  });

  $('#newTabBtn').addEventListener('click', () => newTab());
  $('#newProjectBtn').addEventListener('click', createProject);
  $('#backBtn').addEventListener('click', () => go(-1));
  $('#forwardBtn').addEventListener('click', () => go(1));
  $('#homeBtn').addEventListener('click', () => navigate(homeTarget()));
  $('#favoriteBtn').addEventListener('click', toggleFavorite);
  $('#assistantBtn').addEventListener('click', openAssistant);
  $('#assistantHomeBtn').addEventListener('click', openAssistant);
  $('#assistantCloseBtn').addEventListener('click', closeAssistant);
  $('#assistantExternalBtn').addEventListener('click', openAssistantExternal);
  $('#assistantCopyBtn').addEventListener('click', copyAssistantPrompt);
  $('#loginPromptBtn').addEventListener('click', () => navigate(loginPromptBtn.dataset.url || TVZA_LOGIN_URL));
  $('#railTvzaBtn').addEventListener('click', openTvzaApp);
  $('#sidebarTvzaAppBtn').addEventListener('click', openTvzaApp);
  $('#tvzaHomeOpenBtn').addEventListener('click', openTvzaApp);
  $('#tvzaSideCloseBtn').addEventListener('click', closeTvzaApp);
  tvzaSideLoginBtn.addEventListener('click', () => navigate(TVZA_LOGIN_URL));
  tvzaSideFullBtn.addEventListener('click', openTvzaFull);
  $('#sidebarCloseBtn').addEventListener('click', () => {
    layout.sidebarMode = 'closed';
    applyLayout();
    saveLayout();
  });
  $('#sidebarOpenBtn').addEventListener('click', () => openSidebarTo());
  $('#railFavoritesBtn').addEventListener('click', () => openSidebarTo('sideFavoritesSection'));
  $('#railProjectsBtn').addEventListener('click', () => openSidebarTo('sideProjectsSection'));
  $('#leftResizer').addEventListener('pointerdown', event => startResize('left', event));
  $('#rightResizer').addEventListener('pointerdown', event => startResize('right', event));

  $('#reloadBtn').addEventListener('click', () => {
    const tab = activeTab();
    if (tab.url === START_URL) return;
    frame.src = tab.url;
    setStatus(`Neu geladen: ${tab.url}`);
  });

  $('#copyBtn').addEventListener('click', async () => {
    const tab = activeTab();
    if (tab.url === START_URL) return;
    try {
      await navigator.clipboard.writeText(tab.url);
      setStatus('Adresse kopiert');
    } catch (error) {
      setStatus('Kopieren ist in diesem Browser nicht verfügbar');
    }
  });

  tabStrip.addEventListener('click', event => {
    const close = event.target.closest('[data-close]');
    if (close) {
      closeTab(close.dataset.close);
      return;
    }
    const tabButton = event.target.closest('[data-tab]');
    if (!tabButton) return;
    activeTabId = tabButton.dataset.tab;
    saveState();
    render();
  });

  document.addEventListener('click', event => {
    const projectOpen = event.target.closest('[data-open-project]');
    if (projectOpen) {
      openProject(projectOpen.dataset.openProject);
      return;
    }
    const shortcut = event.target.closest('[data-url]');
    if (!shortcut) return;
    navigate(shortcut.dataset.url);
  });

  frame.addEventListener('load', () => {
    const tab = activeTab();
    if (tab.url !== START_URL) setStatus(`Geöffnet: ${tab.url}`);
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
      event.preventDefault();
      addressInput.focus();
      addressInput.select();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 't') {
      event.preventDefault();
      newTab();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'w') {
      event.preventDefault();
      closeTab(activeTabId);
    }
    if (event.key === 'Escape' && !assistantDrawer.hidden) closeAssistant();
    if (event.key === 'Escape' && !tvzaSideApp.hidden) closeTvzaApp();
  });

  window.addEventListener('storage', event => {
    if (event.key === SETTINGS_KEY) settings = readSettings();
  });
  window.addEventListener('resize', () => {
    applyLayout();
    saveLayout();
  });

  initTvzaHomeIntegration();
  applyLayout();
  render();
})();
