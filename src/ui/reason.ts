/** Localised rendering of engine order rejections. */
import { t } from '../i18n';
import type { OrderRejectCode, RejectParams } from '../core/rejection';

export interface LocalisableRejection {
  code?: OrderRejectCode;
  reason?: string;
  params?: RejectParams;
}

/**
 * Translate a rejection by code. Unknown codes (or hand-built objects from
 * older callers) fall back to the English reason, then to the supplied
 * fallback, so a missing translation never hides the failure.
 */
export function rejectionText(result: LocalisableRejection, fallback?: string): string {
  const fb = fallback ?? t('toast.invalid');
  if (!result.code) return result.reason || fb;
  try {
    const message = t(`reason.${result.code}` as never, result.params);
    return message || result.reason || fb;
  } catch {
    return result.reason || fb;
  }
}
