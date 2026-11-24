import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNumberInput, createOptionsHelpTrigger, createRangeRow } from './formControls';

describe('formControls', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('createNumberInput ignores empty string instead of firing onChange(0)', () => {
    const onChange = vi.fn();
    const input = createNumberInput(20, onChange);

    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(onChange).not.toHaveBeenCalled();

    input.value = '35';
    input.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenCalledWith(35);
  });

  it('createRangeRow allows in-progress typing without clobbering and clamps on blur/change', () => {
    const onChange = vi.fn();
    const row = createRangeRow('Column width', 200, onChange, 100, 400, 10, 'px');
    const slider = row.querySelector<HTMLInputElement>('input[type="range"]')!;
    const numberBox = row.querySelector<HTMLInputElement>('input[type="number"]')!;

    // Backspacing to empty does not overwrite input or call onChange
    numberBox.value = '';
    numberBox.dispatchEvent(new Event('input'));
    expect(numberBox.value).toBe('');
    expect(onChange).not.toHaveBeenCalled();

    // Typing prefix below min ("2" while typing "250") does not clamp mid-typing
    numberBox.value = '2';
    numberBox.dispatchEvent(new Event('input'));
    expect(numberBox.value).toBe('2');
    expect(onChange).not.toHaveBeenCalled();

    // Completing valid value syncs slider and notifies without overwriting text
    numberBox.value = '250';
    numberBox.dispatchEvent(new Event('input'));
    expect(slider.value).toBe('250');
    expect(onChange).toHaveBeenCalledWith(250);

    // Out-of-range value clamps and formats on blur
    onChange.mockClear();
    numberBox.value = '50';
    numberBox.dispatchEvent(new Event('input'));
    expect(numberBox.value).toBe('50');
    expect(onChange).not.toHaveBeenCalled();

    numberBox.dispatchEvent(new Event('blur'));
    expect(numberBox.value).toBe('100');
    expect(slider.value).toBe('100');
    expect(onChange).toHaveBeenCalledWith(100);
  });

  it('createRangeRow snaps empty box back to last committed value on blur', () => {
    const onChange = vi.fn();
    const row = createRangeRow('Spacing', 1.5, onChange, 0.5, 3, 0.1);
    const numberBox = row.querySelector<HTMLInputElement>('input[type="number"]')!;

    numberBox.value = '';
    numberBox.dispatchEvent(new Event('blur'));
    expect(numberBox.value).toBe('1.5');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('createOptionsHelpTrigger dismisses tooltip on Escape, outside pointerdown, or detached trigger', () => {
    const trigger = createOptionsHelpTrigger('Helpful tip');
    document.body.appendChild(trigger);

    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.querySelector('.options-help-tooltip')?.textContent).toBe('Helpful tip');

    // Escape dismisses tooltip
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.options-help-tooltip')).toBeNull();

    // Outside pointerdown dismisses tooltip
    trigger.dispatchEvent(new FocusEvent('focus'));
    expect(document.querySelector('.options-help-tooltip')).not.toBeNull();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(document.querySelector('.options-help-tooltip')).toBeNull();

    // Detached trigger cleans up on subsequent pointermove
    trigger.dispatchEvent(new MouseEvent('mouseenter'));
    expect(document.querySelector('.options-help-tooltip')).not.toBeNull();
    trigger.remove();
    document.dispatchEvent(new Event('pointermove'));
    expect(document.querySelector('.options-help-tooltip')).toBeNull();
  });
});
