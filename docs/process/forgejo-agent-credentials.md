# Persistent Forgejo agent credentials

## Purpose and authority

This document owns the local credential and repository-permission mechanics for
the single Development Orchestrator, Builder, independent QA and assigned
Investigator/Ops evidence roles. The
[development operating model](./development-operating-model.md) continues to
own role authority, lifecycle, dispatch, integration, and release boundaries.
Credentials never authorize a task, acceptance, integration, release, `main`,
Azure, or production action.

The design applies to the private loopback-only Forgejo repository
`recovery-admin/glantri-app`. It does not expose Forgejo beyond the host and does
not add an SSH listener.

## Selected model

Forgejo 15.0.7 has local user accounts rather than a separate service-account
object. Glantri therefore uses three restricted, non-admin local users whose
random interactive passwords are not used by routine automation:

| Identity               | Repository role | Repository-specific token scopes  | Operational boundary                                                                                                                                                                                                                                                                       |
| ---------------------- | --------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `glantri-orchestrator` | Write           | `write:repository`, `write:issue` | Read/fetch; issue, comment, label, and PR operations; accepted `dev` integration through the protected-branch merge allowlist. No direct `dev`/`main` push, no `main` merge, no repository or instance administration.                                                                     |
| `glantri-builder`      | Write           | `write:repository`                | Read/fetch and authorized short-lived task-branch push. No issue lifecycle scope, direct `dev`/`main` push, or protected-branch merge.                                                                                                                                                     |
| `glantri-qa`           | Read            | `read:repository`, `write:issue`  | QA Worker read/fetch with no code push. Authorized independent QA or an explicitly assigned evidence publisher may post durable issue/PR evidence through this credential; the Development Orchestrator remains responsible for lifecycle labels that require higher repository authority. |

All three users are restricted, have limited profile visibility, cannot create
repositories or organizations, cannot import local repositories or manage Git
hooks, and are not instance administrators. Tokens are limited to
`recovery-admin/glantri-app`; public repositories remain subject to Forgejo's
standard read-only behavior for repository-specific tokens.

This three-identity model keeps the QA Worker code-read-only while using the
token's independent issue scope for evidence comments. There is no permanent QA
coordination role and no new account implied by the
Recorder function. Lifecycle mutations remain with the Development Orchestrator.
Role-prose reconciliation changes no account, token scope, repository permission,
Keychain handle or protected-branch setting.

## Branch enforcement

