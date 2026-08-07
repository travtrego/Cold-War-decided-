import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(
  await readFile(new URL('../bundle-v2/manifest.json', import.meta.url), 'utf8'),
);
const encodedParts = await Promise.all(
  manifest.parts.map((part) =>
    readFile(new URL(`../bundle-v2/${part}`, import.meta.url), 'utf8'),
  ),
);
const baseHtml = Buffer.from(
  encodedParts.join('').replace(/\s+/g, ''),
  'base64',
).toString('utf8');
const liveModule = await readFile(
  new URL('../live-mode.js', import.meta.url),
  'utf8',
);

const requiredBaseIds = [
  'tabPipe',
  'run',
  'skip',
  'state',
  'clock',
  'count',
  'ci',
  'sealed',
  'final',
  'decision',
  'aar',
  'chief',
  'red',
  'synth',
  'agents',
  'papers',
  'learn',
  'toast',
];

for (const id of requiredBaseIds) {
  assert.match(baseHtml, new RegExp(`id=["']${id}["']`), `Missing base DOM id: ${id}`);
}

const requiredBaseSymbols = [
  'function run(',
  'function finish(',
  'function tab(',
  'function setNode(',
  'function stage(',
  'function toast(',
  'const A=',
  'const acts=',
  'let running=',
  'timers=',
];

for (const symbol of requiredBaseSymbols) {
  assert.ok(baseHtml.includes(symbol), `Missing base runtime symbol: ${symbol}`);
}

const requiredLiveMarkers = [
  "fetch('/api/health'",
  "api('/api/agent'",
  "api('/api/missions'",
  "api('/api/evaluate'",
  'Promise.all(A.map',
  "stage: 'specialist_initial'",
  "stage: 'chief_feedback'",
  "stage: 'specialist_revision'",
  "stage: 'counterintelligence'",
  "stage: 'chief_final'",
  'cold-war-pipeline-v3-evidence-discipline',
];

for (const marker of requiredLiveMarkers) {
  assert.ok(liveModule.includes(marker), `Missing Live AI marker: ${marker}`);
}

console.log('Live AI module contract passed.');
