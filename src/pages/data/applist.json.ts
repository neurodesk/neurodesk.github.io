// Same-origin copy of the application catalog for the /overview/applications/
// browser, built once per deploy from apps.json (see src/lib/appsCatalog.ts).
import type { APIRoute } from 'astro';
import { loadAppList } from '../../lib/appsCatalog';

export const GET: APIRoute = async () =>
	new Response(JSON.stringify({ list: await loadAppList() }), {
		headers: { 'Content-Type': 'application/json' },
	});
