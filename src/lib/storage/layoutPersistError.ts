/** Thrown after a layout save failure banner is already shown. */
export class LayoutPersistError extends Error {
  readonly bannerShown = true;

  constructor(cause: unknown) {
    super('Layout persist failed', { cause });
    this.name = 'LayoutPersistError';
  }
}
