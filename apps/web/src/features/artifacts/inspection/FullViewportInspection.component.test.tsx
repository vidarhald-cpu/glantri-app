import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { FullViewportInspection } from "./FullViewportInspection";

describe("FullViewportInspection", () => {
  it("takes focus, exits on Escape, and returns focus to the surface that opened it", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)} type="button">
            Inspect Northern pass
          </button>
          {open ? (
            <FullViewportInspection
              exitLabel="Close inspection"
              onExit={() => {
                onExit();
                setOpen(false);
              }}
              title="Northern pass"
            >
              <p>material</p>
            </FullViewportInspection>
          ) : null}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Inspect Northern pass" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Northern pass" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close inspection" })).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("keeps Tab inside the inspection while it is open", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Behind the inspection</button>
        <FullViewportInspection
          exitLabel="Close inspection"
          onExit={() => {}}
          title="Northern pass"
        >
          <button type="button">Zoom in</button>
        </FullViewportInspection>
      </>,
    );

    await user.tab();
    expect(screen.getByRole("button", { name: "Zoom in" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close inspection" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Behind the inspection" })).not.toHaveFocus();
  });

  it("leaves Escape to the owning surface for a page presentation", async () => {
    const user = userEvent.setup();
    const onExit = vi.fn();
    render(
      <FullViewportInspection
        closeOnEscape={false}
        exitLabel="Back to Blackboard"
        onExit={onExit}
        presentation="page"
        subtitle="Artifact"
        title="Northern pass"
      >
        <p>material</p>
      </FullViewportInspection>,
    );

    expect(screen.getByRole("heading", { name: "Northern pass" })).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.keyboard("{Escape}");
    expect(onExit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Back to Blackboard" }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
