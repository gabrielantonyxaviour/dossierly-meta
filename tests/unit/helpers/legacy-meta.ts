/*
 * Side-effect import for tests that pin Meta provider behaviour (request shapes, prices, relay, metering).
 * Real-user calls now default to Claude and are blocked from Meta (src/lib/model/gate.ts), so these suites opt back
 * in to the pre-gate setup: every role routed to Meta and META_USER_CONTENT=allow. The gate and routing
 * themselves are tested in model-gate.test.ts and model-routing.test.ts, which do not import this.
 */
process.env.META_USER_CONTENT = "allow";
for (const role of ["INTERPRET", "GUARD", "REASON", "AGENT", "VISION", "DRAFT", "SEARCH"]) process.env[`MODEL_${role}_USER_PROVIDER`] = "meta";
