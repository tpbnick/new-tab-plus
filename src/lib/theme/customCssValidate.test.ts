import { describe, expect, it } from 'vitest';
import { checkBalancedBraces, stripCssComments, validateCustomCss } from './customCssValidate';

describe('stripCssComments', () => {
  it('removes block comments', () => {
    expect(stripCssComments('/* note */ .a {}')).toBe(' .a {}');
  });
});

describe('checkBalancedBraces', () => {
  it('accepts balanced braces', () => {
    expect(checkBalancedBraces('.a { color: red; }')).toBeNull();
  });

  it('rejects stray closing braces', () => {
    expect(checkBalancedBraces('.asdasdsad asd } Asd as')).toBeTruthy();
  });

  it('rejects unclosed blocks', () => {
    expect(checkBalancedBraces('.column { color: red;')).toBeTruthy();
  });
});

describe('validateCustomCss', () => {
  it('accepts empty css', () => {
    expect(validateCustomCss('')).toEqual({ ok: true });
  });

  it('accepts valid rules', () => {
    expect(validateCustomCss('.column { color: red; }')).toEqual({ ok: true });
  });

  it('rejects garbage css', () => {
    const result = validateCustomCss('.asdasdsad asd } Asd as\nas;');
    expect(result.ok).toBe(false);
  });

  it('rejects unclosed blocks', () => {
    const result = validateCustomCss('.column { color: red;');
    expect(result.ok).toBe(false);
  });
});
