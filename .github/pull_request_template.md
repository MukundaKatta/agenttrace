<!--
Thanks for sending a PR to agenttrace.

Quick reminders before you submit:
  - Zero runtime dependencies. A PR that adds one will be sent back to discussion first.
  - The library is sync-by-default; cost compute must stay synchronous so callers can summary(run) inline.
  - PRICING entries change provider behavior; please cite the provider's pricing page.
  - Tests live in test/ and run via `npm test`.
-->

## What this changes

A one-line summary, then a short paragraph if needed.

## Why

The user-visible bug or workflow gap this addresses.

## Type of change

- [ ] Bug fix in `measure()` / `Run` / `summary()` / cost compute
- [ ] New entry in `PRICING`
- [ ] New aggregation
- [ ] Numerical / overflow edge case
- [ ] AsyncLocalStorage attribution fix
- [ ] Test coverage
- [ ] Documentation
- [ ] CI / build / release plumbing

## Security review

- [ ] If this touches cost compute, no `(model, usage)` regression where the reported cost is lower than the provider's price.
- [ ] If this touches `PRICING` or `setPricing()`, the table can still be safely shared across consumers in the same process (no caller can pollute another's view).
- [ ] If this changes the AsyncLocalStorage attribution, a span emitted from a detached async context still attributes to the right Run (or to no Run, never to the wrong one).

## Scope check

- [ ] No new runtime dependencies added (enforced by CI).
- [ ] Cost compute remains synchronous.
- [ ] If this changes the threat-model surface, `SECURITY.md` was updated in the same PR.

## Validation

- [ ] `npm test` passes locally
- [ ] `npm run test:coverage` still meets the configured thresholds (70% branches / 80% lines+functions+statements)
- [ ] Public API changes are reflected in `src/index.d.ts`

## Linked issue

Closes #
