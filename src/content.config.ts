import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				/**
				 * Whether to show the "Overview" entry at the top of the table of contents,
				 * which links to the page title.
				 *
				 * Left unset, `src/components/PageSidebar.astro` decides: the entry is kept
				 * on pages that open with introductory prose and dropped on pages that start
				 * at a heading, where it points at nothing. Set explicitly to force it on or
				 * off for a page.
				 */
				tocOverview: z.boolean().optional(),
			}),
		}),
	}),
};
