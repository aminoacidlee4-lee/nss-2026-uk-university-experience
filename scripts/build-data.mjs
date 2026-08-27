import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, '..');
const sourcePath = path.resolve(
  projectDir,
  '../outputs/01a03cfe-7403-7302-9378-d514cd525abd/nss2026_web.json',
);
const outputDir = path.join(projectDir, 'public', 'data');
const providersDir = path.join(outputDir, 'providers');

const levelOrder = ['CAH1', 'CAH2', 'CAH3'];

function parentCode(level, code) {
  if (level === 'CAH2') return code.split('-')[0];
  if (level === 'CAH3') return code.split('-').slice(0, 2).join('-');
  return null;
}

function sortSubjects(a, b) {
  return a.subject_code.localeCompare(b.subject_code) || a.subject_name.localeCompare(b.subject_name);
}

export async function buildData() {
  const source = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
  const catalogMaps = Object.fromEntries(levelOrder.map((level) => [level, new Map()]));
  const universities = [];
  const counts = { All: 0, CAH1: 0, CAH2: 0, CAH3: 0 };

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(providersDir, { recursive: true });

  for (const university of source.universities) {
    const subjects = {};
    for (const level of levelOrder) {
      subjects[level] = [...university.subjects[level]].sort(sortSubjects);
      counts[level] += subjects[level].length;
      for (const subject of subjects[level]) {
        catalogMaps[level].set(subject.subject_code, subject.subject_name);
      }
    }
    if (university.overall) counts.All += 1;

    const providerPayload = {
      schema_version: '1.0.0',
      UKPRN: university.UKPRN,
      provider_name: university.provider_name,
      overall: university.overall,
      subjects,
    };
    const recordCount = (university.overall ? 1 : 0)
      + levelOrder.reduce((total, level) => total + subjects[level].length, 0);
    universities.push({
      UKPRN: university.UKPRN,
      provider_name: university.provider_name,
      has_overall: Boolean(university.overall),
      record_count: recordCount,
    });
    await fs.writeFile(
      path.join(providersDir, `${university.UKPRN}.json`),
      JSON.stringify(providerPayload),
    );
  }

  universities.sort((a, b) => a.provider_name.localeCompare(b.provider_name));
  const catalog = Object.fromEntries(
    levelOrder.map((level) => [
      level,
      [...catalogMaps[level].entries()]
        .map(([code, name]) => ({ code, name, parent_code: parentCode(level, code) }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    ]),
  );
  const totalRecords = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const manifest = {
    dataset: 'National Student Survey 2026 university and CAH theme results',
    schema_version: '1.0.0',
    year: 2026,
    generated_at: new Date().toISOString(),
    university_count: universities.length,
    record_count: totalRecords,
    counts_by_level: counts,
    theme_count: 7,
    publication_scope: source.metadata.scope,
  };

  await Promise.all([
    fs.writeFile(path.join(outputDir, 'universities.json'), JSON.stringify(universities)),
    fs.writeFile(path.join(outputDir, 'subjects.json'), JSON.stringify(catalog)),
    fs.writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest)),
  ]);
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = await buildData();
  console.log(
    `Generated ${manifest.university_count} provider files and ${manifest.record_count} records.`,
  );
}
