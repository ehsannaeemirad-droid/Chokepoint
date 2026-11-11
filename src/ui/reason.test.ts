import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../i18n';
import { ORDER_REJECTION_CODES } from '../core/rejection';
import { rejectionText } from './reason';

const ORIGINAL_DOCUMENT = Object.getOwnPropertyDescriptor(globalThis, 'document');

function stubDocument(): void {
  Object.defineProperty(globalThis, 'document', {
    value: { documentElement: {}, body: { classList: { toggle() {} } } },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  setLang('en');
  if (ORIGINAL_DOCUMENT) Object.defineProperty(globalThis, 'document', ORIGINAL_DOCUMENT);
  else delete (globalThis as { document?: unknown }).document;
});

describe('order rejection messages', () => {
  it('has an English message for every code', () => {
    stubDocument();
    for (const code of ORDER_REJECTION_CODES) {
      const text = rejectionText({ code }, '__missing__');
      expect(text, code).not.toBe('__missing__');
      expect(text.length, code).toBeGreaterThan(0);
    }
  });

  it('has a Persian message for every code', () => {
    stubDocument();
    setLang('fa');
    const persian = /[\u0600-\u06FF]/;
    for (const code of ORDER_REJECTION_CODES) {
      const text = rejectionText({ code }, '__missing__');
      expect(text, code).not.toBe('__missing__');
      expect(persian.test(text), `${code}: ${text}`).toBe(true);
    }
  });

  it('interpolates refusal detail', () => {
    stubDocument();
    expect(rejectionText({ code: 'too-far', params: { dist: 7, max: 3 } })).toContain('7/3');
    expect(rejectionText({ code: 'needs-will', params: { cost: 9 } })).toContain('9');
    setLang('fa');
    expect(rejectionText({ code: 'no-production-line', params: { line: 'ballistic' } })).toContain(
      'ballistic',
    );
  });

  it('falls back to the English reason, then the caller fallback', () => {
    expect(rejectionText({ reason: 'raw engine reason' }, 'fallback')).toBe('raw engine reason');
    expect(rejectionText({}, 'fallback')).toBe('fallback');
  });
});
