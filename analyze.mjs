import { readFileSync } from 'fs';
const raw = readFileSync('/tmp/pdf_texts.json', 'utf8');
const airStart = raw.indexOf('=== AIR BANK full ===\n') + '=== AIR BANK full ===\n'.length;
const revStart = raw.indexOf('\n=== REVOLUT full ===\n');
const airJson = raw.slice(airStart, revStart).trim();
const revJson = raw.slice(revStart + '\n=== REVOLUT full ===\n'.length).trim();
const airText = JSON.parse(airJson);
const revText = JSON.parse(revJson);

const airLines = airText.split('\n');
const revLines = revText.split('\n');

console.log('AIR BANK lines:', airLines.length);
console.log('REVOLUT lines:', revLines.length);

console.log('\n--- Air Bank first 50 lines ---');
airLines.slice(0,50).forEach((l,i) => console.log(`${i+1}: ${JSON.stringify(l)}`));

const p2idx = airLines.findIndex(l => l.includes('-- 2 of 7 --'));
console.log('\n--- Air Bank around page 2 start (idx', p2idx, ')---');
airLines.slice(p2idx, p2idx+50).forEach((l,i) => console.log(`${p2idx+i+1}: ${JSON.stringify(l)}`));

console.log('\n--- Revolut first 80 lines ---');
revLines.slice(0,80).forEach((l,i) => console.log(`${i+1}: ${JSON.stringify(l)}`));
