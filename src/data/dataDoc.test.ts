/**
 * `docs/DATA.md` is generated from the reference records, so it cannot drift
 * away from the data it documents. If this test fails, regenerate the file from
 * `renderDataDoc(REFERENCES)` rather than editing the Markdown by hand.
 */
import { describe, expect, it } from 'vitest';
import committed from '../../docs/DATA.md?raw';
import { renderDataDoc } from './dataDoc';
import { REFERENCES } from './references';

describe('data document', () => {
  it('matches the reference records', () => {
    // Line endings differ between checkouts; compare the content, not the CRLF.
    expect(committed.replace(/\r\n/g, '\n')).toBe(renderDataDoc(REFERENCES));
  });

  it('documents every weapon system and never claims a false precision', () => {
    const doc = renderDataDoc(REFERENCES);
    for (const ref of REFERENCES.filter((r) => r.category === 'weapon')) {
      expect(doc).toContain(ref.subjectId);
      expect(doc).toContain(ref.gameMapping.slice(0, 40));
    }
    expect(doc).toContain('conversion from kilometres');
    expect(doc).toContain('guaranteed hit probability');
  });
});
