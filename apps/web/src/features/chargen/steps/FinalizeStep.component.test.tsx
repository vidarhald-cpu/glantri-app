import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { CORE_ROUTE_SELECTION_ERROR, FinalizeStep } from "./FinalizeStep";

/**
 * Forgejo #636 — the Finalize step gated on `review.canFinalize` and never read
 * `review.errors`, so a blocked player saw a disabled `Finalize character`
 * button and no reason on that step. The reasons the rules engine already
 * produces must be stated here, verbatim, and the gate must not move.
 *
 * The one exception is the #635 cross-lane finding: `CORE_ROUTE_SELECTION_ERROR`
 * is emitted both when a core-route choice is owed and when no applicable route
 * exists at all, so it is withheld in the second case rather than reworded.
 * `FinalizeStep.rulesBinding.test.ts` binds that constant to the engine.
 */
const CORE_ROUTE_ERROR =
  "Complete the selected Profession core route: Ordinary records-office service.";
const SELECTION_SLOT_ERROR = "Literacy: Choose one written language.";
const CONTENT_INTEGRITY_ERROR = "Missing skill definition for skill:unknown.";

const SIGNED_IN_USER = { displayName: "Tester", email: "tester@example.test", id: "user-1" };

interface RenderOptions {
  /** How many Profession core routes are applicable to this draft. */
  applicableRoutes?: number;
  canFinalize: boolean;
  /** "signed-in", "signed-out" (null) or "loading" (undefined, the session is unresolved). */
  session?: "loading" | "signed-in" | "signed-out";
  errors?: string[];
  isFinalizing?: boolean;
}

function renderFinalize({
  applicableRoutes = 1,
  canFinalize,
  session = "signed-in",
  errors = [],
  isFinalizing = false,
}: RenderOptions) {
  const props = {
    characterName: "",
    coreRouteStatus: {
      applicableRoutes: Array.from({ length: applicableRoutes }, (_unused, index) => ({
        id: `route-${index}`,
      })),
    },
    currentUser:
      session === "signed-in" ? SIGNED_IN_USER : session === "signed-out" ? null : undefined,
    handleFinalize: async () => {},
    isFinalizing,
    review: { canFinalize, errors, warnings: [] },
    setCharacterName: () => {},
  } as unknown as Parameters<typeof FinalizeStep>[0];

  return render(<FinalizeStep {...props} />);
}

function finalizeButton() {
  return screen.getByRole("button", { name: /Finalize character|Saving character/ });
}

afterEach(cleanup);

describe("Finalize step blocking reasons", () => {
  it("states every reason the rules engine produced when finalizing is blocked", () => {
    renderFinalize({
      canFinalize: false,
      errors: [CORE_ROUTE_ERROR, SELECTION_SLOT_ERROR, CONTENT_INTEGRITY_ERROR],
    });

    for (const reason of [CORE_ROUTE_ERROR, SELECTION_SLOT_ERROR, CONTENT_INTEGRITY_ERROR]) {
      expect(screen.getByText(reason)).toBeTruthy();
    }

    const button = finalizeButton();

    expect(button.hasAttribute("disabled")).toBe(true);

    const describedBy = button.getAttribute("aria-describedby");

    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")?.textContent ?? "").toContain(
      CORE_ROUTE_ERROR,
    );
  });

  it("reproduces no reason text of its own", () => {
    const { container } = renderFinalize({ canFinalize: false, errors: [CORE_ROUTE_ERROR] });
    const sectionText = container.textContent ?? "";
    const standingCopy =
      "Confirm the name and create the local character record. The signed-in player is stored as the creator for attribution.";
    const remainder = sectionText
      .replace(standingCopy, "")
      .replace("11. Finalize character", "")
      .replace("Character name", "")
      .replace("Creator attribution", "")
      .replace("Tester (tester@example.test)", "")
      .replace("Finalize character", "")
      .replace(CORE_ROUTE_ERROR, "")
      .trim();

    expect(remainder).toBe("");
  });

  it("shows no blocking message and enables the button when the draft can finalize", () => {
    const { container } = renderFinalize({ canFinalize: true });
    const button = finalizeButton();

    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-describedby")).toBe(null);
    expect(container.querySelector("[role='status']")).toBe(null);
  });

  it("stays silent when finalizing is allowed even if stale error strings are present", () => {
    const { container } = renderFinalize({ canFinalize: true, errors: [CORE_ROUTE_ERROR] });

    expect(screen.queryByText(CORE_ROUTE_ERROR)).toBe(null);
    expect(container.querySelector("[role='status']")).toBe(null);
    expect(finalizeButton().hasAttribute("disabled")).toBe(false);
  });
});

