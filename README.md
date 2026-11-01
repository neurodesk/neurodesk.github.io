# Neurodesk website

Source for [neurodesk.org](https://neurodesk.org), built with [Astro](https://astro.build) and
[Starlight](https://starlight.astro.build).

The deployed site combines:

| Path | Source |
| --- | --- |
| [neurodesk.org](https://neurodesk.org/) | [`neurodesk/neurodesk.github.io`](https://github.com/neurodesk/neurodesk.github.io) |
| [`/edu/`](https://neurodesk.org/edu/) | [`neurodesk/neurodeskedu`](https://github.com/neurodesk/neurodeskedu) |
| [`/neurocontainers-ui/`](https://neurodesk.org/neurocontainers-ui/) | [`neurodesk/neurocontainers-ui`](https://github.com/neurodesk/neurocontainers-ui) |

## Local development

You need [Node.js 22.12 or newer](https://nodejs.org/) and [pnpm 11](https://pnpm.io/installation).

```bash
git clone https://github.com/neurodesk/neurodesk.github.io.git
cd neurodesk.github.io
pnpm install
pnpm dev
```

Open `http://localhost:4321`. Before opening a pull request, check the build:

```bash
pnpm build
pnpm preview
```

`pnpm build` only builds this repository. [GitHub Actions](https://github.com/neurodesk/neurodesk.github.io/actions)
assembles the other sections for deployment.

## Repository structure

| Path | Purpose |
| --- | --- |
| [`src/content/docs/`](src/content/docs/) | Website pages |
| [`src/components/`](src/components/) | Astro and React components |
| [`src/styles/`](src/styles/) | Custom styles |
| [`public/`](public/) | Static files and generated data |
| [`astro.config.mjs`](astro.config.mjs) | Navigation, redirects, and site settings |
| [`.github/workflows/`](.github/workflows/) | Tests, previews, and deployment |

## Contributing

Create a branch, make your changes, run `pnpm build`, and open a
[pull request](https://github.com/neurodesk/neurodesk.github.io/pulls). Fork previews require
maintainer approval.

- [Contributing website content](src/content/docs/developers/documentation/creating-website-content.mdx)
- [Local development](src/content/docs/developers/documentation/local-development.mdx)
- [Markdown and MDX formatting](src/content/docs/developers/documentation/markdown-formatting.mdx)

## Preview and deployment

- **Pull requests:** Use the Cloudflare preview link in the PR description for unmerged changes.
  It does not include `/edu/`.
- **Before promotion:** Check [neurodesk.github.io](https://neurodesk.github.io/) after merging.
  [Website Staging](.github/workflows/website-staging.yml) deploys `main` there; its
  [`/edu/`](https://neurodesk.github.io/edu/) comes from [`neurodesk/edu`](https://github.com/neurodesk/edu).
- **Production:** Run [Promote to Production](https://github.com/neurodesk/neurodesk.github.io/actions/workflows/promote-to-prod.yml)
  manually to publish the assembled site to [neurodesk.org](https://neurodesk.org). Every run
  publishes. Promotion rebuilds the site and adds Neurocontainers UI, so the staging site is a
  functional check rather than an exact production artifact.

For help, use [Neurodesk Discussions](https://github.com/orgs/neurodesk/discussions).
