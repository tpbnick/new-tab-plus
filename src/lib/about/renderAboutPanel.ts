import {
  APP_TAGLINE,
  APP_VERSION,
  AUTHOR_NAME,
  AUTHOR_URL,
  GITHUB_ISSUES_URL,
  GITHUB_LICENSE_URL,
  GITHUB_REPO_URL,
  LATEST_CHANGE,
} from './appMeta.generated';
import type { SettingsDeps } from '../settings/settingsPanels';
import { createCheckboxInput as checkbox, createOptionsRow as row } from '../ui/formControls';

function externalLink(href: string, label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  return link;
}

function formatChangeDate(date: string): string {
  if (date === '—') return date;
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function latestChangeValue(commitUrl: string, shortSha: string, date: string): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'about-panel__latest-change-wrap';
  wrap.append(
    latestChangeLink(commitUrl, shortSha),
    document.createTextNode(` (${formatChangeDate(date)})`)
  );
  return wrap;
}

function latestChangeLink(commitUrl: string, shortSha: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = commitUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.className = 'about-panel__latest-change';
  link.setAttribute('aria-label', `View commit ${shortSha} on GitHub`);

  const sha = document.createElement('span');
  sha.className = 'about-panel__latest-change-sha';
  sha.textContent = shortSha;

  const icon = document.createElement('span');
  icon.className = 'about-panel__github-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.18.82.63-.18 1.28-.27 1.94-.27.66 0 1.31.09 1.94.27 1.51-1.04 2.18-.82 2.18-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>';

  link.append(sha, icon);
  return link;
}

function aboutRow(label: string): { row: HTMLElement; value: HTMLElement } {
  const rowEl = document.createElement('p');
  rowEl.className = 'about-panel__row';

  const labelEl = document.createElement('span');
  labelEl.className = 'about-panel__label';
  labelEl.textContent = label;

  const value = document.createElement('span');
  value.className = 'about-panel__value';

  rowEl.append(labelEl, value);
  return { row: rowEl, value };
}

export function renderAboutPanel(
  container: HTMLElement,
  deps: Pick<SettingsDeps, 'options' | 'saveOptionsNow' | 'onCheckForUpdatesChange'>
): void {
  const panel = document.createElement('div');
  panel.className = 'about-panel';

  const logo = document.createElement('img');
  logo.className = 'about-panel__logo';
  logo.src = chrome.runtime.getURL('icons/icon-128.png');
  logo.width = 64;
  logo.height = 64;
  logo.alt = 'New Tab Plus';

  const title = document.createElement('h3');
  title.className = 'about-panel__title';
  title.textContent = 'New Tab Plus';

  const tagline = document.createElement('p');
  tagline.className = 'about-panel__tagline';
  tagline.textContent = APP_TAGLINE;

  const version = aboutRow('Version');
  version.value.textContent = APP_VERSION;

  const github = aboutRow('GitHub');
  github.value.appendChild(externalLink(GITHUB_REPO_URL, 'tpbnick/new-tab-plus'));

  const latest = aboutRow('Latest change');
  latest.value.appendChild(
    latestChangeValue(LATEST_CHANGE.commitUrl, LATEST_CHANGE.shortSha, LATEST_CHANGE.date)
  );

  const license = aboutRow('License');
  license.value.appendChild(externalLink(GITHUB_LICENSE_URL, 'MIT License'));

  const support = aboutRow('Support');
  support.value.appendChild(externalLink(GITHUB_ISSUES_URL, 'Report an issue'));

  const updatesSetting = row(
    'Check for updates',
    checkbox(deps.options.general.checkForUpdates, (enabled) => {
      deps.options.general.checkForUpdates = enabled;
      deps.saveOptionsNow();
      deps.onCheckForUpdatesChange?.(enabled);
    })
  );
  updatesSetting.classList.add('about-panel__updates-setting');

  const credit = document.createElement('p');
  credit.className = 'about-panel__credit';
  credit.append('Built with ', document.createTextNode('♥'), ' by ');
  credit.appendChild(externalLink(AUTHOR_URL, AUTHOR_NAME));

  panel.append(
    logo,
    title,
    tagline,
    version.row,
    github.row,
    latest.row,
    license.row,
    support.row,
    updatesSetting,
    credit
  );
  container.appendChild(panel);
}