The recorded local Forgejo protected-branch configuration is below. Verify live
state for integration. The [approved path-aware destination](./development-baseline.md#approved-path-aware-dev-gate--pending-implementation-and-transition)
is pending separate implementation/transition; this documentation does not
change protection or declare that destination deployed:

| Branch | Direct push           | Merge                                      | Additional enforcement                                                                                                                                                                                                  |
| ------ | --------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev`  | Disabled for everyone | Allowlisted only to `glantri-orchestrator` | Applies to administrators; zero approvals; `CI / ci (pull_request)` and `CI / docker-test (pull_request)` required; rejected or outstanding official reviews and outdated heads block merge. Force push is unavailable. |
| `main` | Disabled for everyone | Disabled by an empty merge allowlist       | Applies to administrators; rejected or outstanding official reviews and outdated heads block merge. Force push is unavailable.                                                                                          |

The `main` rule deliberately has no routine integration identity. A future
release remains a separately authorized `dev -> main -> Azure` operation at the
external-maintainer boundary. Changing the rule for that release requires its
own explicit authority; possession of an administrator credential is not a
bypass.

`glantri-builder` is necessarily a Write collaborator because Forgejo's
repository role is what permits task-branch push. Forgejo's Write role also
normally permits PR merge, so the protected `dev`/`main` merge allowlists are
the server-side enforcement that removes Builder integration authority.

## Transport and secure storage

Use HTTP Git against `http://127.0.0.1:3001`. Forgejo SSH is disabled, its
built-in SSH server is not started, and Docker publishes only
`127.0.0.1:3001 -> 3000/tcp`. Adding SSH would add listener and key-management
surface without improving the current single-host workflow.

The persistent access-token values live only in the macOS login Keychain via
Git's `osxkeychain` credential helper. Every item is scoped to the exact
repository path `recovery-admin/glantri-app.git`; there are no host-only items.
The non-secret handles are:

- `git-http://glantri-orchestrator@127.0.0.1:3001/recovery-admin/glantri-app.git`
  / token name
  `persistent-orchestrator-v1`;
- `git-http://glantri-builder@127.0.0.1:3001/recovery-admin/glantri-app.git` /
  token name
  `persistent-builder-v1`; and
- `git-http://glantri-qa@127.0.0.1:3001/recovery-admin/glantri-app.git` / token
  name
  `persistent-qa-v1`.

The separate break-glass Git handle is
`git-http://recovery-admin@127.0.0.1:3001/recovery-admin/glantri-app.git`.
It is never a default and is used only when recovery administration is
separately authorized.

Do not put a token value or account password in repository files, `.env` files,
prompts, shell arguments, command output, logs, Forgejo comments, task returns,
or Git history. Do not copy the administrator credential into a task
worktree. The existing recovery administrator Keychain item is a provisioning
and break-glass control only, not a routine agent identity.

## Visible-task consumption

The canonical clone's repository-local Git configuration enforces both:

- `credential.useHttpPath=true`; and
- `credential.username=glantri-no-default`.

`glantri-no-default` is deliberately not a Forgejo user and has no Keychain
item. With terminal prompts disabled, an unqualified credential lookup therefore
fails locally instead of selecting any role or the recovery administrator.
Command-level `credential.username` is required to override the sentinel with
one explicit path-scoped handle. Do not unset or bypass either repository-local
setting, and do not create host-only Forgejo Keychain items.

The Development Orchestrator assigns the role before dispatch and includes only
the identity and Keychain handle in the visible task contract. Git network
commands must:

1. set `GIT_TERMINAL_PROMPT=0` so missing credentials fail closed;
2. set the intended username explicitly for the command, for example
   `git -c credential.username=glantri-builder fetch origin dev`;
3. use the installed `osxkeychain` helper without changing global Git config;
4. verify the exact accepted remote SHA before mutation; and
5. stay within the task's separately granted Git authority.

Setting a username selects an identity; it does not grant permission. Forgejo
token scopes, collaborator roles, branch rules, and the task contract all have
to permit the operation. Recovery Git operations use the same pattern with
`credential.username=recovery-admin`, but only under separate break-glass
authority; no routine task may select it.

For authorized issue or PR API calls, the assigned publisher uses a local
credential bridge
that reads the selected Keychain entry into process memory, supplies
authentication to the loopback request through standard input rather than a
secret-bearing argument, and unsets the value immediately. The bridge must not
echo, trace, persist, or include the credential in an error report. API output
must be reduced to the non-secret fields required as evidence.

A Builder's full bounded PR/evidence publication authority does not imply that
`glantri-builder` has issue API scope. Try only the assigned authorized identity;
if it cannot publish, return the exact ready content, target and non-secret
failure. The Development Orchestrator/Recorder publishes automatically using an
already authorized publication role and verifies the durable link. The same
rule covers authorized read-only investigation and QA verdicts. Do not broaden
scopes, select recovery administration or modify credentials to avoid this
fallback; a valid report remains valid even if its worker could not post it.

Visible tasks share one macOS login session and therefore do not provide a
cryptographic Keychain boundary between tasks running as the same macOS user.
The durable enforcement boundary is Forgejo: repository-specific token scopes,
collaborator roles, and protected branches. Role selection in a task remains an
Orchestrator responsibility. If Glantri later needs adversarial isolation
between local workers, run roles under separate macOS accounts or isolated
hosts with separate Keychains rather than treating worktree isolation as
credential isolation.

## Provisioning, rotation, and revocation

The Development Orchestrator owns normal role selection and task consumption.
An authorized infrastructure administrator owns account creation, collaborator
roles, protected-branch configuration, token creation, secure-store insertion,
rotation, and revocation. The Product Owner is never asked to paste or relay a
credential value.

Create tokens as repository-specific credentials with the exact scopes in the
table above. Pipe each generated value directly into a repository-path-scoped
Keychain entry without rendering it. Never create a host-only entry. Record
only the account name, token name, scopes, selected repository,
creation/rotation date, and verification outcome.

On suspected or confirmed exposure:

1. revoke the affected token immediately without waiting for Product Owner
   confirmation;
2. remove or replace its Keychain entry;
3. create a new repository-specific token with the same or narrower scopes;
4. store it without rendering the value;
5. repeat the role's negative and positive verification; and
6. record only the incident, revoked token name, replacement handle, and
   non-secret results.

Password rotation or administrator access is not required for ordinary token
rotation. If a role no longer exists, revoke all of its tokens, remove its
collaborator access, and disable the local user before considering deletion.

## Verification and temporary fallback

Provisioning is incomplete until separate visible tasks prove:

- Credential selection: an unqualified lookup with terminal prompts disabled
  fails; every role resolves only when its username is explicit; and the
  recovery administrator remains available only when explicitly selected.
- Builder: unattended fetch/read and one disposable task-branch push succeed;
  direct `dev` and `main` pushes are denied; the `dev` merge allowlist excludes
  Builder; the disposable branch is deleted.
- QA Worker: unattended `dev` and immutable task/PR-head fetch succeed; every
  code push is denied; the worktree remains clean.
- Development Orchestrator: issue and PR reads and one harmless issue comment
  succeed through the persistent credential; the `dev` merge allowlist names
  only `glantri-orchestrator`; `main` has no merge path.
- Authorized QA/evidence publisher: a durable evidence comment succeeds through `glantri-qa`
  while the same credential remains unable to push code.

Temporary task tokens are an exceptional fallback when a persistent handle is
unavailable or broken. The Development Orchestrator may create one only for an
already authorized task, restrict it to this repository and the minimum scopes,
store or pass it without rendering, record its non-secret name, and revoke it
at task completion or immediately after exposure. A fallback credential does
not relax branch protection or task authority.

## Mac mini recreation

Do not export token values from this MacBook. On a future Mac mini:

1. install the same supported Git credential helper, keep Forgejo bound to
   loopback/private scope, and configure the canonical clone with
   `credential.useHttpPath=true` and
   `credential.username=glantri-no-default`;
2. restore or migrate the Forgejo data/configuration through the approved
   stopped-instance process, then verify the three restricted users,
   collaborator roles, token metadata, and `dev`/`main` rules;
3. revoke the MacBook role tokens and create new repository-specific tokens for
   the Mac mini;
4. pipe the new values directly into repository-path-scoped entries in that
   host's login Keychain under the same non-secret handles, create the recovery
   handle only under separate break-glass authority, and create no host-only
   entries;
5. ensure the automation account's Keychain is available to unattended local
   tasks without storing its unlock secret in the repository or task prompts;
   and
6. repeat all positive and negative visible-task verification before routine
   work moves to the new host.

A fully headless installation should use a dedicated macOS automation account
and its own Keychain. If an unattended secure store cannot be made available,
use a short-lived scoped token as the documented fallback rather than creating
a plaintext credential file.

## Recorded verification snapshot

Verified for Forgejo issue #41 on 2026-09-06 against
`dev@171756bb64ccf83d2e35ffa8400d8206ab24b1d5`:

- Forgejo `15.0.7`; SQLite-backed data under the existing persistent Forgejo
  root; Docker publishes only `127.0.0.1:3001 -> 3000/tcp`;
- open registration disabled; SSH disabled; built-in SSH server not started;
- three role users and repository-specific tokens match this document;
- repository-local Git selection uses the non-existent
  `glantri-no-default` sentinel and repository-path matching;
- all four explicit Keychain handles are repository-path-scoped and their
  superseded host-only records are absent;
- `dev` and `main` protections match this document; and
- token values were piped directly into Keychain and were not recorded in
  repository, task output, Forgejo evidence, or Git history.

At that #41 verification, the instance had no Actions runner and required `dev`
contexts remained waiting. That is dated provenance, not a claim about current
runner availability. Verify live checks/runner evidence when needed; #41 never
authorized weakening protection, and #161's policy destination is not proof of
an implemented gate or completed transition.

Live Forgejo issue, PR, user, token-metadata, and branch-protection state remains
operational truth. This document is the standing process contract, not a
substitute for fresh verification.
