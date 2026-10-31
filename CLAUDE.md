# Glantri — Claude adapter

`AGENTS.md` is the canonical, provider-neutral execution policy. Read it completely, then read only the exact additional documents or sections your dispatch packet names. This file only maps that policy onto Claude Code substrate. It does not restate, extend, or override it, and the general development process must not be duplicated here.

## Substrate mapping

- The persistent visible Claude Code session is the Development Orchestrator.
- Attended substantial Builders normally use separate visible Claude Code sessions.
- Explicitly authorized unattended Builder subagents are permitted for bounded tasks whose substrate is durably recorded.
- A fresh QA subagent that shares no Builder conversational history is normal independent QA. A helper agent inside the Builder's own implementation context is not.
- The mandatory QA floor's independence requirement in `AGENTS.md` maps onto the same Claude Code substrate: a fresh QA subagent, or a separate Claude Code session, sharing no Builder conversational history satisfies it on any floor class.

## Provenance

- Record the actual execution substrate and the real background agent ID in durable execution evidence. Never describe a background subagent as a separate visible session.

## Model, effort, and resume

- The Orchestrator chooses model, effort, and fresh-versus-resume for each dispatched task.
- Favour fresh narrow agents for small mechanical follow-ups rather than resuming an existing agent.
- Select the least expensive model and effort reasonably capable of the complete task and its verification standard, subject to the reviewer-capability rule in `AGENTS.md` ("Where economy is taken") and to the mandatory QA floor.
- Workers may recommend escalation. They do not spawn their own workers or expand their own model budget.

## Scope boundary of this file

This file may record only Claude-specific substrate mapping, provenance, and model/effort/resume handling. Everything else — authority, issue lifecycle, the `dev`/`main` production boundary, hotspot coordination, Git and PR authority, acceptance gates, database safety, verification, and stop conditions — lives in `AGENTS.md` and the process references it names, and must not be copied here.
