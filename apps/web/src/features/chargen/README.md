# Chargen Feature

Entrypoint: `ChargenWizard.tsx`.

The App Router file under `apps/web/app/(app)/chargen` is kept as a thin route
wrapper. Feature code for chargen lives here so state, view-models, hooks, and
step components can be split incrementally without adding business logic to the
route layer.
