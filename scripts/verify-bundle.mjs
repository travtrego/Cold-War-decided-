import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const manifestPath = new URL('../bundle-v2/manifest.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const encodedParts = await Promise.all(
  manifest.parts.map((part) =>
    readFile(new URL(`../bundle-v2/${part}`, import.meta.url), 'utf8'),
  ),
);

const encoded = encodedParts.join('').replace(/\s+/g, '');
const decoded = Buffer.from(encoded, 'base64');
const hash = createHash('sha256').update(decoded).digest('hex');
const html = decoded.toString('utf8');

const failures = [];

if (decoded.byteLength !== manifest.decodedBytes) {
  failures.push(
    `Decoded byte length mismatch: expected ${manifest.decodedBytes}, got ${decoded.byteLength}`,
  );
}

if (hash !== manifest.sha256) {
  failures.push(`SHA-256 mismatch: expected ${manifest.sha256}, got ${hash}`);
}

for (const marker of manifest.requiredMarkers) {
  if (!html.includes(marker)) failures.push(`Missing required marker: ${marker}`);
}

if (!html.startsWith('<!doctype html>')) {
  failures.push('Decoded bundle does not start with <!doctype html>');
}

if (!html.trimEnd().endsWith('</html>')) {
  failures.push('Decoded bundle does not end with </html>');
}

if (failures.length) {
  console.error('Bundle verification failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Bundle verification passed.');
console.log(`Decoded bytes: ${decoded.byteLength}`);
console.log(`SHA-256: ${hash}`);
console.log(`Required markers: ${manifest.requiredMarkers.length}`);
