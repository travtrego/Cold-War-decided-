import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractText } from 'unpdf';
import { parseMarkedScenario } from '../api/scenario.js';

const files = [
  'operation-northern-glass.pdf',
  'operation-amber-circuit.pdf',
  'operation-copper-lantern.pdf',
];

for (const filename of files) {
  const bytes = await readFile(new URL(`../output/pdf/${filename}`, import.meta.url));
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-', `${filename} is not a PDF`);
  const extracted = await extractText(new Uint8Array(bytes), { mergePages: false });
  assert.equal(extracted.totalPages, 3, `${filename} should have three pages`);
  const scenario = parseMarkedScenario(extracted.text.join('\n'));
  assert.ok(scenario, `${filename} did not feed through the deterministic scenario parser`);
  assert.ok(!scenario.objective.includes('HANDLING NOTE'), `${filename} objective leaked document instructions`);
  for (const silo of ['submarine', 'elint', 'air', 'humint']) {
    assert.ok(scenario[silo].includes('You have no access'), `${filename} ${silo} silo lost its evidence boundary`);
    assert.ok(scenario[silo].includes('[p.'), `${filename} ${silo} silo lost page references`);
  }
  console.log(`${filename}: ${extracted.totalPages} pages, all four silos verified`);
}
