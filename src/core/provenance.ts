/**
 * Provenance layer (Phase 1c).
 *
 * Every modelled value that stands in for a real-world fact carries a
 * `HistoricalReference`: what it is, when it was valid, how it was sourced, how
 * confident the estimate is, and — critically — how the value was mapped into
 * the game. A value with no public source is not left bare: it is labelled
 * `game-abstraction` and `gameMapping` must state the conversion.
 *
 * `src/data/references.ts` holds the actual records; `src/data/provenance.test.ts`
 * walks the scenario and facility data and fails when a required value has no
 * reference, so new numbers cannot slip in unlabelled.
 */

export type EvidenceType = 'verified' | 'reported-estimate' | 'disputed' | 'game-abstraction';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ReferenceCategory =
  | 'facility'
  | 'arsenal'
  | 'launcher'
  | 'nuclear-material'
  | 'scenario'
  | 'politics';

export interface HistoricalReference {
  /** Stable id, unique across the set. */
  id: string;
  /** What the record is about: a node id, or `<scenario>:<domain>:<key>`. */
  subjectId: string;
  category: ReferenceCategory;
  /** ISO date the value is valid for (the scenario's start date where relevant). */
  validAt: string;
  /** ISO date of the publication the estimate came from, when there is one. */
  sourcePublishedAt?: string;
  /** Central value, when the source or the model supplies one. */
  value?: number;
  /** Range form, for estimates that are only known as a band. */
  min?: number;
  max?: number;
  unit?: string;
  evidenceType: EvidenceType;
  confidence: ConfidenceLevel;
  sourceName?: string;
  sourceUrl?: string;
  notes: string;
  /** How the real-world value became a game number. Required, never empty. */
  gameMapping: string;
  /** ISO date this record was last checked. */
  lastReviewed: string;
}

/** References matching a subject, optionally narrowed to one category. */
export function referencesFor(
  references: readonly HistoricalReference[],
  subjectId: string,
  category?: ReferenceCategory,
): HistoricalReference[] {
  return references.filter(
    (ref) => ref.subjectId === subjectId && (category === undefined || ref.category === category),
  );
}

/** First reference for a subject, or undefined. */
export function referenceFor(
  references: readonly HistoricalReference[],
  subjectId: string,
  category?: ReferenceCategory,
): HistoricalReference | undefined {
  return referencesFor(references, subjectId, category)[0];
}

/** True when a record is explicitly a game abstraction rather than a sourced figure. */
export function isGameAbstraction(reference: HistoricalReference): boolean {
  return reference.evidenceType === 'game-abstraction';
}

/** Confidence bands ordered from strongest to weakest, for display and sorting. */
export const CONFIDENCE_ORDER: ConfidenceLevel[] = ['high', 'medium', 'low'];
