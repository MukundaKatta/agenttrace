# Contributing to agenttrace

Small, focused PRs welcome. Bigger design changes — open an issue first
so we can sanity-check direction before you build.

## Setup

```sh
gh repo clone MukundaKatta/agenttrace
cd agenttrace
npm install
```

## Run

```sh
npm test                 # 26 tests via Node's built-in runner
node examples/demo.js    # smoke-test the public API end to end
```

## Style

- Plain ESM, zero runtime dependencies. Pricing tables are inline so
  callers can audit them; if you want to add a model, just append to
  the `PRICING` object in `src/index.js` and add a test.
- One PR = one focused change. New SDK shape support? One PR for
  the `defaultExtractUsage` change + tests, no unrelated edits.

## Releases

Semver. `0.1.x` is patch releases (bug fixes / new pricing entries
that match official upstream pricing / no API change).
