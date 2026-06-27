const STORAGE_KEY = 'new-tab-plus:dnd-debug';

/** DnD debug logging — off by default. Enable in console: localStorage.setItem('new-tab-plus:dnd-debug', '1') */
export function isDndDebugEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function prefix(): string {
  return '[new-tab-plus dnd]';
}

export function dndLog(message: string, data?: Record<string, unknown>): void {
  if (!isDndDebugEnabled()) return;
  if (data) {
    console.log(prefix(), message, data);
  } else {
    console.log(prefix(), message);
  }
}

export function dndWarn(message: string, data?: Record<string, unknown>): void {
  if (!isDndDebugEnabled()) return;
  if (data) {
    console.warn(prefix(), message, data);
  } else {
    console.warn(prefix(), message);
  }
}

/** Call once on load so you know logging is active and how to turn it off. */
export function announceDndDebug(): void {
  if (!isDndDebugEnabled()) return;
  console.log(
    prefix(),
    'Debug ON. Drag folder headers to reorder columns. Filter console by "new-tab-plus dnd". Disable: localStorage.setItem("new-tab-plus:dnd-debug", "0")'
  );
}
