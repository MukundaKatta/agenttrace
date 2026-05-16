# Security Policy

## Supported Versions

agenttrace is at v0.1.x. Security fixes will be issued for the current minor (0.1.x). Older minors will not receive backports.

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

Use [GitHub's private vulnerability reporting](https://github.com/MukundaKatta/agenttrace/security/advisories/new) or email `mukunda.vjcs6@gmail.com` with subject `[agenttrace security]`. Include:

- A description of the vulnerability and its impact.
- The version of agenttrace affected.
- Reproduction steps or a minimal proof-of-concept.
- Any suggested mitigation, if you have one.

You can expect:

- An acknowledgment within 5 business days.
- A status update within 14 days.
- A coordinated disclosure window of at most 90 days from the acknowledgment.

## Specific Risk Surfaces

agenttrace is a small, zero-runtime-dependency observability library: wrap an LLM call, get a per-step + per-run cost / latency breakdown. It runs entirely in the caller's process and has no I/O. Areas worth special attention:

- **Cost under-reporting.** The whole point of the library is "you spent $X on this run." If you find a `(model, usage)` combination where the reported cost is lower than the provider's actual price, that's a high-severity report (it lets a caller silently overshoot a budget they thought they were enforcing). Caveat: `PRICING` is a starter table and is documented as drift-prone vs. the provider's current sheet; a few-percent mismatch from "pricing changed last week" is not a security issue.
- **`PRICING` mutation / freeze bypass.** `PRICING` is a module-level object exported for user override via `setPricing()`. If you find a path where caller-controlled data can corrupt `PRICING` across other consumers in the same process (prototype pollution, structured-clone tricks, etc.), please report.
- **Numeric underflow / overflow.** Cost is computed in USD millicents (1/1000 of a cent) then surfaced as floats. If you find a token count or rate where the running sum silently saturates at `Number.MAX_SAFE_INTEGER` or rounds to zero, please report.
- **`AsyncLocalStorage` context leak.** The Run aggregator uses ALS to attribute spans to runs. If a span emitted from a detached async context (`setImmediate`, worker_threads, unhandled-rejection handlers) can attach to the wrong Run and corrupt another tenant's totals, that's worth reporting.
- **Run summary as a sink for sensitive content.** Spans may carry caller-provided `meta` fields. If your dashboard treats `Run.toJSON()` as safe-to-display HTML, that's an XSS issue in your dashboard, but agenttrace shouldn't make it worse by encoding meta with anything other than plain `JSON.stringify`.

## Out of scope

- **Exact agreement with provider pricing pages.** `PRICING` is a starter table. For up-to-the-minute accuracy, override via `setPricing()` in your application.
- **Network exfiltration via the LLM call.** agenttrace doesn't perform the call; you do. For tool-egress controls, see [agentguard](https://github.com/MukundaKatta/agentguard).
- **Provider API key handling.** agenttrace never sees a key.
- **Distributed tracing semantics.** agenttrace is single-process; OTel adapters are out of scope for this repo.

## Dependencies

agenttrace has **zero** runtime dependencies, by design. The only dev dependency is `c8` for coverage. Any future addition is reviewed for security impact and dependency confusion risk.

We will not pay bug bounties at this time.
