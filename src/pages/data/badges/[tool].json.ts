// Static shields.io endpoint badges, one per Neurodesk application:
//   https://img.shields.io/endpoint?url=https://neurodesk.org/data/badges/<tool>.json
// Generated at build time from the remote apps.json, so the badge message
// always shows the newest container version listed on /overview/applications/.
import type { APIRoute, GetStaticPaths } from 'astro';

const APPS_JSON_URL = 'https://apps-json.scigetorg.workers.dev/neuroimaging/apps.json';

interface AppsJsonApp {
	version: string;
	image: string;
	show_in_applist?: boolean;
}

interface AppsJsonTool {
	apps: Record<string, AppsJsonApp>;
}

interface Latest {
	version: string;
	buildDate: string;
}

async function latestVersions(): Promise<Map<string, Latest>> {
	const res = await fetch(APPS_JSON_URL);
	if (!res.ok) throw new Error(`Failed to fetch apps.json: HTTP ${res.status}`);
	const data: Record<string, AppsJsonTool> = await res.json();
	const latest = new Map<string, Latest>();

	for (const tool of Object.values(data)) {
		for (const app of Object.values(tool.apps)) {
			if (app.show_in_applist === false) continue;
			// image is "name_version", version (buildDate) is "YYYYMMDD"
			const parts = app.image.split('_');
			if (parts.length < 2) continue;
			const semver = parts[parts.length - 1];
			const name = parts.slice(0, -1).join('_');
			const buildDate = app.version;
			if (!name || !semver || !/^\d{8}$/.test(buildDate)) continue;
			const current = latest.get(name);
			if (!current || buildDate > current.buildDate) {
				latest.set(name, { version: semver, buildDate });
			}
		}
	}
	return latest;
}

export const getStaticPaths: GetStaticPaths = async () =>
	Array.from(await latestVersions(), ([tool, { version }]) => ({
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
