// Static shields.io endpoint badges, one per Neurodesk application:
//   https://img.shields.io/endpoint?url=https://neurodesk.org/data/badges/<tool>.json
// Generated at build time from public/data/applist.json, so the badge message
// always shows the newest container version listed on /overview/applications/.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { APIRoute, GetStaticPaths } from 'astro';

interface AppListEntry {
	application: string;
}

interface Latest {
	version: string;
	buildDate: string;
}

function latestVersions(): Map<string, Latest> {
	const raw = readFileSync(join(process.cwd(), 'public', 'data', 'applist.json'), 'utf8');
	const entries: AppListEntry[] = JSON.parse(raw).list ?? [];
	const latest = new Map<string, Latest>();

	for (const { application } of entries) {
		// Same convention as ApplicationsBrowser: name_version_YYYYMMDD.
		const parts = application.split('_');
		if (parts.length < 3) continue;
		const buildDate = parts[parts.length - 1];
		const version = parts[parts.length - 2];
		const name = parts.slice(0, -2).join('_');
		const current = latest.get(name);
		if (!current || buildDate > current.buildDate) {
			latest.set(name, { version, buildDate });
		}
	}
	return latest;
}

export const getStaticPaths: GetStaticPaths = () =>
	Array.from(latestVersions(), ([tool, { version }]) => ({
		params: { tool },
		props: { version },
	}));

export const GET: APIRoute = ({ props }) =>
	new Response(
		JSON.stringify({
			schemaVersion: 1,
			label: 'Neurodesk',
			// Most versions are bare numbers (4.2.0); leave tags like v1.0 or r2021a as they are.
			message: /^\d/.test(props.version) ? `v${props.version}` : props.version,
			color: '6aa329',
		}),
		{ headers: { 'Content-Type': 'application/json' } },
	);
