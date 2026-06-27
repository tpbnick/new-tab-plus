import { describe, expect, it } from 'vitest';
import { formatBackgroundImageLayers } from './themeEngine';

describe('formatBackgroundImageLayers', () => {
  it('returns the image url alone at full opacity', () => {
    expect(formatBackgroundImageLayers('https://example.com/bg.jpg', '#15161e', 100)).toBe(
      'url("https://example.com/bg.jpg")'
    );
  });

  it('layers a color wash when opacity is below 100', () => {
    expect(formatBackgroundImageLayers('https://example.com/bg.jpg', '#15161e', 50)).toBe(
      'linear-gradient(rgba(21, 22, 30, 0.500), rgba(21, 22, 30, 0.500)), url("https://example.com/bg.jpg")'
    );
  });

  it('fully hides the image at 0% opacity', () => {
    expect(formatBackgroundImageLayers('https://example.com/bg.jpg', '#000000', 0)).toBe(
      'linear-gradient(rgba(0, 0, 0, 1.000), rgba(0, 0, 0, 1.000)), url("https://example.com/bg.jpg")'
    );
  });
});
