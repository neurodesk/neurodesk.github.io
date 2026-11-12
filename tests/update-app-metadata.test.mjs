import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { collectMetadata, describe } from '../scripts/update-app-metadata.mjs';

test('describe takes the text between the title and the first usage section', () => {
	const readme = [
		'----------------------------------',
		'## afni/{{ context.version }} ##',
		'AFNI analyses functional',
		'MRI data.',
		'',
		'Example:',
		'```',
		'afni',
		'```',
	].join('\n');
	assert.equal(describe(readme), 'AFNI analyses functional MRI data.');
});

test('describe accepts a bare name/version title and renders recipe variables', () => {
	const readme = 'acsrss/{{ context.version }}\nPackages {{ context.tool }} {{ context.version }}.\n{{ context.missing }} stays.';
	assert.equal(
		describe(readme, { version: '1.2', tool: 'ACS {{ context.version }}' }),
		'Packages ACS 1.2 1.2. {{ context.missing }} stays.',
	);
});

test('describe returns nothing when the readme has no description', () => {
	assert.equal(describe('## x/1 ##\nExample:\nrun x'), undefined);
	assert.equal(describe(undefined), undefined);
});

function write(root, path, text) {
	mkdirSync(dirname(join(root, path)), { recursive: true });
	writeFileSync(join(root, path), text);
}

test('collectMetadata maps every released tool to its recipe', () => {
	const root = mkdtempSync(join(tmpdir(), 'app-metadata-'));
	try {
		const release = JSON.stringify({ apps: {}, categories: [] });
		write(root, 'releases/afni/1.json', release);
		write(root, 'releases/ants_arm64/1.json', release);
		write(root, 'releases/renamed/1.json', JSON.stringify({ apps: {}, categories: [], recipe: 'newname' }));
		write(root, 'releases/retired/1.json', release);
		write(root, 'releases/scanner/1.json', release);
		write(root, 'recipes/afni/build.yaml', 'name: afni\nversion: "26.0"\nreadme: |\n  ## afni/{{ context.version }} ##\n  AFNI {{ context.version }}.\n');
		write(root, 'recipes/ants/build.yaml', 'name: ants\nversion: "2.6"\n');
		write(root, 'recipes/ants/README.md', '## ants/2.6 ##\nANTs registration.\n');
		write(root, 'recipes/newname/build.yaml', 'name: newname\nversion: "1"\nreadme: |\n  newname/1\n  Renamed tool.\n');
		write(root, 'recipes/scanner/build.yaml', 'name: scanner\nversion: "1"\n');
		write(root, 'recipes/scanner/OpenReconLabel.gpu.json', '{}');

		assert.deepEqual(collectMetadata(root), {
			afni: { description: 'AFNI 26.0.' },
			ants_arm64: { description: 'ANTs registration.' },
			renamed: { description: 'Renamed tool.' },
			scanner: { openrecon: true },
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
