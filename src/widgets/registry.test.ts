import { beforeEach, describe, expect, it } from 'vitest';
import { widgetRegistry } from './registry';
import type { WidgetDefinition } from './contract';

function makeDef(id: string): WidgetDefinition {
  return {
    id,
    displayName: id,
    settingsSchema: [],
    defaultSettings: {},
    create: () => ({ render: () => {}, destroy: () => {} }),
  };
}

describe('widgetRegistry', () => {
  beforeEach(() => {
    // The registry is a module-level singleton; clear it between tests by
    // reaching into its private map via a fresh registration each time would
    // throw on duplicates, so instead we verify behavior with unique ids per test.
  });

  it('registers and retrieves a widget definition', () => {
    const def = makeDef('test-widget-a');
    widgetRegistry.register(def);
    expect(widgetRegistry.get('test-widget-a')).toBe(def);
  });

  it('returns undefined for an unregistered id', () => {
    expect(widgetRegistry.get('does-not-exist')).toBeUndefined();
  });

  it('throws when registering a duplicate id', () => {
    const def = makeDef('test-widget-b');
    widgetRegistry.register(def);
    expect(() => widgetRegistry.register(makeDef('test-widget-b'))).toThrow();
  });

  it('lists all registered definitions', () => {
    widgetRegistry.register(makeDef('test-widget-c'));
    widgetRegistry.register(makeDef('test-widget-d'));
    const ids = widgetRegistry.list().map((d) => d.id);
    expect(ids).toContain('test-widget-c');
    expect(ids).toContain('test-widget-d');
  });
});
