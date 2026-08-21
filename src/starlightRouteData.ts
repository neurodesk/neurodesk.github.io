import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const DEVELOPER_GROUP = 'For developers';

export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	const path = context.url.pathname;

	// The landing page uses `template: splash`, which Starlight treats as
	// `hasSidebar: false`. That also removes the mobile hamburger, leaving the
	// page with no navigation on small screens. Re-enable the sidebar for this
	// route so the hamburger renders; custom.css keeps the sidebar column itself
	// hidden on desktop so the splash layout is unchanged.
	if (path === '/') {
		route.hasSidebar = true;
	}

	// Developer documentation gets its own sidebar rather than sitting as one
	// group among the user-facing docs. Inside /developers/ the sidebar shows
	// only that section, expanded; everywhere else it is omitted. The header
	// links are how you cross between the two.
	const inDevelopers = path.startsWith('/developers');
	route.sidebar = route.sidebar
		.filter((entry) =>
			inDevelopers ? entry.label === DEVELOPER_GROUP : entry.label !== DEVELOPER_GROUP
		)
		.map((entry) =>
			inDevelopers && entry.type === 'group' ? { ...entry, collapsed: false } : entry
		);
});
