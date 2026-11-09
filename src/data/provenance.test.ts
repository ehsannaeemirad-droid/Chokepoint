/**
 * Phase 1c acceptance test: every modelled value that stands in for a real-world
 * fact must have a `HistoricalReference`, or be explicitly labelled a game
 * abstraction with a stated mapping. This test walks the data, so adding a
 * scenario value, arsenal class, launcher pool or facility without provenance
 * fails here rather than being noticed later.
 */
import { describe, expect, it } from 'vitest';
import { SCENARIOS } from '../core/Game';
import { DELIVERY_CLASSES } from '../core/inventory';
import { MAP_NODES } from '../map/TheaterMap';
import {
  CONFIDENCE_ORDER,
  type EvidenceType,
  type HistoricalReference,
  referenceFor,
  referencesFor,
} from '../core/provenance';
import { REFERENCES } from './references';

const EVIDENCE_TYPES: EvidenceType[] = ['verified', 'reported-estimate', 'disputed', 'game-abstraction'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function requireRef(subjectId: string, category: HistoricalReference['category']): HistoricalReference {
  const found = referenceFor(REFERENCES, subjectId, category);
  expect(found, `missing ${category} reference for ${subjectId}`).toBeTruthy();
  return found!;
}

describe('reference records', () => {
  it('are unique, dated and complete', () => {
    const ids = new Set<string>();
    for (const ref of REFERENCES) {
      expect(ids.has(ref.id), `duplicate reference id ${ref.id}`).toBe(false);
      ids.add(ref.id);
      expect(EVIDENCE_TYPES).toContain(ref.evidenceType);
      expect(CONFIDENCE_ORDER).toContain(ref.confidence);
      expect(ref.validAt).toMatch(ISO_DATE);
      expect(ref.lastReviewed).toMatch(ISO_DATE);
      expect(ref.notes.length).toBeGreaterThan(10);
      expect(ref.gameMapping.length).toBeGreaterThan(10);
    }
  });

  it('never asserts a source it cannot name', () => {
    for (const ref of REFERENCES) {
      if (ref.evidenceType === 'game-abstraction') continue;
      expect(ref.sourceName, `${ref.id} has no source name`).toBeTruthy();
      expect(ref.sourceUrl ?? '', `${ref.id} has no source URL`).toMatch(/^https:\/\//);
      expect(ref.sourceName).not.toMatch(/example|placeholder/i);
    }
  });

  it('gives numeric records a value or a range with a unit', () => {
    for (const ref of REFERENCES) {
      if (ref.category === 'facility') continue; // a facility is a role, not a quantity
      const hasValue = ref.value !== undefined || (ref.min !== undefined && ref.max !== undefined);
      expect(hasValue, `${ref.id} has no value`).toBe(true);
      expect(ref.unit, `${ref.id} has no unit`).toBeTruthy();
    }
  });

  it('has exactly one reference per subject and category', () => {
    for (const ref of REFERENCES) {
      const matches = referencesFor(REFERENCES, ref.subjectId, ref.category);
      expect(matches.length, `${ref.subjectId} has ${matches.length} references`).toBe(1);
    }
  });
});

describe('coverage walk', () => {
  it('covers every classified facility', () => {
    for (const node of MAP_NODES) {
      if (!node.facility) continue;
      requireRef(node.id, 'facility');
    }
  });

  it('labels the missile-industry sites as reported estimates, not verified fact', () => {
    for (const id of ['khojir', 'parchin', 'shahroud']) {
      const ref = requireRef(id, 'facility');
      expect(ref.evidenceType).toBe('reported-estimate');
      expect(ref.notes.toLowerCase()).toContain('approximate');
    }
  });

  it('covers every scenario arsenal class, launcher pool and stock value', () => {
    for (const id of Object.keys(SCENARIOS)) {
      const scenario = SCENARIOS[id]!;
      for (const cls of DELIVERY_CLASSES) {
        requireRef(`${id}:arsenal:${cls}`, 'arsenal');
      }
      requireRef(`${id}:launchers:drone`, 'launcher');
      requireRef(`${id}:launchers:ballistic`, 'launcher');
      requireRef(`${id}:nuclear-material`, 'nuclear-material');
      requireRef(`${id}:resources`, 'scenario');
      requireRef(`${id}:initial-hormuz`, 'scenario');
      requireRef(`${id}:hosts`, 'scenario');
      expect(scenario.iran.rounds).toBeTruthy();
    }
  });

  it('records the scenario value in the reference, not a different one', () => {
    for (const id of Object.keys(SCENARIOS)) {
      const scenario = SCENARIOS[id]!;
      const resources = requireRef(`${id}:resources`, 'scenario');
      expect(resources.value).toBe(scenario.iran.resources);
      const hormuz = requireRef(`${id}:initial-hormuz`, 'scenario');
      expect(hormuz.value).toBe(scenario.initialHormuz);
      for (const cls of DELIVERY_CLASSES) {
        const ref = requireRef(`${id}:arsenal:${cls}`, 'arsenal');
        expect(ref.value).toBe(scenario.iran.rounds[cls]);
      }
      expect(requireRef(`${id}:launchers:drone`, 'launcher').value).toBe(scenario.iran.launchers.drone);
      expect(requireRef(`${id}:launchers:ballistic`, 'launcher').value).toBe(
        scenario.iran.launchers.ballistic,
      );
      expect(requireRef(`${id}:nuclear-material`, 'nuclear-material').value).toBe(
        scenario.iran.nuclearMaterial,
      );
    }
  });
});
