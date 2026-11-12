// Static shields.io endpoint badges, one per Neurodesk application:
//   https://img.shields.io/endpoint?url=https://neurodesk.org/data/badges/<tool>.json
// Built from the same catalog as /data/applist.json, so the badge message
// always shows the newest container version listed on /overview/applications/.
import type { APIRoute, GetStaticPaths } from 'astro';
import { latestReleases, loadAppList } from '../../../lib/appsCatalog';

export const getStaticPaths: GetStaticPaths = async () =>
	Array.from(latestReleases(await loadAppList()), ([tool, { version }]) => ({
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
