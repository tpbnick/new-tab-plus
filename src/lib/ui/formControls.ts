import { parseCssColor, replaceRgbaColor, rgbToHex } from '../theme/colorUtils';
import { snapPercent } from './percentSnap';

export function createOptionsRow(label: string, input: HTMLElement): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'options-row';
  const span = document.createElement('span');
  span.textContent = label;
  wrap.append(span, input);
  return wrap;
}

export function createCheckboxInput(
  checked: boolean,
  onChange: (value: boolean) => void
): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'checkbox';
  el.checked = checked;
  el.addEventListener('change', () => onChange(el.checked));
  return el;
}

export function createTextInput(
  value: string,
  onChange: (value: string) => void,
  event: 'input' | 'change' = 'input'
): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'text';
  el.value = value;
  el.addEventListener(event, () => onChange(el.value));
  return el;
}

export function createNumberInput(
  value: number,
  onChange: (value: number) => void,
  opts: { min?: number; max?: number; step?: number; event?: 'input' | 'change' } = {}
): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'number';
  el.value = String(value);
  if (opts.min !== undefined) el.min = String(opts.min);
  if (opts.max !== undefined) el.max = String(opts.max);
  if (opts.step !== undefined) el.step = String(opts.step);
  const eventName = opts.event ?? 'input';
  el.addEventListener(eventName, () => {
    const next = Number(el.value);
    if (!Number.isFinite(next)) return;
    onChange(next);
  });
  return el;
}

export function createSelectInput(
  value: string,
  choices: { value: string; label: string }[],
  onChange: (value: string) => void,
  className?: string
): HTMLSelectElement {
  const el = document.createElement('select');
  if (className) el.className = className;
  for (const choice of choices) {
    const optionEl = document.createElement('option');
    optionEl.value = choice.value;
    optionEl.textContent = choice.label;
    optionEl.selected = choice.value === value;
    el.appendChild(optionEl);
  }
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

export function createColorInput(value: string, onChange: (value: string) => void): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'color';
  el.value = value;
  el.addEventListener('input', () => onChange(el.value));
  return el;
}

function normalizeColorForInput(value: string): string {
  const rgb = parseCssColor(value);
  return rgb ? rgbToHex(rgb) : '#000000';
}

export function createNormalizedColorInput(
  value: string,
  onChange: (value: string) => void
): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'color';
  el.value = normalizeColorForInput(value);
  el.addEventListener('input', () => onChange(el.value));
  return el;
}

export function createRgbaColorInput(value: string, onChange: (value: string) => void): HTMLInputElement {
  let currentValue = value;
  const el = document.createElement('input');
  el.type = 'color';
  el.value = normalizeColorForInput(value);
  el.addEventListener('input', () => {
    const rgb = parseCssColor(el.value);
    if (!rgb) return;
    currentValue = replaceRgbaColor(currentValue, rgb);
    onChange(currentValue);
  });
  return el;
}

/** Slider plus editable number input for precise values. */
export function createRangeRow(
  label: string,
  value: number,
  onChange: (value: number) => void,
  min: number,
  max: number,
  step = 1,
  unit = ''
): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'options-row options-row--range';
  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;

  const controls = document.createElement('div');
  controls.className = 'options-range-controls';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(value);

  const numberBox = document.createElement('input');
  numberBox.type = 'number';
  numberBox.className = 'options-range-input';
  numberBox.min = String(min);
  numberBox.max = String(max);
  numberBox.step = String(step);
  numberBox.value = String(value);
  numberBox.setAttribute('aria-label', `${label} value`);

  const decimalPlaces = step < 1 ? String(step).split('.')[1]?.length ?? 2 : 0;

  function formatValue(n: number): string {
    return decimalPlaces > 0 ? n.toFixed(decimalPlaces).replace(/\.?0+$/, '') : String(n);
  }

  function updateRangeFill(): void {
    const raw = Number(slider.value);
    const pct = max === min ? 0 : ((raw - min) / (max - min)) * 100;
    slider.style.setProperty('--range-fill', `${pct}%`);
  }

  function applyValue(raw: number): void {
    if (!Number.isFinite(raw)) return;
    let next = Math.min(max, Math.max(min, raw));
    if (unit === '%') {
      next = snapPercent(next, min, max, step);
    }
    slider.value = String(next);
    numberBox.value = formatValue(next);
    onChange(next);
    updateRangeFill();
  }

  updateRangeFill();

  slider.addEventListener('input', () => applyValue(Number(slider.value)));
  numberBox.addEventListener('input', () => applyValue(Number(numberBox.value)));
  numberBox.addEventListener('change', () => applyValue(Number(numberBox.value)));

  controls.append(slider);
  if (unit) {
    const numberWrap = document.createElement('div');
    numberWrap.className = 'options-range-input-wrap';
    const unitSuffix = document.createElement('span');
    unitSuffix.className = 'options-range-unit';
    unitSuffix.textContent = unit;
    unitSuffix.setAttribute('aria-hidden', 'true');
    numberWrap.append(numberBox, unitSuffix);
    controls.append(numberWrap);
  } else {
    controls.append(numberBox);
  }

  wrap.append(labelSpan, controls);
  return wrap;
}
