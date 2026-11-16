import type { Effects, L, NationalState } from './model';

/**
 * A first-class crisis event. Events are data: the resolver evaluates their
 * trigger once per week and applies the declared effects in order. Adding a
 * crisis beat does not require another branch in the turn loop.
 */
export interface NationalEventDef {
  id: string;
  title: L;
  text: L;
  tone: 'good' | 'warn' | 'bad' | 'info';
  effects: Effects;
  trigger: (state: NationalState) => boolean;
}

export const NATIONAL_EVENTS: NationalEventDef[] = [
  {
    id: 'insurance-shock',
    title: { en: 'Insurance shock', fa: 'شوک بیمه' },
    text: {
      en: 'A second reinsurer withdraws from Hormuz cover. The market is now pricing the route as a war zone, even on quiet days.',
      fa: 'یک بیمه‌گر اتکایی دوم پوشش هرمز را کنار گذاشت. بازار اکنون مسیر را حتی در روزهای آرام، منطقه جنگ قیمت‌گذاری می‌کند.',
    },
    tone: 'bad',
    effects: { shippingConfidence: -4, insurance: 4, tradeAccess: -2 },
    trigger: (state) => state.shipping.insurance >= 78 && state.turn >= 3,
  },
  {
    id: 'qatari-offer',
    title: { en: 'A narrow opening', fa: 'شکافی باریک' },
    text: {
      en: 'Doha offers a drafting mandate for shipping safety. It is not a settlement, but it is a table that both sides can reach.',
      fa: 'دوحه مأموریت تدوین متن امنیت کشتیرانی را پیشنهاد کرد. این توافق نیست، اما میزی است که هر دو طرف می‌توانند به آن برسند.',
    },
    tone: 'good',
    effects: { talks: 6, mediation: 4, diplomatic: -2 },
    trigger: (state) => state.turn >= 3 && state.diplomacy.talks < 35 && state.escalation.stage >= 4,
  },
  {
    id: 'street-pressure',
    title: { en: 'The street answers', fa: 'خیابان پاسخ می‌دهد' },
    text: {
      en: 'Price protests spread from the bazaar to provincial cities. The interior ministry asks for a visible response before the next Friday prayers.',
      fa: 'اعتراض‌های قیمتی از بازار به شهرهای استان گسترش یافت. وزارت کشور پیش از نماز جمعه بعدی خواستار پاسخ آشکار شد.',
    },
    tone: 'bad',
    effects: { stability: -3, legitimacy: -2, socialTension: 4 },
    trigger: (state) => state.economy.publicPressure >= 65 && state.government.socialTension >= 35,
  },
  {
    id: 'interceptor-shortage',
    title: { en: 'Interceptor shortage', fa: 'کمبود رهگیر' },
    text: {
      en: 'Air-defence crews report that the ready inventory is below the planned expenditure rate. The next raid will force choices about what to protect.',
      fa: 'خدمه پدافند هوایی گزارش دادند موجودی آماده کمتر از نرخ مصرف برنامه‌ریزی‌شده است. حمله بعدی انتخاب درباره آنچه باید محافظت شود را تحمیل می‌کند.',
    },
    tone: 'warn',
    effects: { defence: -3, readiness: -2, confidence: -2 },
    trigger: (state) => state.escalation.stage >= 5 && state.security.defence < 50,
  },
  {
    id: 'energy-lifeline',
    title: { en: 'A buyer steps forward', fa: 'خریداری پیش می‌آید' },
    text: {
      en: 'A Chinese refiner offers limited purchases outside the formal sanctions channel. The revenue is real; so is the diplomatic exposure.',
      fa: 'یک پالایشگر چینی خرید محدود خارج از کانال رسمی تحریم پیشنهاد کرد. درآمد واقعی است؛ ریسک دیپلماتیک هم واقعی است.',
    },
    tone: 'warn',
    effects: { reserves: 5, tradeAccess: 3, exposure: 3, relations: { china: 3 } },
    trigger: (state) => state.economy.reserves < 30 && state.turn >= 4,
  },
];

export function triggeredEvents(state: NationalState): NationalEventDef[] {
  return NATIONAL_EVENTS.filter((event) => !state.firedEvents.includes(event.id) && event.trigger(state));
}
