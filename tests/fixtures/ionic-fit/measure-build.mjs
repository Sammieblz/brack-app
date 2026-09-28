import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const fixtureRoot = fileURLToPath(new URL('.', import.meta.url));
const repositoryRoot = resolve(fixtureRoot, '../../..');
const distRoot = resolve(fixtureRoot, 'dist');
const manifestPath = resolve(distRoot, '.vite/manifest.json');
const expectedEntries = ['index.html', 'baseline.html', 'navigation.html'];
const args = process.argv.slice(2);

if (args.length !== 0 && (args.length !== 2 || args[0] !== '--output')) {
  throw new Error('Usage: node tests/fixtures/ionic-fit/measure-build.mjs [--output test-results/ionic-fit/bundle-report.json]');
}

const isWithin = (parent, target) => {
  const remainder = relative(parent, target);
  return remainder !== '' && !isAbsolute(remainder) && remainder !== '..' && !remainder.startsWith(`..${sep}`);
};

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const getChunk = (key) => {
  if (!manifest[key]) throw new Error(`Manifest dependency is missing: ${key}`);
  return manifest[key];
};

const closure = (entryKey, includeDynamic = false) => {
  const visited = new Set();
  const visit = (key) => {
    if (visited.has(key)) return;
    visited.add(key);
    const chunk = getChunk(key);
    for (const dependency of chunk.imports ?? []) visit(dependency);
    if (includeDynamic) for (const dependency of chunk.dynamicImports ?? []) visit(dependency);
  };
  visit(entryKey);
  return visited;
};

const filesFor = (keys) => {
  const files = new Set();
  for (const key of keys) {
    const chunk = getChunk(key);
    if (chunk.file) files.add(chunk.file);
    for (const css of chunk.css ?? []) files.add(css);
  }
  return files;
};

const sizeCache = new Map();
const measureFile = async (file) => {
  if (sizeCache.has(file)) return sizeCache.get(file);
  const absolute = resolve(distRoot, file);
  if (!isWithin(distRoot, absolute)) throw new Error(`Artifact escapes fixture dist: ${file}`);
  const buffer = await readFile(absolute);
  const result = { file, rawBytes: buffer.byteLength, gzipBytes: gzipSync(buffer, { level: 9 }).byteLength };
  sizeCache.set(file, result);
  return result;
};

const totals = (files) => ({
  fileCount: files.length,
  rawBytes: files.reduce((sum, file) => sum + file.rawBytes, 0),
  gzipBytes: files.reduce((sum, file) => sum + file.gzipBytes, 0),
});

const measureFiles = async (fileSet) => {
  const js = [];
  const css = [];
  for (const file of [...fileSet].sort()) {
    if (/\.[cm]?js$/.test(file)) js.push(await measureFile(file));
    else if (/\.css$/.test(file)) css.push(await measureFile(file));
  }
  return { js: { ...totals(js), files: js }, css: { ...totals(css), files: css }, total: totals([...js, ...css]) };
};

const entries = {};
for (const entry of expectedEntries) {
  const candidates = Object.keys(manifest).filter((key) => manifest[key].isEntry &&
    (key === entry || manifest[key].src === entry || key.endsWith(`/${entry}`)));
  if (candidates.length !== 1) throw new Error(`Expected one manifest entry for ${entry}; found ${candidates.length}`);
  const key = candidates[0];
  const initialKeys = closure(key);
  const reachableKeys = closure(key, true);
  const initialFiles = filesFor(initialKeys);
  const lazyKeys = [...reachableKeys].filter((chunkKey) => !initialKeys.has(chunkKey)).sort();
  const lazyFiles = new Set([...filesFor(lazyKeys)].filter((file) => !initialFiles.has(file)));

  entries[entry] = {
    manifestKey: key,
    initial: await measureFiles(initialFiles),
    lazyAdditional: await measureFiles(lazyFiles),
    lazyChunks: await Promise.all(lazyKeys.map(async (chunkKey) => {
      const chunk = getChunk(chunkKey);
      return { manifestKey: chunkKey, ...(await measureFile(chunk.file)),
        imports: chunk.imports ?? [], dynamicImports: chunk.dynamicImports ?? [], css: chunk.css ?? [] };
    })),
    referencedNonCodeAssets: [...new Set([...reachableKeys].flatMap((chunkKey) => getChunk(chunkKey).assets ?? []))].sort(),
  };
}

const primitive = entries['index.html'].initial.total;
const baseline = entries['baseline.html'].initial.total;
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  manifest: 'tests/fixtures/ionic-fit/dist/.vite/manifest.json',
  method: {
    raw: 'Exact emitted file bytes.',
    gzip: 'Each unique emitted file compressed independently using Node gzip level 9; actual server encoding may differ.',
    initial: 'Entry file plus transitive static imports and their CSS, counted once per entry.',
    lazy: 'Reachable dynamic chunks and their static imports, excluding initial files; possible later loads, not initial transfer.',
    exclusions: 'HTML, maps, fonts, images, native binaries, HTTP headers and cache effects are excluded from JS/CSS totals.',
    comparison: 'index.html versus baseline.html is the matched primitive comparison. navigation.html exercises a different route/tab experience and is not an apples-to-apples baseline delta.',
  },
  entries,
  primitiveMinusBaselineInitial: { rawBytes: primitive.rawBytes - baseline.rawBytes, gzipBytes: primitive.gzipBytes - baseline.gzipBytes },
  allEmittedManifestJavaScriptAndCss: await measureFiles(filesFor(Object.keys(manifest))),
};

const output = `${JSON.stringify(report, null, 2)}\n`;
if (args.length) {
  const outputPath = resolve(repositoryRoot, args[1]);
  const artifactRoot = resolve(repositoryRoot, 'test-results');
  if (!isWithin(artifactRoot, outputPath) || !outputPath.endsWith('.json')) {
    throw new Error('Output must be a .json file inside the repository test-results directory.');
  }
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, output);
}
process.stdout.write(output);
