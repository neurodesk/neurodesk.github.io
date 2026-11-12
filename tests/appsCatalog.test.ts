import assert from 'node:assert/strict';
import test from 'node:test';
import { latestReleases, parseAppsFeed, toAppList } from '../src/lib/appsCatalog.ts';

const feed = () => ({
	afni: {
		categories: ['functional imaging'],
		apps: {
			'afni 24.3.00': {
				version: '20241003',
				exec: '',
				image: 'afni_24.3.00',
				doi: 'https://doi.org/10.5281/zenodo.1',
				license: ['GPL-3.0'],
			},
			'sumaGUI-afni 24.3.00': { version: '20241003', exec: 'suma', image: 'afni_24.3.00' },
			'afni 26.3.11': { version: '20261101', exec: '', image: 'afni_26.3.11', license: ['GPL-3.0', 'MIT'] },
		},
	},
	amico: {
		categories: ['diffusion imaging'],
		apps: {
			'amico 2.1.0': { version: '20250101', exec: '', image: 'amico_2.1.0_arm64' },
			'amico hidden': { version: '20260101', exec: '', image: 'amico_9.9.9', show_in_applist: false },
		},
	},
	musclemap: {
		categories: ['image segmentation'],
		description: 'From the feed',
		apps: { 'musclemap 1.0': { version: '20260601', exec: '', image: 'musclemap_1.0' } },
	},
});

const metadata = {
	afni: { description: 'Analysis of Functional NeuroImages' },
	amico: { description: 'Accelerated microstructure imaging' },
	musclemap: { description: 'From the snapshot', openrecon: true },
};

const list = () => toAppList(parseAppsFeed(feed()), metadata);

test('every build of a tool carries its description, so search can match it', () => {
	const afni = list().filter((entry) => entry.name === 'afni');
	assert.equal(afni.length, 2);
	for (const entry of afni) assert.equal(entry.description, 'Analysis of Functional NeuroImages');
});

test('a description in the feed wins over the snapshot', () => {
	const [musclemap] = list().filter((entry) => entry.name === 'musclemap');
	assert.equal(musclemap.description, 'From the feed');
});

test('OpenRecon tools are flagged and other tools are not', () => {
	const flagged = list().filter((entry) => entry.openrecon).map((entry) => entry.name);
	assert.deepEqual(flagged, ['musclemap']);
	assert.equal(list().find((entry) => entry.name === 'afni')?.openrecon, undefined);
});

test('launchers sharing an image collapse to one entry and hidden launchers are dropped', () => {
	assert.deepEqual(
		list().map((entry) => entry.application),
		['afni_24.3.00_20241003', 'afni_26.3.11_20261101', 'amico_2.1.0_arm64_20250101', 'musclemap_1.0_20260601'],
	);
});

test('a hidden launcher does not hide a visible one built from the same image', () => {
	const data = feed();
	data.afni.apps['sumaGUI-afni 24.3.00'] = { ...data.afni.apps['sumaGUI-afni 24.3.00'], show_in_applist: false } as never;
	const afni = toAppList(parseAppsFeed(data), metadata).filter((entry) => entry.name === 'afni');
	assert.equal(afni.length, 2);
});

test('names come from the tool key, so versions may contain underscores', () => {
	const amico = list().find((entry) => entry.name === 'amico');
	assert.deepEqual(
		{ name: amico?.name, version: amico?.version, build_date: amico?.build_date },
		{ name: 'amico', version: '2.1.0_arm64', build_date: '20250101' },
	);
});

test('licenses and DOIs are kept per build', () => {
	const [older, newer] = list().filter((entry) => entry.name === 'afni');
	assert.deepEqual(older.license, ['GPL-3.0']);
	assert.equal(older.doi_url, 'https://doi.org/10.5281/zenodo.1');
	assert.deepEqual(newer.license, ['GPL-3.0', 'MIT']);
	assert.equal(newer.doi_url, undefined);
});

test('badges report the newest visible build of each tool', () => {
	const latest = latestReleases(list());
	assert.deepEqual(
		Object.fromEntries([...latest].map(([name, entry]) => [name, entry.version])),
		{ afni: '26.3.11', amico: '2.1.0_arm64', musclemap: '1.0' },
	);
});

test('malformed feeds are rejected', () => {
	const cases: Array<[string, (data: any) => unknown]> = [
		['not an object', () => []],
		['tool without apps', (data) => ({ ...data, afni: { categories: [] } })],
		['categories not a list', (data) => ({ ...data, afni: { ...data.afni, categories: 'x' } })],
		['bad build date', (data) => ((data.afni.apps['afni 24.3.00'].version = '2024-10-03'), data)],
		['image from another tool', (data) => ((data.afni.apps['afni 24.3.00'].image = 'fsl_6.0'), data)],
		['image without a version', (data) => ((data.afni.apps['afni 24.3.00'].image = 'afni_'), data)],
		['license not a list', (data) => ((data.afni.apps['afni 24.3.00'].license = 'GPL-3.0'), data)],
		['non-boolean visibility', (data) => ((data.afni.apps['afni 24.3.00'].show_in_applist = 'no'), data)],
		['non-string description', (data) => ((data.afni.description = 1), data)],
	];
	for (const [label, mutate] of cases) {
		assert.throws(() => parseAppsFeed(mutate(feed())), Error, label);
	}
});

test('a feed with nothing visible fails instead of publishing an empty catalog', () => {
	assert.throws(() => toAppList(parseAppsFeed({}), metadata), /no visible applications/);
	const hidden = { afni: { categories: [], apps: { a: { version: '20240101', image: 'afni_1', show_in_applist: false } } } };
	assert.throws(() => toAppList(parseAppsFeed(hidden), metadata), /no visible applications/);
});
