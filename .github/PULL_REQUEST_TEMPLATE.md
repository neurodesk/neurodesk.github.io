<!-- Describe your change here. You can delete the guidance below once you have. -->

## What changed



---

## Checking your preview

Every push builds a preview site on **Cloudflare Pages**. There are two ways to reach it.

### 1. The predictable branch link

Your preview always lives at:

```
https://<your-branch-name>.neurodesk-github-io-astro.pages.dev
```

Lowercase the branch name and replace anything that is not a letter or number with a
hyphen. So a branch named `content-sync` is served at:

```
https://content-sync.neurodesk-github-io-astro.pages.dev
```

Long branch names are cut to 28 characters, so if that does not load, use the bot comment below.

### 2. The Cloudflare bot comment

Scroll down this page to a comment from **`cloudflare-workers-and-pages`**. It looks like this:

> **Deploying neurodesk-github-io-astro with Cloudflare Pages**
>
> | | |
> |---|---|
> | **Latest commit** | `7377fc4` |
> | **Status** | ✅ Deploy successful! |
> | **Preview URL** | `https://ec56373a.neurodesk-github-io-astro.pages.dev` |
> | **Branch Preview URL** | `https://content-sync.neurodesk-github-io-astro.pages.dev` |

- **Branch Preview URL** is the one you usually want. It follows your latest commit.
- **Preview URL** is pinned to one specific commit, for checking a single build.

Wait for ✅ **Deploy successful** before trusting what you see. A 404 or a stale page
usually means the build is still running, so wait a moment and refresh.

## When the preview looks right

React 👍 on the **Preview Deployment** comment. That tells reviewers your changes are
ready to look at.

## Help

Need help or access? Contact a code owner: @neurodesk/website-team
