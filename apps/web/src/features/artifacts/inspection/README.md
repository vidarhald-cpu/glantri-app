# Inspection pattern

Reusable, effectively full-viewport inspection of visual material.

- `FullViewportInspection` owns the shell: it covers the viewport, carries the
  identity of what is being inspected, and provides the obvious way out. As a
  `dialog` it traps focus, exits on Escape, and returns focus to whatever opened
  it. As a `page` it is the whole inspection route.
- `MediaInspectionViewport` owns the material: fit-to-screen scaling, zoom, drag
  and keyboard pan for images, and the reader's own controls for documents.

The shell and the viewport are laid out as grid rows. No control is positioned
over the inspected material, at any supported width.

The pattern is deliberately media-agnostic — `mediaLabel` names the game-world
noun used in control names — so later visual material such as Maps can reuse it
without a second viewer. It presents only what its caller already has; it reads
no Artifact data and grants no visibility of its own.
