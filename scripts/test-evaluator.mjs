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
rows.push({ stage: 'chief_final', role: 'Chief Agent', report: { ...base, conclusion: 'Defective sonar may be returning rather than transferred; no direct track connects the helicopter, and wind uncertainty weakens the departed-lighter estimate.', recommended_action: 'PRIMARY ACTION: Quietly raise readiness. WHY: Current indicators are concerning but not uniquely hostile. AVOID: Overt military escalation. RECONSIDER IF: A confirmed hostile track or weapons-ready activity appears.' } });

const result = evaluate(rows, 'operation-copper-lantern.pdf');
assert.equal(result.scores.evidence_use, 100);
assert.equal(result.scores.benchmark_coverage, 100);
assert.equal(result.scores.decision_quality, 100);
assert.equal(result.scores.decision_accuracy, 0);
assert.equal(result.adjudication.expectedActionId, 'E');
assert.match(result.findings.at(-1), /5\/5/);

const defaultResult = evaluate(rows, '');
assert.equal(defaultResult.scores.decision_accuracy, 100);
assert.equal(defaultResult.adjudication.expectedActionId, 'B');

const northernRows = rows.map((row) => row.stage === 'chief_final'
  ? { ...row, report: { ...row.report, recommended_action: 'PRIMARY ACTION: Keep monitoring. WHY: Evidence remains below the escalation threshold. AVOID: Quietly raise readiness. RECONSIDER IF: Confirmed seabed interference appears.' } }
  : row);
const northernResult = evaluate(northernRows, 'operation-northern-glass.pdf');
assert.equal(northernResult.scores.decision_accuracy, 100);
assert.equal(northernResult.adjudication.expectedActionId, 'A');

const copperRows = rows.map((row) => row.stage === 'chief_final'
  ? { ...row, report: { ...row.report, recommended_action: 'PRIMARY ACTION: Launch a covert operation. WHY: A bounded clandestine transfer can be quietly verified. AVOID: Keep monitoring without containment. RECONSIDER IF: The transfer proves benign.' } }
  : row);
const copperCorrect = evaluate(copperRows, 'operation-copper-lantern.pdf');
assert.equal(copperCorrect.scores.decision_accuracy, 100);
assert.equal(copperCorrect.adjudication.chiefActionId, 'E');
console.log('Evidence-discipline evaluator tests passed.');
