/** Tiny app-wide event bus for UI <-> scene messaging. */
export const bus = new EventTarget();

export interface FocusDetail {
  col: number;
  row: number;
}

export function focusHex(hex: FocusDetail): void {
  bus.dispatchEvent(new CustomEvent<FocusDetail>('focus', { detail: hex }));
}

export function showToast(message: string, tone: 'info' | 'warn' | 'bad' | 'good' = 'info'): void {
  bus.dispatchEvent(new CustomEvent('toast', { detail: { message, tone } }));
}

export interface ZoomDetail {
  factor: number;
}

/** Multiply the camera zoom by `factor`, keeping the screen centre anchored. */
export function zoomBy(factor: number): void {
  bus.dispatchEvent(new CustomEvent<ZoomDetail>('zoom', { detail: { factor } }));
}
