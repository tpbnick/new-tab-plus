const THEME_KEY = 'ntp-docs-theme';

const toggleBtn = document.getElementById('theme-toggle');

function getTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

function updateToggle() {
  if (!toggleBtn) return;
  const theme = getTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  toggleBtn.dataset.theme = theme;
  toggleBtn.setAttribute('aria-label', `Switch to ${next} mode`);
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage access errors (e.g. restricted privacy modes).
  }
  updateToggle();
}

toggleBtn?.addEventListener('click', () => {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
});

updateToggle();
