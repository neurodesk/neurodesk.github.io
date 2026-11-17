import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import type { StarlightRouteData } from '@astrojs/starlight/route-data';

const DEVELOPER_GROUP = 'For developers';

// A table of contents earns its column once there are at least this many
// headings to jump between. Below that it lists the page title and maybe one
// heading, which the reader can already see.
const MIN_TOC_HEADINGS = 2;

type TocItem = NonNullable<StarlightRouteData['toc']>['items'][number];

const countHeadings = (items: TocItem[]): number =>
	items.reduce(
		(sum, item) => sum + (item.slug === '_top' ? 0 : 1) + countHeadings(item.children),
		0
	);

export const onRequest = defineRouteMiddleware((context) => {
	const route = context.locals.starlightRoute;
	const path = context.url.pathname;

	// Developer docs get their own sidebar; the header links cross between them.
	const inDevelopers = path.startsWith('/developers');
	route.sidebar = route.sidebar
		.filter((entry) =>
			inDevelopers ? entry.label === DEVELOPER_GROUP : entry.label !== DEVELOPER_GROUP
		)
		.map((entry) =>
			inDevelopers && entry.type === 'group' ? { ...entry, collapsed: false } : entry
		);

	// Dropping the TOC also drops Starlight's `data-has-toc`, which removes the
	// right column on desktop and the "On this page" bar on mobile.
	if (route.toc && countHeadings(route.toc.items) < MIN_TOC_HEADINGS) {
		route.toc = undefined;
	}
});
