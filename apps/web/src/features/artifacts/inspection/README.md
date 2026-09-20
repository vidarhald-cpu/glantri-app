# Inspection pattern

Reusable, effectively full-viewport inspection of visual material.

- `FullViewportInspection` owns the shell: it covers the viewport, carries the
  identity of what is being inspected, and provides the obvious way out. As a
  `dialog` it applies `role="dialog"`/`aria-modal`, traps focus with Tab, exits
  on Escape by default, and returns focus to whatever opened it. As a `page` it
  is meant to be the whole inspection route rather than an overlay, but today it
  renders through the same fixed, full-viewport shell as `dialog` — there is no
  `page`-specific layout, and it skips the dialog role, the focus trap, and
  Escape handling of its own (the caller decides Escape behaviour via
  `closeOnEscape`, and typically owns its own route-level Escape handling
  instead, as the Blackboard's focused Artifact inspection does).
- `MediaInspectionViewport` owns the material: fit-to-screen scaling, zoom, drag
  and keyboard pan for images, and the reader's own controls for documents.

The shell and the viewport are laid out as grid rows. No control is positioned
over the inspected material, at any supported width.

The pattern is deliberately media-agnostic — `mediaLabel` names the game-world
noun used in control names — so later visual material such as Maps can reuse it
without a second viewer. It presents only what its caller already has; it reads
no Artifact data and grants no visibility of its own.
