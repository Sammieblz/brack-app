// Read-only source census. Writes only the two generated audit artifacts beside this file.
// Import/commit presence is not rendered behavior, test execution, or completion evidence.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const output = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(output, '../../..');
const relative = p => path.relative(root, p).replaceAll('\\', '/');
const slash = p => p.replaceAll('\\', '/');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'dist', 'build', 'test-results', 'playwright-report', '.git', '.vite'].includes(entry.name) ? [] : walk(file);
    return [file];
  });
}
const testFile = p => /\.(test|spec)\.[cm]?[jt]sx?$/.test(p) || /\/(?:__tests__|test)\//.test(slash(p));
const sourceFiles = walk(path.join(root, 'apps/client/src')).filter(p => /\.(?:tsx?|css)$/.test(p) && !testFile(p) && !p.endsWith('.d.ts'));
const configPath = path.join(root, 'apps/client/tsconfig.app.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
const diagnostics = parsedConfig.errors.filter(error => error.category === ts.DiagnosticCategory.Error);
if (diagnostics.length) throw new Error(diagnostics.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
const resolveCache = ts.createModuleResolutionCache(root, name => name, parsedConfig.options);
function resolve(specifier, importer) {
  const match = ts.resolveModuleName(specifier, importer, parsedConfig.options, ts.sys, resolveCache).resolvedModule?.resolvedFileName;
  if (match && !match.includes('node_modules')) return relative(match);
  const css = specifier.startsWith('@/') ? path.join(root, 'apps/client/src', specifier.slice(2)) : path.resolve(path.dirname(importer), specifier);
  return fs.existsSync(css) && fs.statSync(css).isFile() ? relative(css) : null;
}
const modules = new Map();
const importsByIdentifier = new Map();
const routes = [];
for (const file of sourceFiles) {
  const name = relative(file);
  const content = fs.readFileSync(file, 'utf8');
  const record = { path: name, role: name.includes('/screens/') ? 'screen' : name.includes('/components/') ? 'component' : name.includes('/contexts/') ? 'context' : name.includes('/hooks/') ? 'hook' : /\/(App|main)\.tsx$/.test(name) ? 'entry' : name.endsWith('.css') ? 'style' : 'support', imports: [], importedBy: [], jsx: [], directTestImporters: [], changedIn: [], sourceReachable: false, routeImportReachability: [] };
  modules.set(name, record);
  if (file.endsWith('.css')) continue;
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  const imports = new Set(), jsx = new Set();
  const addImport = node => {
    const target = resolve(node.text, file);
    if (target) imports.add(target);
    return target;
  };
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly && !(ts.isImportDeclaration(node) && node.importClause?.isTypeOnly)) {
      const target = addImport(node.moduleSpecifier);
      if (name.endsWith('/App.tsx') && ts.isImportDeclaration(node) && target) {
        if (node.importClause?.name) importsByIdentifier.set(node.importClause.name.text, target);
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) importsByIdentifier.set(binding.name.text, target);
      }
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) addImport(node.arguments[0]);
    if (name.endsWith('/App.tsx') && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const findLazy = child => {
        if (ts.isCallExpression(child) && child.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(child.arguments[0])) importsByIdentifier.set(node.name.text, resolve(child.arguments[0].text, file));
        ts.forEachChild(child, findLazy);
      };
      findLazy(node.initializer);
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      jsx.add(tag);
      if (name.endsWith('/App.tsx') && tag === 'Route') {
        const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
        const routePath = attrs.find(attr => attr.name.getText(source) === 'path')?.initializer;
        const element = attrs.find(attr => attr.name.getText(source) === 'element')?.initializer;
        const tags = [];
        const findTags = child => {
          if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child)) tags.push(child.tagName.getText(source));
          ts.forEachChild(child, findTags);
        };
        if (element) findTags(element);
        if (routePath && ts.isStringLiteral(routePath)) routes.push({ path: routePath.text, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, elements: tags, owners: [] });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  record.imports = [...imports].sort();
  record.jsx = [...jsx].sort();
}
for (const record of modules.values()) for (const dependency of record.imports) modules.get(dependency)?.importedBy.push(record.path);
const reachable = start => {
  const found = new Set(), stack = [start];
  while (stack.length) {
    const name = stack.pop();
    if (!modules.has(name) || found.has(name)) continue;
    found.add(name); stack.push(...modules.get(name).imports);
  }
  return found;
};
for (const name of reachable('apps/client/src/main.tsx')) modules.get(name).sourceReachable = true;
for (const route of routes) {
  route.owners = route.elements.map(tag => importsByIdentifier.get(tag)).filter(Boolean);
  for (const owner of route.owners) for (const name of reachable(owner)) modules.get(name).routeImportReachability.push(route.path);
}
const tests = [...walk(path.join(root, 'apps/client/src')).filter(testFile), ...walk(path.join(root, 'tests')).filter(p => /\.[jt]sx?$/.test(p))];
for (const file of tests) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = node => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const target = resolve(node.moduleSpecifier.text, file);
      if (target && modules.has(target)) modules.get(target).directTestImporters.push(relative(file));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
