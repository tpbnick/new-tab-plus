import { renderSettingsPanel, SETTINGS_SECTIONS, type SettingsDeps, type SettingsSectionName } from '../lib/settings/settingsPanels';
import { trapTabKey } from '../lib/a11y/focusTrap';

const PANEL_WIDTH_STORAGE_KEY = 'new-tab-plus:settings-panel-width';
const PANEL_DEFAULT_WIDTH_EM = 35;
const PANEL_MAX_WIDTH_EM = 70;

export interface SettingsModal {
  element: HTMLElement;
  toggle(): void;
  open(): void;
  close(): void;
}

function panelWidthEmToPx(modal: HTMLElement, em: number): number {
  const fontSize = parseFloat(getComputedStyle(modal).fontSize);
  return em * fontSize;
}

function getPanelWidthBounds(modal: HTMLElement): { min: number; max: number } {
  const insetInline = parseFloat(getComputedStyle(modal).getPropertyValue('--settings-inset-inline')) || 16;
  const viewportMax = window.innerWidth - insetInline * 2;
  const min = Math.min(panelWidthEmToPx(modal, PANEL_DEFAULT_WIDTH_EM), viewportMax);
  const max = Math.min(panelWidthEmToPx(modal, PANEL_MAX_WIDTH_EM), viewportMax);
  return { min, max: Math.max(min, max) };
}

function clampPanelWidth(modal: HTMLElement, widthPx: number): number {
  const { min, max } = getPanelWidthBounds(modal);
  return Math.min(max, Math.max(min, widthPx));
}

function persistPanelWidth(widthPx: number): void {
  try {
    localStorage.setItem(PANEL_WIDTH_STORAGE_KEY, String(Math.round(widthPx)));
  } catch {
    /* ignore */
  }
}

function loadStoredPanelWidth(): number | null {
  try {
    const saved = localStorage.getItem(PANEL_WIDTH_STORAGE_KEY);
    if (!saved) return null;
    const width = parseFloat(saved);
    return Number.isFinite(width) ? width : null;
  } catch {
    return null;
  }
}

function applyPanelWidth(modal: HTMLElement, widthPx: number, persist = true): void {
  const clamped = clampPanelWidth(modal, widthPx);
  modal.style.width = `${clamped}px`;
  if (persist) persistPanelWidth(clamped);
}

function attachPanelResize(host: HTMLElement): void {
  const handle = document.createElement('div');
  handle.className = 'settings-modal__resize';
  handle.setAttribute('aria-hidden', 'true');
  handle.title = 'Drag to resize';
  handle.innerHTML =
    '<span class="settings-modal__resize-icon" aria-hidden="true">' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M9 7 5 12l4 5"/><path d="M15 7l4 5-4 5"/>' +
    '</svg></span>';
  host.prepend(handle);

  const stored = loadStoredPanelWidth();
  if (stored != null) {
    applyPanelWidth(host, stored, false);
  }

  let dragging = false;

  const stopDrag = (): void => {
    if (!dragging) return;
    dragging = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  handle.addEventListener('mousedown', (event) => {
    event.preventDefault();
    dragging = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    const right = host.getBoundingClientRect().right;
    applyPanelWidth(host, right - event.clientX);
  });

  document.addEventListener('mouseup', stopDrag);
  window.addEventListener('blur', stopDrag);

  window.addEventListener('resize', () => {
    applyPanelWidth(host, host.getBoundingClientRect().width, false);
  });
}

export function createSettingsModal(deps: SettingsDeps): SettingsModal {
  let currentSection: SettingsSectionName = 'Bookmarks';
  let focusBeforeOpen: HTMLElement | null = null;

  const host = document.createElement('div');
  host.className = 'settings-modal-host';
  host.hidden = true;

  const modal = document.createElement('div');
  modal.className = 'settings-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'settings-modal-title');

  const header = document.createElement('div');
  header.className = 'settings-modal__header';
  const title = document.createElement('h2');
  title.id = 'settings-modal-title';
  title.textContent = 'Settings';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'settings-modal__close';
  closeBtn.setAttribute('aria-label', 'Close settings');
  closeBtn.title = 'Close (Esc)';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => close());
  header.append(title, closeBtn);

  const nav = document.createElement('nav');
  nav.className = 'settings-modal__nav';
  nav.setAttribute('aria-label', 'Settings sections');
  const navButtons = new Map<SettingsSectionName, HTMLButtonElement>();
  for (const name of SETTINGS_SECTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = name;
    btn.addEventListener('click', () => showSection(name));
    navButtons.set(name, btn);
    nav.appendChild(btn);
  }

  const content = document.createElement('div');
  content.className = 'settings-modal__content';

  modal.append(header, nav, content);
  host.appendChild(modal);
  attachPanelResize(host);

  deps.refreshPanel = () => showSection(currentSection);

  function showSection(name: SettingsSectionName): void {
    currentSection = name;
    navButtons.forEach((btn, btnName) => btn.classList.toggle('active', btnName === name));
    content.innerHTML = '';
    renderSettingsPanel(name, content, deps);
  }

  function open(): void {
    focusBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    host.hidden = false;
    showSection(currentSection);
    closeBtn.focus();
  }

  function close(): void {
    deps.flushPendingSaves();
    host.hidden = true;
    focusBeforeOpen?.focus();
    focusBeforeOpen = null;
  }

  function toggle(): void {
    if (host.hidden) open();
    else close();
  }

  function onDocumentKeyDown(event: KeyboardEvent): void {
    if (host.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    trapTabKey(modal, event);
  }

  document.addEventListener('keydown', onDocumentKeyDown);

  return { element: host, toggle, open, close };
}
