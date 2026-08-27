import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(testDir, '..');
const dataDir = path.join(projectDir, 'public', 'data');
const providerDir = path.join(dataDir, 'providers');
const themeKeys = [
  'teaching',
  'learning_opportunities',
  'assessment_feedback',
  'academic_support',
  'organisation_management',
  'learning_resources',
  'student_voice',
];

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

const manifest = await readJson(path.join(dataDir, 'manifest.json'));
const universities = await readJson(path.join(dataDir, 'universities.json'));
const catalog = await readJson(path.join(dataDir, 'subjects.json'));
const providerFiles = (await fs.readdir(providerDir)).filter((file) => file.endsWith('.json'));
const providers = await Promise.all(providerFiles.map((file) => readJson(path.join(providerDir, file))));

function resultsFor(provider) {
  return [provider.overall, ...provider.subjects.CAH1, ...provider.subjects.CAH2, ...provider.subjects.CAH3]
    .filter(Boolean);
}

test('build output preserves the verified source counts', () => {
  assert.equal(manifest.university_count, 167);
  assert.equal(manifest.record_count, 10_386);
  assert.deepEqual(manifest.counts_by_level, { All: 166, CAH1: 1926, CAH2: 2750, CAH3: 5544 });
  assert.equal(universities.length, 167);
  assert.equal(providerFiles.length, 167);
  assert.equal(providers.flatMap(resultsFor).length, 10_386);
});

test('global CAH catalog has the expected hierarchy', () => {
  assert.equal(catalog.CAH1.length, 21);
  assert.equal(catalog.CAH2.length, 35);
  assert.equal(catalog.CAH3.length, 161);

  const cah1 = new Set(catalog.CAH1.map(({ code }) => code));
  const cah2 = new Set(catalog.CAH2.map(({ code }) => code));
  assert.ok(catalog.CAH2.every(({ parent_code }) => cah1.has(parent_code)));
  assert.ok(catalog.CAH3.every(({ parent_code }) => cah2.has(parent_code)));
});

test('every calculated experience score follows the seven-theme rule', () => {
  for (const result of providers.flatMap(resultsFor)) {
    const values = themeKeys.map((key) => result.metrics[key]?.positivity ?? null);
    assert.equal(values.length, 7);
    if (values.some((value) => value === null)) {
      assert.equal(result.experience_score_calculated, null);
      continue;
    }
    const average = values.reduce((sum, value) => sum + value, 0) / 7;
    assert.ok(
      Math.abs(result.experience_score_calculated - average) < 0.011,
      `${result.UKPRN} ${result.subject_code}: ${result.experience_score_calculated} != ${average}`,
    );
  }
});

test('University of London retains eight subjects and an unpublished overall result', () => {
  const london = providers.find(({ UKPRN }) => UKPRN === '10007797');
  assert.ok(london);
  assert.equal(london.overall, null);
  assert.equal(london.subjects.CAH1.length + london.subjects.CAH2.length + london.subjects.CAH3.length, 8);
  assert.equal(universities.find(({ UKPRN }) => UKPRN === '10007797')?.has_overall, false);
});

test('all four official BK benchmark suppressions remain visible', () => {
  const suppressed = providers
    .flatMap(resultsFor)
    .filter((result) => result.suppression_flags.includes('BK'));
  assert.equal(suppressed.length, 4);
  for (const result of suppressed) {
    assert.ok(themeKeys.some((key) => result.metrics[key].positivity !== null));
    assert.ok(themeKeys.some((key) => result.metrics[key].benchmark === null));
  }
});

test('five target universities match the validated overall regressions', () => {
  const expected = {
    '10003270': { score: 87.2, respondents: 2077 },
    '10007784': { score: 82.96, respondents: 4528 },
    '10007790': { score: 80.54, respondents: 3670 },
    '10007803': { score: 90.69, respondents: 1071 },
    '10007163': { score: 87.47, respondents: 4001 },
  };

  for (const [UKPRN, regression] of Object.entries(expected)) {
    const provider = providers.find((item) => item.UKPRN === UKPRN);
    assert.ok(provider?.overall, `missing overall record for ${UKPRN}`);
    assert.equal(provider.overall.experience_score_calculated, regression.score);
    assert.equal(provider.overall.respondents, regression.respondents);
  }
});

test('the initial page data stays small and never exposes the audit JSON', async () => {
  const initialIndex = await fs.stat(path.join(dataDir, 'universities.json'));
  assert.ok(initialIndex.size < 100_000, `university index is ${initialIndex.size} bytes`);
  await assert.rejects(fs.access(path.join(projectDir, 'public', 'nss2026_web.json')));
  await assert.rejects(fs.access(path.join(dataDir, 'nss2026_web.json')));
});

test('published data contains low-sample and benchmark-missing states for UI coverage', () => {
  const results = providers.flatMap(resultsFor);
  assert.ok(results.some(({ respondents }) => respondents !== null && respondents < 30));
  assert.ok(results.some((result) => themeKeys.some((key) => result.metrics[key].benchmark === null)));
});
