/**
 * Label placement for the strategic map.
 *
 * At the initial camera zoom several facilities sit within a few hexes of each
 * other, so their screen-space labels land on top of one another and the one
 * underneath cannot be tapped. Positions are resolved here, in a stable input
 * order, so the same map always produces the same layout.
 */

export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LabelPoint {
  x: number;
  y: number;
}

function overlaps(a: LabelBox, b: LabelBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Place each label at its anchor, sliding it down until it clears every label
 * already placed. Boxes are given in drawing order; the first stays put and is
 * never displaced, which keeps the strategic sites readable.
 */
export function spreadLabels(boxes: LabelBox[], gap = 2, maxSteps = 32): LabelPoint[] {
  const placed: LabelBox[] = [];
  return boxes.map((box) => {
    const point: LabelPoint = { x: box.x, y: box.y };
    for (let step = 0; step < maxSteps; step++) {
      const candidate: LabelBox = { ...box, ...point };
      if (!placed.some((other) => overlaps(candidate, other))) break;
      point.y += box.h + gap;
    }
    placed.push({ ...box, ...point });
    return point;
  });
}
