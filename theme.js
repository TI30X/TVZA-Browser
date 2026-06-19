(() => {
  const KEY = 'tvza-theme';
  const MODES = ['auto', 'dark', 'light'];
  const MEDIA = window.matchMedia('(prefers-color-scheme: dark)');

  function storedMode() {
    const saved = localStorage.getItem(KEY);
    return MODES.includes(saved) ? saved : 'auto';
  }

  function effectiveTheme(mode = storedMode()) {
    return mode === 'auto' ? (MEDIA.matches ? 'dark' : 'light') : mode;
  }

  function applyTheme(mode = storedMode()) {
    const theme = effectiveTheme(mode);
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themeMode = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = '#1A1A2E';
    window.dispatchEvent(new CustomEvent('tvza-theme-change', { detail: { mode, theme } }));
  }

  window.TVZATheme = {
    getMode: storedMode,
    toggleMode() {
      const mode = storedMode();
      const next = mode === 'auto' ? 'dark' : mode === 'dark' ? 'light' : 'auto';
      localStorage.setItem(KEY, next);
      applyTheme(next);
    },
    applyTheme
  };

  MEDIA.addEventListener?.('change', () => {
    if (storedMode() === 'auto') applyTheme('auto');
  });

  // Auto-wire any toggle button on the page (id="themeToggle" or [data-theme-toggle]).
  function wireToggle(btn) {
    if (!btn || btn.dataset.tvzaWired) return;
    btn.dataset.tvzaWired = '1';
    const update = () => {
      const mode = storedMode();
      const theme = effectiveTheme(mode);
      btn.textContent = mode === 'auto' ? '◐' : theme === 'dark' ? '☾' : '☀';
      btn.title = mode === 'auto'
        ? 'Theme: automatisch'
        : theme === 'dark'
          ? 'Theme: dunkel'
          : 'Theme: hell';
    };
    btn.addEventListener('click', () => window.TVZATheme.toggleMode());
    window.addEventListener('tvza-theme-change', update);
    update();
  }

  function wireAll() {
    document.querySelectorAll('#themeToggle, [data-theme-toggle]').forEach(wireToggle);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireAll);
  } else {
    wireAll();
  }

  applyTheme();
})();
