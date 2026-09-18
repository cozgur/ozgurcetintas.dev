// Fills the fact line of each project from the numbers that project publishes, so the
// portfolio cannot quietly drift from reality. Every source is a facts.json written by
// that project's own CI. A source that cannot be reached leaves the committed sentence
// untouched rather than printing a placeholder or a stale number.
import { readFileSync, writeFileSync } from 'node:fs';

const file = process.argv[2] ?? 'site/index.html';

const SOURCES = [
  { key: 'trident', url: 'https://cozgur.github.io/trident/facts.json', sentence: tridentSentence },
  { key: 'lab', url: 'https://lab.ozgurcetintas.dev/facts.json', sentence: labSentence },
  { key: 'studio', url: 'https://studio.ozgurcetintas.dev/facts.json', sentence: studioSentence },
];

function tridentSentence(f) {
  return [
    f.publishedModules && f.releasedVersion
      ? `${f.publishedModules} modules on Maven Central at v${f.releasedVersion}`
      : f.publishedModules && `${f.publishedModules} modules on Maven Central`,
    f.scenarios && `${f.scenarios} scenarios across two suites`,
    f.archetypeToGreenSeconds && `${f.archetypeToGreenSeconds}s from archetype:generate to a green suite`,
    f.adrs && `${f.adrs} ADRs`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function labSentence(f) {
  return [
    f.ciJobs && `${f.ciJobs} parallel CI jobs`,
    '9 quality layers',
    total(f) && `${total(f)} automated tests`,
    f.mutationScore != null && `${f.mutationScore}% mutation score`,
    f.coverageLines != null && `${round(f.coverageLines)}% coverage`,
    f.performance && `p95 ${f.performance.p95Ms} ms`,
    f.adrs && `${f.adrs} ADRs`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function studioSentence(f) {
  return [
    f.unitTests && `${f.unitTests} unit and component tests`,
    f.e2eTests && `${f.e2eTests} E2E with network-level API mocks`,
    f.coverageLines != null && `${round(f.coverageLines)}% coverage`,
    'verified end to end on Claude Opus 5',
    f.adrs && `${f.adrs} ADRs`,
  ]
    .filter(Boolean)
    .join(' · ');
}

const total = (f) => (f.unitTests ?? 0) + (f.e2eTests ?? 0) || null;
const round = (n) => Math.round(n * 10) / 10;
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let html = readFileSync(file, 'utf8');

for (const source of SOURCES) {
  try {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const facts = await response.json();
    const sentence = source.sentence(facts);
    if (!sentence) throw new Error('no usable facts');
    const pattern = new RegExp(`(<p class="facts" data-facts="${source.key}">)([\\s\\S]*?)(</p>)`);
    if (!pattern.test(html)) throw new Error('no placeholder in the page');
    html = html.replace(pattern, `$1${escape(sentence)}$3`);
    console.log(`${source.key}: ${sentence}`);
  } catch (error) {
    console.log(`${source.key}: keeping the committed sentence (${error.message})`);
  }
}

writeFileSync(file, html);
