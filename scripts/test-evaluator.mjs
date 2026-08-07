import assert from 'node:assert/strict';
import { evaluate } from '../api/evaluate.js';

const base = {
  conclusion: 'Assessment preserves uncertainty.', confidence: 62,
  evidence_used: ['[p. 2] Cited fact'], uncertainties: ['Identity remains uncertain.'], rationale: ['Evidence is not uniquely diagnostic.'],
  observations: ['A supplied event occurred.'], inferences: ['Coordination is possible.'], assumptions: ['Sensors worked as reported.'],
  alternative_hypotheses: ['Hostile preparation', 'Non-hostile exercise or equipment test'],
  confidence_basis: 'Moderate evidence with unresolved alternatives.', confidence_change: 'Confidence fell from 70 to 62 because the alternative remained viable.',
};

const roles = ['Submarine Analyst', 'ELINT Analyst', 'Air Intelligence Analyst', 'HUMINT Analyst'];
const rows = [];
for (let i = 0; i < 4; i += 1) rows.push({ stage: 'specialist_initial', role: roles[i], report: { ...base } });
for (let i = 0; i < 4; i += 1) rows.push({ stage: 'chief_feedback', role: 'Chief Agent', report: { ...base } });
for (let i = 0; i < 4; i += 1) rows.push({ stage: 'specialist_revision', role: roles[i], report: { ...base } });
rows.push({ stage: 'counterintelligence', role: 'Counterintelligence Agent', report: { ...base, rationale: ['A controlled leak by the double agent remains possible.', 'The radar gap could be equipment cooling or concealment.'] } });
rows.push({ stage: 'chief_final', role: 'Chief Agent', report: { ...base, conclusion: 'Defective sonar may be returning rather than transferred; no direct track connects the helicopter, and wind uncertainty weakens the departed-lighter estimate.' } });

const result = evaluate(rows, 'operation-copper-lantern.pdf');
assert.equal(result.scores.evidence_use, 100);
assert.equal(result.scores.benchmark_coverage, 100);
assert.match(result.findings.at(-1), /5\/5/);
console.log('Evidence-discipline evaluator tests passed.');
