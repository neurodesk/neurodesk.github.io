// Regenerates src/data/app-metadata.json: per-tool descriptions and OpenRecon
// flags that the apps.json feed does not carry yet.
//
//   pnpm update:app-metadata                      # shallow-clones neurocontainers
//   pnpm update:app-metadata /path/to/neurocontainers
//
// Tools are the directories under releases/, the same keys apps.json uses.
// Each tool maps to its recipe the way scigetorg/apps.json does: the release
// JSON's `recipe` field, else the tool name, else the tool without `_arm64`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const REPOSITORY = 'neurodesk/neurocontainers';
const OUTPUT = fileURLToPath(new URL('../src/data/app-metadata.json', import.meta.url));

// A readme opens with a separator and a "## name/version ##" title, then the
// description, then usage sections. Anything matching these ends the description.
const SECTION_END =
	/^(##\s|```|Examples?:?|---+$|More documentation|To setup|Licensing|Usage|Citation)/i;
const TITLE = /^(##\s.*|[\w.+-]+\/(\{\{[^}]*\}\}|\S)+)$/;
const SEPARATOR = /^-{3,}$/;
const PLACEHOLDER = /\{\{\s*(?:context\.)?(\w+)\s*\}\}/g;

export function describe(readme, context = {}) {
	if (typeof readme !== 'string') return undefined;
	const lines = readme.split('\n').map((line) => line.trim());
	let start = 0;
	while (start < lines.length && (!lines[start] || SEPARATOR.test(lines[start]))) start++;
	if (TITLE.test(lines[start] ?? '')) start++;
	const body = [];
	for (const line of lines.slice(start)) {
		if (SECTION_END.test(line)) break;
		body.push(line);
	}
	const text = render(body.join(' '), context).replace(/\s+/g, ' ').trim();
	return text || undefined;
}

// Recipe variables may reference each other, so render until nothing changes.
// Unknown keys stay as written rather than guessing a value.
function render(text, context) {
	for (let pass = 0; pass < 5; pass++) {
		const next = text.replace(PLACEHOLDER, (match, key) => {
			const value = context[key];
			return typeof value === 'string' || typeof value === 'number' ? String(value) : match;
		});
		if (next === text) break;
		text = next;
	}
	return text;
}

function readOptional(path) {
	try {
		return readFileSync(path, 'utf8');
	} catch (error) {
		if (error.code === 'ENOENT') return undefined;
		throw error;
	}
}

function recipeFor(source, tool) {
	const releases = join(source, 'releases', tool);
	for (const file of readdirSync(releases).filter((name) => name.endsWith('.json'))) {
		const { recipe } = JSON.parse(readFileSync(join(releases, file), 'utf8'));
		if (typeof recipe === 'string' && recipe) return recipe;
	}
	if (!existsSync(join(source, 'recipes', tool)) && tool.endsWith('_arm64')) return tool.slice(0, -6);
	return tool;
}

function recipeMetadata(directory) {
	if (!existsSync(directory)) return {};
	const recipe = YAML.parse(readOptional(join(directory, 'build.yaml')) ?? '{}') ?? {};
	const variables = Object.fromEntries(
		Object.entries(recipe.variables ?? {}).filter(([, value]) => typeof value !== 'object'),
	);
	const context = { ...variables, name: recipe.name, version: recipe.version };
	const description =
		describe(recipe.readme, context) ?? describe(readOptional(join(directory, 'README.md')), context);
	const openrecon = readdirSync(directory).some((name) => /^OpenReconLabel.*\.json$/.test(name));
	return { ...(description && { description }), ...(openrecon && { openrecon }) };
}

export function collectMetadata(source) {
	const tools = {};
	const names = readdirSync(join(source, 'releases'), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	for (const tool of names) {
		const metadata = recipeMetadata(join(source, 'recipes', recipeFor(source, tool)));
		if (Object.keys(metadata).length) tools[tool] = metadata;
	}
	return tools;
}

function git(args, options) {
	const result = spawnSync('git', args, { encoding: 'utf8', ...options });
	if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed:\n${result.stderr}`);
	return result.stdout.trim();
}

function main() {
	let source = process.argv[2];
	let cleanup;
	if (!source) {
		cleanup = mkdtempSync(join(tmpdir(), 'neurocontainers-'));
		source = join(cleanup, 'neurocontainers');
		git(['clone', '--depth=1', '--quiet', `https://github.com/${REPOSITORY}.git`, source]);
	}
	try {
		const commit = git(['rev-parse', 'HEAD'], { cwd: source });
		const tools = collectMetadata(source);
		writeFileSync(OUTPUT, `${JSON.stringify({ source: { repository: REPOSITORY, commit }, tools }, null, '\t')}\n`);
		const described = Object.values(tools).filter((tool) => tool.description).length;
		const openrecon = Object.values(tools).filter((tool) => tool.openrecon).length;
		console.log(`Wrote ${OUTPUT}: ${described} descriptions, ${openrecon} OpenRecon tools from ${commit}`);
	} finally {
		if (cleanup) rmSync(cleanup, { recursive: true, force: true });
	}
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
