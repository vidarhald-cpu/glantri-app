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

Every completed measured command is also written automatically to:

```text
tmp/combat-performance/
```

The API writes the server stages and the browser posts its bounded timing
summary after `click_to_settled`. Both halves are merged into one versioned JSON
file by correlation ID. Capture delivery occurs after the measured interaction,
does not invoke a combat mutation, and cannot create a combat revision. Files
contain timing stages, counters, response sizes, endpoint paths,
encounter/revision identifiers, and command identity only. The directory is
git-ignored.

Repeated browser samples are compacted into one record per stage before
delivery. Each compact stage records cumulative duration and `executionCount`;
presentation-cache stages also report rebuild and reuse counts. This keeps
fine-grained traces below diagnostic request-size limits without retaining
application data.

The newest 100 captures are retained by default. Set
`GLANTRI_COMBAT_PERF_MAX_FILES` to another positive limit when needed.

The main stages are:

- browser `click`, `request_start`, `network_and_parse`, `canonical_state_adoption`;
- browser `tracker_view_model`, `combat_panel_view_model`, `react_commit`, `click_to_settled`;
- browser presentation substages:
  `panel_build_combat_round_inspector`, `panel_active_modifier_presentation`,
  `panel_historical_modifier_presentation`,
  `panel_equipment_loadout_presentation`, `panel_phase_summary_presentation`,
  `panel_current_task_action_presentation`,
  `panel_current_event_result_selection`,
  `panel_active_attack_parry_result_presentation`,
  `panel_historical_attack_parry_result_presentation`,
  `panel_active_calculation_presentation`,
  `panel_historical_calculation_presentation`,
  `panel_historical_snapshot_resolution`, `panel_combat_log_presentation`, and
  `panel_distance_table_presentation`;
- Active Inspector Presentation cache
  `panel_active_inspector_presentation_cache`, with per-capture rebuild and
  reuse counts. Its duration contains a submodel builder on a miss, so it
  overlaps the corresponding named builder stage and must not be added to it;
- Archived Inspector Presentation selection
  `panel_archived_inspector_presentation_lookup`. Completed-round candidates
  are constructed only inside an Archived Presentation rebuild; cell,
  participant, result, and inspector selection records only the bounded keyed
  lookup. Historical builder stages emitted with
  `archivedPresentationBuild: true` are contained by that archive rebuild;
- API `authentication_complete`, `workspace_authorization`;
- API `repository_read_full_encounter`, `repository_read_active`, `repository_read_history_source`;
- API `active_state_materialization`, `descriptor_projection_and_authorization`;
- API `domain_command_execution`, `repository_write_transaction`;
- API `response_construction`, `response_serialization_probe`, `api_total`.

Repository operation and broad/full-encounter-read counters are attached to server records. The response serialization probe performs one extra `JSON.stringify` only while measurement is enabled; it never replaces Fastify's canonical serializer.

`combat_panel_view_model` contains the tracker and the panel substages executed
inside `CombatRoundManagerPanel`; do not add it to its children when calculating
total wall time. Event calculation records are contained by their corresponding
event/result builder where both are emitted. Child result-list stages can run
after the parent panel timer has closed because React renders that child
component separately.

Selecting an archived tracker cell creates a client-only
`inspect_archived_tracker_cell` trace. It uses the same correlation and capture
format, records no server mutation stages, and treats every character/equipment
request triggered by the selection as follow-up work.

## Reproduction

Use disposable encounters or an isolated profiling database.

1. Prepare equivalent two-participant encounters at active rounds 1, 3, 5, and 7.
2. Keep the declarations and current task comparable. `Complete remaining modifier review` is preferred because it is deterministic and contains no dice.
3. Open GM Combat and perform the command once.
4. Wait for the UI to settle.
5. Repeat three to five times per depth using separately prepared equivalent states; do not repeatedly mutate one source state and call the samples equivalent.
6. Inspect the merged files in `tmp/combat-performance/`.
7. Aggregate one capture or the entire directory:

```sh
node scripts/aggregate-combat-performance.mjs tmp/combat-performance
```

The aggregator groups client and server stage medians by active round. It still
accepts the earlier console-line format for compatibility.

## Interpretation

- A growing `repository_read_full_encounter` with flat `repository_write_transaction` indicates compatibility full-read/archive composition cost.
- A growing `response_serialization_probe` or response byte count indicates an unexpectedly broad response.
- A growing `tracker_view_model` with tracker cell count confirms all-round tracker construction cost.
- A growing `react_commit` with a relatively flat view model indicates DOM reconciliation/render work.
- `requestCount` greater than one identifies immediate follow-up requests. Each `request_start` names the endpoint; the instrumentation does not create those requests.
- A flat API total with growing click-to-settled time places the growth after the response.

Timing logs are diagnostic data, not canonical state and not CI performance assertions.