describe("Finalize step and the core-route message that is not always actionable", () => {
  it("states the core-route message while a route is applicable", () => {
    renderFinalize({
      applicableRoutes: 2,
      canFinalize: false,
      errors: [CORE_ROUTE_SELECTION_ERROR],
    });

    expect(screen.getByText(CORE_ROUTE_SELECTION_ERROR)).toBeTruthy();
  });

  it("withholds it when no route is applicable, and still states the other reasons", () => {
    renderFinalize({
      applicableRoutes: 0,
      canFinalize: false,
      errors: [CORE_ROUTE_SELECTION_ERROR, SELECTION_SLOT_ERROR],
    });

    expect(screen.queryByText(CORE_ROUTE_SELECTION_ERROR)).toBe(null);
    expect(screen.getByText(SELECTION_SLOT_ERROR)).toBeTruthy();
    expect(finalizeButton().hasAttribute("disabled")).toBe(true);
  });

  it("says nothing rather than something misleading when it is the only reason", () => {
    /* #635: Scythians + "Scribe and Copyist" blocks on this one string with zero
       applicable routes. Surfacing it would instruct the player to select one of
       zero options, and the honest alternative needs player-facing text this lane
       is not authorized to author, so the step stays silent and still disabled —
       the pre-#636 behaviour for this one case, and no worse than it. */
    const { container } = renderFinalize({
      applicableRoutes: 0,
      canFinalize: false,
      errors: [CORE_ROUTE_SELECTION_ERROR],
    });

    expect(container.querySelector("[role='status']")).toBe(null);
    expect(finalizeButton().hasAttribute("disabled")).toBe(true);
    expect(finalizeButton().getAttribute("aria-describedby")).toBe(null);
  });
});

describe("Finalize step gating is unchanged", () => {
  const cases: Array<{ expectedDisabled: boolean; name: string; options: RenderOptions }> = [
    {
      expectedDisabled: false,
      name: "can finalize, signed in, idle",
      options: { canFinalize: true },
    },
    {
      expectedDisabled: true,
      name: "cannot finalize",
      options: { canFinalize: false, errors: [CORE_ROUTE_ERROR] },
    },
    {
      expectedDisabled: true,
      name: "session still loading",
      options: { canFinalize: true, session: "loading" },
    },
    {
      // Pre-existing behaviour, unchanged by #636: a resolved `null` session
      // leaves the button enabled and `handleFinalize` reports the sign-in
      // requirement itself. `currentUser === undefined` is the only session
      // value in the gate.
      expectedDisabled: false,
      name: "signed out with a resolved session",
      options: { canFinalize: true, session: "signed-out" },
    },
    {
      expectedDisabled: true,
      name: "finalize already in flight",
      options: { canFinalize: true, isFinalizing: true },
    },
    {
      expectedDisabled: true,
      name: "cannot finalize and session still loading",
      options: { canFinalize: false, session: "loading", errors: [CORE_ROUTE_ERROR] },
    },
  ];

  for (const testCase of cases) {
    it(`keeps the same disabled state when ${testCase.name}`, () => {
      renderFinalize(testCase.options);

      expect(finalizeButton().hasAttribute("disabled")).toBe(testCase.expectedDisabled);
    });
  }

  it("adds no reason for the disabling conditions that are not rules-engine errors", () => {
    const loading = renderFinalize({ canFinalize: true, session: "loading" });

    expect(loading.container.querySelector("[role='status']")).toBe(null);
    expect(screen.getByText("Loading session...")).toBeTruthy();
    cleanup();

    const signedOut = renderFinalize({ canFinalize: true, session: "signed-out" });

    expect(signedOut.container.querySelector("[role='status']")).toBe(null);
    expect(screen.getByText("Not signed in")).toBeTruthy();
    cleanup();

    const inFlight = renderFinalize({ canFinalize: true, isFinalizing: true });

    expect(inFlight.container.querySelector("[role='status']")).toBe(null);
    expect(screen.getByRole("button", { name: "Saving character..." })).toBeTruthy();
  });
});
