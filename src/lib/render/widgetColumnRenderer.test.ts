import { afterEach, describe, expect, it, vi } from 'vitest';
import { widgetRegistry } from '../../widgets/registry';
import type { WidgetContext, WidgetDefinition } from '../../widgets/contract';
import type { WidgetColumnMeta } from '../storage/schema';
import { renderWidgetColumn } from './widgetColumnRenderer';

function makeMeta(widgetId: string, settings: Record<string, unknown> = {}): WidgetColumnMeta {
  return {
    id: `col-${widgetId}`,
    type: 'widget',
    order: 0,
    enabled: true,
    widgetId,
    instanceId: `inst-${widgetId}`,
    settings,
  };
}

describe('renderWidgetColumn', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes variant in WidgetContext and catches rejected render()', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const captured: { ctx: WidgetContext | null } = { ctx: null };

    const def: WidgetDefinition = {
      id: 'test-async-reject',
      displayName: 'Test Reject',
      settingsSchema: [],
      defaultSettings: {},
      create(_container, _settings, ctx) {
        captured.ctx = ctx;
        return {
          async render() {
            throw new Error('render boom');
          },
          destroy() {},
        };
      },
    };
    widgetRegistry.register(def);

    renderWidgetColumn(
      makeMeta('test-async-reject'),
      { onSettingsSaved: vi.fn(async () => true) },
      { variant: 'inline' }
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(captured.ctx?.variant).toBe('inline');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('failed to render widget'),
      expect.any(Error)
    );
  });

  it('rolls back on throw and skips stale rollback when a newer save is in flight', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let capturedCtx: WidgetContext | null = null;
    let capturedSettings: Record<string, unknown> = {};
    const refreshSpy = vi.fn();

    const def: WidgetDefinition = {
      id: 'test-save-race',
      displayName: 'Test Race',
      settingsSchema: [],
      defaultSettings: { value: 'initial' },
      create(_container, settings, ctx) {
        capturedCtx = ctx;
        capturedSettings = settings;
        return {
          render() {},
          refresh: refreshSpy,
          destroy() {},
        };
      },
    };
    widgetRegistry.register(def);

    let rejectFirst!: (err: Error) => void;
    let resolveSecond!: (ok: boolean) => void;
    const onSettingsSaved = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((_res, rej) => {
            rejectFirst = rej;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((res) => {
            resolveSecond = res;
          })
      )
      .mockRejectedValueOnce(new Error('save failed'));

    renderWidgetColumn(makeMeta('test-save-race'), { onSettingsSaved });

    // Start save #1 and save #2 concurrently
    const p1 = capturedCtx!.saveSettings({ value: 'first' });
    const p2 = capturedCtx!.saveSettings({ value: 'second' });

    // Save #1 throws after save #2 already started -> must NOT roll back 'second'
    rejectFirst(new Error('stale failure'));
    await p1;
    expect(capturedSettings.value).toBe('second');
    expect(refreshSpy).not.toHaveBeenCalled();

    resolveSecond(true);
    await p2;
    expect(capturedSettings.value).toBe('second');

    // Now a latest save throws -> DOES roll back to 'second' and refreshes
    await capturedCtx!.saveSettings({ value: 'third' });
    expect(capturedSettings.value).toBe('second');
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();
  });
});
