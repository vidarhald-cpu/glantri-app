# AI-assisted intake

Ordinary intake of material produced in an AI conversation: loose image or
document files plus a small documented semantic context, pasted or supplied as
a context file. It is the ordinary path; the advanced
`Import Artifact package` route remains separate and optional.

- `intakeProposal.ts` parses and plans. `planIntake` pairs each described entry
  with exactly one chosen file and reports every mismatch — a named file that
  was not chosen, a chosen file nothing describes, a file type Glantri cannot
  accept. `buildIntakeProposal` turns the accepted plan into the staged
  package. It derives no technical facts itself: resource identity, media type
  and SHA-256 all come from `../artifactPackageDerivation`, the single shared
  derivation the plain upload path uses too.
- `AiIntakePanel.tsx` is the GM surface: the format to ask an assistant for,
  the paste area, the optional context file, the chosen files, the problems,
  and the staged proposal with its abandon action.

**Nothing here creates canonical state.** Staging writes only a private import
session and its private bytes. The GM reviews the proposal in
`ArtifactImportReview`, corrects or binds what needs it, and confirming is what
creates the canonical Item, the canonical Artifact, and any representation
link between them. Abandoning discards the session and its stored bytes and
leaves nothing behind.

Correction of the semantic fields happens by editing the context and staging
again, which discards the previous staging first. Relationship binding happens
in the review, because only the server knows the candidates.

Two things are deliberately not done here. The panel never parses prose into
structure — free text is retained as GM notes. And a suggested visibility is
shown but never applied: new material is always created GM-private and shared
afterwards through the Artifact surface.
