export async function GET() {
  const content = `# 1tt.dev Badge Service — llms.txt

> This file describes how to generate shield-style badges served by 1tt.dev.
> Use this reference to construct badge URLs for README files, documentation, and CI/CD dashboards.

## Base URL

\`\`\`
https://1tt.dev/badge/{spec}.svg
\`\`\`

## URL Format

The badge spec encodes label, message, and color separated by dashes:

\`\`\`
https://1tt.dev/badge/{label}-{message}-{color}.svg
https://1tt.dev/badge/{message}-{color}.svg          (no label)
\`\`\`

### Path Encoding Rules

| Character | Encoding |
|-----------|----------|
| Space     | \`_\` or \`%20\` |
| Literal underscore | \`__\` |
| Literal dash | \`--\` |
| Percent   | \`%25\` |

### Examples

| Badge | URL |
|-------|-----|
| build passing (green) | \`/badge/build-passing-brightgreen.svg\` |
| coverage 95% (orange) | \`/badge/coverage-95%25-orange.svg\` |
| version 2.1.0 (blue) | \`/badge/version-2.1.0-blue.svg\` |
| license MIT (green) | \`/badge/license-MIT-green.svg\` |
| just a message (blue) | \`/badge/hello_world-blue.svg\` |
| with logo | \`/badge/docker-ready-blue.svg?logo=docker\` |
| for-the-badge style | \`/badge/POWERED_BY-1tt.dev-blue.svg?style=for-the-badge\` |

## Query Parameters

| Parameter | Values | Default | Description |
|-----------|--------|---------|-------------|
| \`style\` | \`flat\`, \`flat-square\`, \`plastic\`, \`for-the-badge\`, \`social\` | \`flat\` | Badge appearance |
| \`labelColor\` | Named color or hex (no #) | \`555\` (grey) | Left section background |
| \`logo\` | Simple Icons slug (e.g. \`github\`, \`docker\`, \`npm\`) | — | Icon from simple-icons.org |
| \`logoColor\` | Named color or hex (no #) | \`white\` | Logo icon color |

## Named Colors

| Name | Hex | Use for |
|------|-----|---------|
| \`brightgreen\` | #4c1 | passing, success, stable |
| \`green\` | #97ca00 | good, active |
| \`yellow\` | #dfb317 | warning, partial |
| \`yellowgreen\` | #a4a61d | moderate |
| \`orange\` | #fe7d37 | important, needs attention |
| \`red\` | #e05d44 | failing, critical, error |
| \`blue\` | #007ec6 | informational, version |
| \`grey\` / \`gray\` | #555 | inactive, unknown |
| \`lightgrey\` / \`lightgray\` | #9f9f9f | not applicable |

### Semantic Aliases

| Name | Maps to | Meaning |
|------|---------|---------|
| \`success\` | brightgreen | Tests passing, build OK |
| \`important\` | orange | Needs attention |
| \`critical\` | red | Broken, failing |
| \`informational\` | blue | Version, info |
| \`inactive\` | lightgrey | Archived, dormant |

You can also use any 3 or 6 character hex color without the # prefix:
\`/badge/custom-color-ff69b4.svg\`

## Styles

### flat (default)
Modern flat look with subtle gradient overlay and rounded corners.
\`\`\`
/badge/build-passing-brightgreen.svg
/badge/build-passing-brightgreen.svg?style=flat
\`\`\`

### flat-square
Flat with sharp corners (no border radius).
\`\`\`
/badge/build-passing-brightgreen.svg?style=flat-square
\`\`\`

### plastic
Classic shields.io look with stronger gradient.
\`\`\`
/badge/build-passing-brightgreen.svg?style=plastic
\`\`\`

### for-the-badge
Large, bold, uppercase text. Good for hero sections.
\`\`\`
/badge/POWERED_BY-1tt.dev-blue.svg?style=for-the-badge
\`\`\`

### social
GitHub-style social badge.
\`\`\`
/badge/follow-@1ttdev-blue.svg?style=social
\`\`\`

## Logos

Add icons from Simple Icons (https://simpleicons.org) using the \`logo\` parameter.
The slug is the lowercase, hyphenated icon name from simpleicons.org.

\`\`\`
/badge/docker-ready-blue.svg?logo=docker
/badge/node.js-18-brightgreen.svg?logo=nodedotjs&logoColor=white
/badge/python-3.12-blue.svg?logo=python&logoColor=yellow
/badge/rust-stable-orange.svg?logo=rust&logoColor=white
/badge/license-MIT-green.svg?logo=opensourceinitiative
\`\`\`

Common logo slugs: \`github\`, \`docker\`, \`npm\`, \`python\`, \`rust\`, \`go\`, \`typescript\`, \`javascript\`, \`react\`, \`nextdotjs\`, \`nodedotjs\`, \`linux\`, \`apple\`, \`windows\`, \`amazonaws\`, \`googlecloud\`, \`cloudflare\`, \`postgresql\`, \`redis\`, \`mongodb\`, \`git\`, \`visualstudiocode\`

## Common Badge Patterns for READMEs

### Build / CI Status
\`\`\`markdown
![build](https://1tt.dev/badge/build-passing-brightgreen.svg)
![build](https://1tt.dev/badge/build-failing-red.svg)
![tests](https://1tt.dev/badge/tests-142_passed-brightgreen.svg)
![ci](https://1tt.dev/badge/CI-passing-brightgreen.svg?logo=githubactions&logoColor=white)
\`\`\`

### Version / Release
\`\`\`markdown
![version](https://1tt.dev/badge/version-2.1.0-blue.svg)
![npm](https://1tt.dev/badge/npm-v1.5.3-red.svg?logo=npm)
![crate](https://1tt.dev/badge/crates.io-0.8.2-orange.svg?logo=rust)
![pypi](https://1tt.dev/badge/pypi-3.2.1-blue.svg?logo=pypi)
\`\`\`

### License
\`\`\`markdown
![license](https://1tt.dev/badge/license-MIT-green.svg)
![license](https://1tt.dev/badge/license-Apache_2.0-blue.svg)
![license](https://1tt.dev/badge/license-GPL--3.0-red.svg)
\`\`\`

### Coverage / Quality
\`\`\`markdown
![coverage](https://1tt.dev/badge/coverage-95%25-brightgreen.svg)
![coverage](https://1tt.dev/badge/coverage-78%25-yellow.svg)
![coverage](https://1tt.dev/badge/coverage-42%25-red.svg)
\`\`\`

### Platform / Technology
\`\`\`markdown
![docker](https://1tt.dev/badge/docker-ready-blue.svg?logo=docker&logoColor=white)
![node](https://1tt.dev/badge/node-%3E%3D18-brightgreen.svg?logo=nodedotjs)
![python](https://1tt.dev/badge/python-3.10%2B-blue.svg?logo=python&logoColor=yellow)
![rust](https://1tt.dev/badge/rust-1.75%2B-orange.svg?logo=rust)
\`\`\`

### Status / Maintenance
\`\`\`markdown
![status](https://1tt.dev/badge/status-active-brightgreen.svg)
![status](https://1tt.dev/badge/status-beta-yellow.svg)
![status](https://1tt.dev/badge/status-deprecated-red.svg)
![maintained](https://1tt.dev/badge/maintained-yes-brightgreen.svg)
![maintained](https://1tt.dev/badge/maintained-no-red.svg)
\`\`\`

### Downloads / Stars
\`\`\`markdown
![downloads](https://1tt.dev/badge/downloads-1.2M-brightgreen.svg)
![stars](https://1tt.dev/badge/stars-4.8k-yellow.svg?logo=github)
\`\`\`

### Custom / Branding
\`\`\`markdown
![powered by](https://1tt.dev/badge/powered_by-1tt.dev-blue.svg?style=for-the-badge)
![made with](https://1tt.dev/badge/made_with-love-red.svg?style=flat-square)
![sponsor](https://1tt.dev/badge/sponsor-♥-red.svg?style=social)
\`\`\`

## Full URL Template

\`\`\`
https://1tt.dev/badge/{label}-{message}-{color}.svg?style={style}&labelColor={hex}&logo={slug}&logoColor={hex}
\`\`\`

All parameters are optional. Minimum viable badge:
\`\`\`
https://1tt.dev/badge/hello-blue.svg
\`\`\`
`;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
