import { describe, expect, it, vi } from 'vitest';
import { weatherWidgetDefinition } from './WeatherWidget';

describe('weather location reset', () => {
  it('clears stored coordinates when the location field is emptied', async () => {
    const settings = {
      locationQuery: '',
      locationName: 'Seattle',
      resolvedQuery: 'Seattle',
      latitude: 47.6,
      longitude: -122.3,
      tempUnit: 'fahrenheit' as const,
      ttlMinutes: 20,
    };
    const saveSettings = vi.fn(async (partial: Record<string, unknown>) => {
      Object.assign(settings, partial);
    });
    const container = document.createElement('div');
    const instance = weatherWidgetDefinition.create(container, settings, {
      instanceId: 'weather',
      getSetting: <T>(key: string) => settings[key as keyof typeof settings] as T,
      saveSettings,
    });

    await instance.render();

    expect(saveSettings).toHaveBeenCalledWith({
      locationQuery: '',
      latitude: null,
      longitude: null,
      locationName: '',
      resolvedQuery: '',
    });
    expect(container.textContent).toContain('Set a location');
    instance.destroy();
  });
});
