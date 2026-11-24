import { describe, expect, it, vi } from 'vitest';
import { appendWidgetSettingsForm } from './widgetSettingsForm';

describe('appendWidgetSettingsForm', () => {
  it('forwards min, max, and step attributes for number fields', () => {
    const container = document.createElement('div');
    const onSave = vi.fn();

    appendWidgetSettingsForm(
      container,
      [
        {
          key: 'ttlMinutes',
          label: 'Refresh interval (minutes)',
          type: 'number',
          min: 5,
          max: 1440,
          step: 5,
          default: 20,
        },
      ],
      { ttlMinutes: 30 },
      onSave
    );

    const input = container.querySelector<HTMLInputElement>('input[type="number"]');
    expect(input).not.toBeNull();
    expect(input!.min).toBe('5');
    expect(input!.max).toBe('1440');
    expect(input!.step).toBe('5');
    expect(input!.value).toBe('30');
  });
});
