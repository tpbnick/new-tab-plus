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

function externalLink(href: string, label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  return link;
}

function aboutRow(label: string): { row: HTMLElement; value: HTMLElement } {
  const row = document.createElement('p');
  row.className = 'about-panel__row';

  const labelEl = document.createElement('span');
  labelEl.className = 'about-panel__label';
  labelEl.textContent = label;

  const value = document.createElement('span');
  value.className = 'about-panel__value';

  row.append(labelEl, value);
  return { row, value };
}

function formatChangeDate(date: string): string {
  if (date === '—') return date;
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function renderAboutPanel(container: HTMLElement): void {
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
  latest.value.append(
    externalLink(LATEST_CHANGE.commitUrl, LATEST_CHANGE.shortSha),
    document.createTextNode(` — ${LATEST_CHANGE.message} (${formatChangeDate(LATEST_CHANGE.date)})`)
  );

  const license = aboutRow('License');
  license.value.appendChild(externalLink(GITHUB_LICENSE_URL, 'MIT License'));

  const support = aboutRow('Support');
  support.value.appendChild(externalLink(GITHUB_ISSUES_URL, 'Report an issue'));

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
    credit
  );
  container.appendChild(panel);
}
