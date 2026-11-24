import { beforeEach, describe, expect, it } from 'vitest';
import { trapTabKey } from './focusTrap';

describe('trapTabKey', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('excludes hidden inputs and elements inside hidden, inert, or aria-hidden ancestors', () => {
    const modal = document.createElement('div');
    modal.innerHTML = `
      <input type="hidden" id="hidden-input" value="x" />
      <div hidden><button id="in-hidden">Hidden</button></div>
      <div inert><button id="in-inert">Inert</button></div>
      <div aria-hidden="true"><button id="in-aria-hidden">AriaHidden</button></div>
      <button id="first">First</button>
      <button id="last">Last</button>
    `;
    document.body.appendChild(modal);

    const first = document.getElementById('first') as HTMLButtonElement;
    const last = document.getElementById('last') as HTMLButtonElement;

    last.focus();
    const forwardTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    trapTabKey(modal, forwardTab);
    expect(forwardTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    first.focus();
    const backwardTab = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    trapTabKey(modal, backwardTab);
    expect(backwardTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it('pulls focus into the container when activeElement is outside it', () => {
    const outside = document.createElement('button');
    outside.id = 'outside';
    const modal = document.createElement('div');
    modal.innerHTML = `
      <button id="first">First</button>
      <button id="last">Last</button>
    `;
    document.body.append(outside, modal);

    const first = document.getElementById('first') as HTMLButtonElement;
    const last = document.getElementById('last') as HTMLButtonElement;

    outside.focus();
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    trapTabKey(modal, tabEvent);
    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    outside.focus();
    const shiftTabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    trapTabKey(modal, shiftTabEvent);
    expect(shiftTabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });
});