const commits = { F01: '229dd67', 'F02/F03': '06d5190', 'F04/F05': '2ddc1c2', F06: 'f90509d', F07: '83e032b', F08: 'bd342dc', F09: 'db076cf' };
for (const [ticket, commit] of Object.entries(commits)) {
  const files = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', commit], { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/);
  for (const file of files) modules.get(file)?.changedIn.push(ticket);
}
const rows = [...modules.values()].sort((a, b) => a.path.localeCompare(b.path));
for (const row of rows) {
  row.routeImportReachability = [...new Set(row.routeImportReachability)].sort();
  row.importedBy.sort();
  row.directTestImporters = [...new Set(row.directTestImporters)].sort();
}
const presentation = rows.filter(row => ['screen', 'component', 'entry', 'style'].includes(row.role));
const data = {
  baseline: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  method: 'TypeScript AST static local import/literal dynamic-import reachability, JSX Route declarations, git commit file lists. No runtime, branches, feature-gate, tree-shaking, fixture alias/mock or per-export analysis. Declaration-level type-only imports are excluded; inline named type imports can still contribute edges. Import references and changed files do not establish review, runtime execution or passing tests. Unreachable means no source import path from main.tsx; verify before deletion. routeImportReachability follows route JSX owners, not their App-owned global ancestors: an empty route list does not exclude global rendering (e.g. Toaster, JournalPromptHandler, JourneyLevelUpObserver).',
  counts: { routes: routes.length, modules: rows.length, presentation: presentation.length, screens: rows.filter(row => row.role === 'screen').length, components: rows.filter(row => row.role === 'component').length, presentationWithoutSourcePath: presentation.filter(row => !row.sourceReachable).length },
  commits, routes, modules: rows,
};
fs.writeFileSync(path.join(output, 'inventory.json'), JSON.stringify(data, null, 2) + '\n');
const cell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const link = name => `[${name.replace('apps/client/src/', '')}](../../../${name})`;
const lines = ['# Frontend source census', '', `Baseline: \`${data.baseline}\`. Regenerate with \`node docs/frontend-renewal/coverage-review/generate-inventory.mjs\`.`, '', data.method, '', `**${data.counts.routes} routes; ${data.counts.screens} screen modules; ${data.counts.components} component modules; ${data.counts.modules} total client source modules/styles.** Component count includes primitives, helpers and CSS under components, not a count of distinct rendered widgets.`, '', 'This is an inventory, not a completed audit. Every row remains subject to the route/state and consumer acceptance tables in this review. Source-import reachability can overestimate actual rendering; a component can be imported but never used. Tests listed in JSON are direct imports only and may mock the production component.', '', '## Routes', '', '| Route | JSX owners | Source |', '| --- | --- | --- |', ...routes.map(route => `| ${cell(route.path)} | ${route.elements.join(', ')} | ${route.owners.map(link).join(', ')} |`), '', '## All presentation modules', '', '| Module | Role | Source import path from entry | Changed in F01–F09 commits | Direct source importers |', '| --- | --- | --- | --- | --- |', ...presentation.map(row => `| ${link(row.path)} | ${row.role} | ${row.sourceReachable ? 'yes (not render proof)' : 'none found; investigate'} | ${row.changedIn.join(', ') || '—'} | ${row.importedBy.map(name => cell(name.replace('apps/client/src/', ''))).join(', ') || '—'} |`), '', 'Full imports, reverse imports, JSX tags, potential route reachability and direct test imports for every client source module are in [inventory.json](inventory.json). Do not count rows as tested or use absence of direct tests to claim there is no transitive coverage.', ''];
fs.writeFileSync(path.join(output, '01-source-census.md'), lines.join('\n'));
process.stdout.write(JSON.stringify(data.counts) + '\n');
