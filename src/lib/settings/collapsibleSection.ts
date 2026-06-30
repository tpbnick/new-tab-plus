const collapsedSettingsSections = new Map<string, boolean>();

export function collapsibleSection(
  id: string,
  title: string,
  build: (body: HTMLElement) => void
): HTMLElement {
  const section = document.createElement('section');
  section.className = 'options-collapsible';
  const startCollapsed = collapsedSettingsSections.get(id) ?? false;
  if (startCollapsed) section.classList.add('is-collapsed');

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'options-collapsible__header';
  header.setAttribute('aria-expanded', String(!startCollapsed));

  const chevron = document.createElement('span');
  chevron.className = 'options-collapsible__chevron';
  chevron.setAttribute('aria-hidden', 'true');

  const titleEl = document.createElement('span');
  titleEl.className = 'options-collapsible__title';
  titleEl.textContent = title;

  header.append(titleEl, chevron);

  const body = document.createElement('div');
  body.className = 'options-collapsible__body';
  const inner = document.createElement('div');
  inner.className = 'options-collapsible__inner';
  body.appendChild(inner);
  build(inner);

  header.addEventListener('click', () => {
    const collapsed = section.classList.toggle('is-collapsed');
    header.setAttribute('aria-expanded', String(!collapsed));
    collapsedSettingsSections.set(id, collapsed);
  });

  section.append(header, body);
  return section;
}

export function fieldsetTitle(text: string): HTMLHeadingElement {
  const title = document.createElement('h3');
  title.className = 'options-fieldset__title';
  title.textContent = text;
  return title;
}
