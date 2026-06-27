import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultLayoutState } from '../storage/schema';
import { registerBuiltinWidgets } from '../../widgets/registerAll';
import {
  dedupeBuiltinWidgetColumns,
  isBuiltinWidgetEnabled,
  setBuiltinWidgetEnabled,
} from './widgetLayout';

beforeEach(() => {
  registerBuiltinWidgets();
});

describe('widgetLayout', () => {
  it('creates a widget column when enabled and none exists', () => {
    const layout = createDefaultLayoutState();
    expect(isBuiltinWidgetEnabled(layout, 'weather')).toBe(false);

    setBuiltinWidgetEnabled(layout, 'weather', true);

    const col = layout.columns.find((c) => c.type === 'widget' && c.widgetId === 'weather');
    expect(col).toMatchObject({ enabled: true, id: 'widget:weather', instanceId: 'weather' });
    expect(isBuiltinWidgetEnabled(layout, 'weather')).toBe(true);
  });

  it('disables an existing widget without removing it', () => {
    const layout = createDefaultLayoutState();
    setBuiltinWidgetEnabled(layout, 'clock', true);
    setBuiltinWidgetEnabled(layout, 'clock', false);

    expect(layout.columns.some((c) => c.type === 'widget' && c.widgetId === 'clock')).toBe(true);
    expect(isBuiltinWidgetEnabled(layout, 'clock')).toBe(false);
  });

  it('dedupes duplicate built-in widget columns', () => {
    const layout = createDefaultLayoutState();
    layout.columns.push(
      {
        id: 'widget:weather-a',
        type: 'widget',
        order: 50,
        enabled: true,
        widgetId: 'weather',
        instanceId: 'a',
        settings: { locationName: 'First' },
      },
      {
        id: 'widget:weather-b',
        type: 'widget',
        order: 51,
        enabled: false,
        widgetId: 'weather',
        instanceId: 'b',
        settings: {},
      }
    );

    const deduped = dedupeBuiltinWidgetColumns(layout.columns);
    const weatherCols = deduped.filter((c) => c.type === 'widget' && c.widgetId === 'weather');
    expect(weatherCols).toHaveLength(1);
    expect(weatherCols[0]?.id).toBe('widget:weather-a');
  });
});
