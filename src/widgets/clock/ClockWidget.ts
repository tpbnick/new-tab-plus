import type { WidgetDefinition, WidgetInstance, WidgetSettingsField } from '../contract';

export interface ClockSettings {
  [key: string]: unknown;
  style: 'minimal' | 'bold' | 'compact';
  format24h: boolean;
  showSeconds: boolean;
  showDate: boolean;
}

const defaultSettings: ClockSettings = {
  style: 'minimal',
  format24h: false,
  showSeconds: false,
  showDate: true,
};

const settingsSchema: WidgetSettingsField[] = [
  {
    key: 'style',
    label: 'Style',
    type: 'select',
    options: [
      { value: 'minimal', label: 'Minimal' },
      { value: 'bold', label: 'Bold' },
      { value: 'compact', label: 'Compact' },
    ],
    default: 'minimal',
  },
  { key: 'format24h', label: '24-hour format', type: 'boolean', default: false },
  { key: 'showSeconds', label: 'Show seconds', type: 'boolean', default: false },
  { key: 'showDate', label: 'Show date', type: 'boolean', default: true },
];

const STYLE_CLASSES = ['clock-widget--minimal', 'clock-widget--bold', 'clock-widget--compact'] as const;

function formatTime(date: Date, settings: ClockSettings): string {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  let suffix = '';

  if (!settings.format24h) {
    if (settings.style === 'compact') {
      suffix = hours >= 12 ? 'p' : 'a';
    } else {
      suffix = hours >= 12 ? ' PM' : ' AM';
    }
    hours = hours % 12 || 12;
  }

  const hoursStr = settings.format24h ? String(hours).padStart(2, '0') : String(hours);
  return settings.showSeconds ? `${hoursStr}:${minutes}:${seconds}${suffix}` : `${hoursStr}:${minutes}${suffix}`;
}

function formatDate(date: Date, settings: ClockSettings): string {
  if (settings.style === 'compact') {
    return date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
  }

  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

class ClockWidgetInstance implements WidgetInstance {
  private destroyed = false;
  private intervalId: number | undefined;
  private timeoutId: number | undefined;

  constructor(
    private container: HTMLElement,
    private settings: ClockSettings
  ) {}

  render(): void {
    if (this.destroyed) return;
    window.clearInterval(this.intervalId);
    window.clearTimeout(this.timeoutId);
    this.container.innerHTML = '';
    this.container.classList.remove(...STYLE_CLASSES);
    this.container.classList.add('clock-widget', `clock-widget--${this.settings.style}`);

    const timeEl = document.createElement('div');
    timeEl.className = 'clock-widget__time';
    const dateEl = document.createElement('div');
    dateEl.className = 'clock-widget__date';
    this.container.append(timeEl, dateEl);

    const tick = () => {
      const now = new Date();
      timeEl.textContent = formatTime(now, this.settings);
      dateEl.hidden = !this.settings.showDate;
      if (this.settings.showDate) dateEl.textContent = formatDate(now, this.settings);
    };

    tick();
    if (this.settings.showSeconds) {
      this.intervalId = window.setInterval(tick, 1000);
      return;
    }

    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    this.timeoutId = window.setTimeout(() => {
      if (this.destroyed) return;
      tick();
      if (this.destroyed) return;
      this.intervalId = window.setInterval(tick, 60_000);
    }, msToNextMinute);
  }

  refresh(): void {
    this.render();
  }

  destroy(): void {
    this.destroyed = true;
    window.clearInterval(this.intervalId);
    window.clearTimeout(this.timeoutId);
  }
}

export const clockWidgetDefinition: WidgetDefinition<ClockSettings> = {
  id: 'clock',
  displayName: 'Clock',
  description: 'Minimal, bold, or compact (smallest footprint) clock styles.',
  settingsSchema,
  defaultSettings,
  create(container, settings) {
    return new ClockWidgetInstance(container, settings);
  },
};
