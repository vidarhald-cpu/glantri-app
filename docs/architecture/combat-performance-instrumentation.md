# Combat Performance Instrumentation

Status: Development-only measurement aid  
Audience: Developers profiling GM Combat  
Purpose: Correlate one combat click across browser, API, persistence, projection, and render stages without changing canonical combat behavior.

## Enable

Start both processes with instrumentation enabled:

```sh
GLANTRI_COMBAT_PERF=1 pnpm --filter @glantri/api dev
NEXT_PUBLIC_GLANTRI_COMBAT_PERF=1 pnpm --filter @glantri/web dev
```

The instrumentation is disabled in production even if either variable is present. With the variables absent, the helpers return before measuring or logging.

## Output

Both browser and API emit metadata-only records prefixed with:

```text
PERF combat-command
```

One browser click creates one correlation ID. The combat mutation sends that ID and the canonical command type to the API. Records include only timing, endpoint/stage names, revision identity, round and bounded counts. Request bodies, response bodies, participant facts, rolls, modifiers, and player-private data are never logged.

The main stages are:

- browser `click`, `request_start`, `network_and_parse`, `canonical_state_adoption`;
- browser `tracker_view_model`, `combat_panel_view_model`, `react_commit`, `click_to_settled`;
- API `authentication_complete`, `workspace_authorization`;
- API `repository_read_full_encounter`, `repository_read_active`, `repository_read_history_source`;
- API `active_state_materialization`, `descriptor_projection_and_authorization`;
- API `domain_command_execution`, `repository_write_transaction`;
- API `response_construction`, `response_serialization_probe`, `api_total`.

Repository operation and broad/full-encounter-read counters are attached to server records. The response serialization probe performs one extra `JSON.stringify` only while measurement is enabled; it never replaces Fastify's canonical serializer.

## Reproduction

Use disposable encounters or an isolated profiling database.

1. Prepare equivalent two-participant encounters at active rounds 1, 3, 5, and 7.
2. Keep the declarations and current task comparable. `Complete remaining modifier review` is preferred because it is deterministic and contains no dice.
3. Open GM Combat with browser DevTools Console and Network visible.
4. Clear the console, perform the command once, and wait for `click_to_settled`.
5. Repeat three to five times per depth using separately prepared equivalent states; do not repeatedly mutate one source state and call the samples equivalent.
6. Save API and browser console output as text.
7. Aggregate either file:

```sh
node scripts/aggregate-combat-performance.mjs path/to/perf.log
```

The aggregator groups stage medians by active round. Browser console object records should be saved in JSON-expanded text form; raw API lines already contain JSON.

## Interpretation

- A growing `repository_read_full_encounter` with flat `repository_write_transaction` indicates compatibility full-read/archive composition cost.
- A growing `response_serialization_probe` or response byte count indicates an unexpectedly broad response.
- A growing `tracker_view_model` with tracker cell count confirms all-round tracker construction cost.
- A growing `react_commit` with a relatively flat view model indicates DOM reconciliation/render work.
- `requestCount` greater than one identifies immediate follow-up requests. Each `request_start` names the endpoint; the instrumentation does not create those requests.
- A flat API total with growing click-to-settled time places the growth after the response.

Timing logs are diagnostic data, not canonical state and not CI performance assertions.
