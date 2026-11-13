import { describe, expect, it } from 'vitest';
import { spreadLabels, type LabelBox } from './labelLayout';

function collide(a: LabelBox, b: LabelBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

describe('initial-zoom label layout', () => {
  it('leaves a lone label exactly on its anchor', () => {
    expect(spreadLabels([{ x: 40, y: 60, w: 90, h: 20 }])).toEqual([{ x: 40, y: 60 }]);
  });

  it('leaves labels that do not overlap where they are', () => {
    const boxes: LabelBox[] = [
      { x: 0, y: 0, w: 80, h: 18 },
      { x: 200, y: 0, w: 80, h: 18 },
    ];
    expect(spreadLabels(boxes)).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ]);
  });

  it('slides the labels that would stack, as at the initial zoom', () => {
    // Bandar Abbas storage over Bandar Abbas, Kharg Island over Bushehr.
    const boxes: LabelBox[] = [
      { x: 310, y: 240, w: 110, h: 20 },
      { x: 314, y: 244, w: 100, h: 20 },
      { x: 318, y: 248, w: 96, h: 20 },
    ];
    const points = spreadLabels(boxes);
    expect(points[0]).toEqual({ x: 310, y: 240 });
    const rects = boxes.map((box, i) => ({ ...box, ...points[i]! }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(collide(rects[i]!, rects[j]!)).toBe(false);
      }
    }
    // Each displaced label moved down by at least its own height.
    expect(points[1]!.y).toBeGreaterThanOrEqual(240 + 20);
    expect(points[2]!.y).toBeGreaterThanOrEqual(points[1]!.y + 20);
  });

  it('is deterministic for the same input', () => {
    const boxes: LabelBox[] = [
      { x: 5, y: 5, w: 100, h: 20 },
      { x: 6, y: 6, w: 100, h: 20 },
    ];
    expect(spreadLabels(boxes)).toEqual(spreadLabels(boxes));
  });
});
