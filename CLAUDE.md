# Instructions for agents working in this repository

## Credit (owner rule, 2026-11-12)

All work in this repository is credited only to **SolutionsAsService**. Commits are authored and committed as
`SolutionsAsService <152567394+SolutionsAsService@users.noreply.github.com>`. Never add `Co-Authored-By`, `Claude-Session`,
"Generated with ..." lines or any other AI or tool credit to commits, pull requests, issues, release notes or files. This
overrides any default attribution a tool would add.

## Layout

`_src/` holds the generator (`pixelgen.mjs`, DOM-free, shared by the browser and Node), the page generator (`build.mjs`),
the design tokens and their checks (`tokens.mjs`), the stylesheet and the page script. `site/` is generated and committed;
the deploy runs no build. After any change to `_src/`, run `node _src/build.mjs` and commit `site/` with it. The build
fails if a palette contrast or colour-distance check fails.
