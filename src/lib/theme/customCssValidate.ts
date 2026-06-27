export type CustomCssValidation = { ok: true } | { ok: false; message: string };

export function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

export function checkBalancedBraces(css: string): string | null {
  let depth = 0;
  let inString: '"' | "'" | null = null;
  let inComment = false;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    const next = css[i + 1];

    if (inComment) {
      if (ch === '*' && next === '/') inComment = false;
      continue;
    }

    if (!inString && ch === '/' && next === '*') {
      inComment = true;
      i++;
      continue;
    }

    if (!inString && (ch === '"' || ch === "'")) {
      inString = ch;
      continue;
    }

    if (inString) {
      if (ch === inString && css[i - 1] !== '\\') inString = null;
      continue;
    }

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth < 0) return 'Unexpected closing brace "}".';
    }
  }

  if (depth > 0) return 'Unclosed "{" in CSS.';
  if (depth < 0) return 'Unexpected closing brace "}".';
  return null;
}

function isCommentsOnlyOrWhitespace(css: string): boolean {
  return stripCssComments(css).trim().length === 0;
}

function formatCssParseError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return 'Invalid CSS syntax.';
}

/** Parse-check custom CSS before injecting it into the page. */
export function validateCustomCss(css: string, doc: Document = document): CustomCssValidation {
  const text = css.trim();
  if (!text) return { ok: true };
  if (isCommentsOnlyOrWhitespace(text)) return { ok: true };

  const braceError = checkBalancedBraces(text);
  if (braceError) return { ok: false, message: braceError };

  const styleEl = doc.createElement('style');
  styleEl.textContent = css;
  doc.head.appendChild(styleEl);

  try {
    const sheet = styleEl.sheet;
    if (!sheet) {
      return { ok: false, message: 'Could not parse CSS.' };
    }

    let ruleCount = 0;
    try {
      ruleCount = sheet.cssRules.length;
    } catch (err) {
      return { ok: false, message: formatCssParseError(err) };
    }

    if (ruleCount === 0) {
      return { ok: false, message: 'CSS could not be parsed. Check for syntax errors.' };
    }

    return { ok: true };
  } finally {
    styleEl.remove();
  }
}
