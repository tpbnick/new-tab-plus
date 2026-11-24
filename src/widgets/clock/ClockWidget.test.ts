import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clockWidgetDefinition, type ClockSettings } from './ClockWidget';

function makeSettings(overrides: Partial<ClockSettings> = {}): ClockSettings {
  return {
    style: 'minimal',
    format24h: true,
    showSeconds: false,
    showDate: false,
    ...overrides,
  };
}

describe('ClockWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates style before adding CSS class and falls back to minimal', () => {
    const container = document.createElement('div');
    const settings = makeSettings({ style: 'bogus style' as ClockSettings['style'] });
    const instance = clockWidgetDefinition.create(container, settings, {
      instanceId: 'clock',
      getSetting: <T>(key: string) => settings[key as keyof ClockSettings] as T,
      saveSettings: vi.fn(async () => {}),
    });

    instance.render();
    expect(container.classList.contains('clock-widget')).toBe(true);
    expect(container.classList.contains('clock-widget--minimal')).toBe(true);
    expect(container.className).not.toContain('bogus');
    instance.destroy();
  });

  it('re-syncs to minute boundaries with chained setTimeout instead of drifting setInterval', () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout');

    // Start at 10:00:20.000 -> 40s until 10:01:00
    vi.setSystemTime(new Date(2026, 5, 1, 10, 0, 20, 0));

    const container = document.createElement('div');
    const settings = makeSettings({ showSeconds: false, format24h: true });
    const instance = clockWidgetDefinition.create(container, settings, {
      instanceId: 'clock',
      getSetting: <T>(key: string) => settings[key as keyof ClockSettings] as T,
      saveSettings: vi.fn(async () => {}),
    });

    instance.render();
    expect(container.querySelector('.clock-widget__time')?.textContent).toBe('10:00');
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 40_000);

    // Simulate OS sleep / throttling: clock drifts +15s before the 40s timer fires (wakes at 10:01:15)
    vi.setSystemTime(new Date(2026, 5, 1, 10, 0, 35, 0));
    vi.advanceTimersToNextTimer();

    expect(container.querySelector('.clock-widget__time')?.textContent).toBe('10:01');
    expect(setIntervalSpy).not.toHaveBeenCalled();
    // Next timeout re-aligns to 10:02:00 (45_000ms), NOT blindly waiting 60_000ms!
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 45_000);

    instance.destroy();
  });
});
