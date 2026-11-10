/** Shared UI label helpers (faction and unit names), localised. */
import { getLang, localName } from '../i18n';
import { unitType } from '../core/world';
import type { UnitInstance } from '../core/types';

const FACTION_FA: Record<string, string> = {
  usa: 'ایالات متحده',
  israel: 'اسرائیل',
  iran: 'ایران',
  houthi: 'جنبش حوثی',
  saudi: 'عربستان سعودی',
  pakistan: 'پاکستان',
  india: 'هند',
  qatar: 'قطر',
  uae: 'امارات',
  kuwait: 'کویت',
  bahrain: 'بحرین',
  jordan: 'اردن',
  egypt: 'مصر',
  turkey: 'ترکیه',
  neutral: 'بی‌طرف',
};

const FACTION_LABELS_FALLBACK: Record<string, string> = {
  usa: 'United States',
  israel: 'Israel',
  iran: 'Iran',
  houthi: 'Houthi Movement',
  saudi: 'Saudi Arabia',
  pakistan: 'Pakistan',
  india: 'India',
  qatar: 'Qatar',
  uae: 'UAE',
  kuwait: 'Kuwait',
  bahrain: 'Bahrain',
  jordan: 'Jordan',
  egypt: 'Egypt',
  turkey: 'Turkey',
  neutral: 'Neutral',
};

export function unitLabel(unit: UnitInstance): string {
  return localName(unitType(unit.typeId));
}

export function factionLabel(id: string): string {
  return getLang() === 'fa' ? FACTION_FA[id] ?? id : FACTION_LABELS_FALLBACK[id] ?? id;
}
