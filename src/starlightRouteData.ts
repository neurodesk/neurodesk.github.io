import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

// The landing page uses `template: splash`, which Starlight treats as
// `hasSidebar: false`. That also removes the mobile hamburger, leaving the page
// with no navigation on small screens. Re-enable the sidebar for this route so
// the hamburger renders; custom.css keeps the sidebar itself hidden on desktop
// so the splash layout is unchanged.
export const onRequest = defineRouteMiddleware((context) => {
	if (context.url.pathname === '/') {
		context.locals.starlightRoute.hasSidebar = true;
	}
});
