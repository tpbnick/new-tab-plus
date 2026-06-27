export type RenderScope = 'full' | 'bookmarks';

/** Coalesce render requests within a debounce window — full always wins. */
export function coalesceRenderScope(
  pending: RenderScope | null,
  incoming: RenderScope
): RenderScope {
  if (incoming === 'full') return 'full';
  if (pending === 'full') return 'full';
  return 'bookmarks';
}
