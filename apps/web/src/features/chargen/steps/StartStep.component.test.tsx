import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StartStep } from "./StartStep";

describe("StartStep", () => {
  it("starts chargen from the entry action", async () => {
    const onStartNew = vi.fn();
    const user = userEvent.setup();

    render(<StartStep onStartNew={onStartNew} />);

    await user.click(screen.getByRole("button", { name: "Roll all dice" }));

    expect(onStartNew).toHaveBeenCalledOnce();
  });

  it("offers exact resume without replacing the saved draft", async () => {
    const onResume = vi.fn();
    const onStartNew = vi.fn();
    const user = userEvent.setup();

    render(
      <StartStep
        onResume={onResume}
        onStartNew={onStartNew}
        savedDraft={{ description: "Alyssa", kind: "current" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Resume saved Character" }));

    expect(onResume).toHaveBeenCalledOnce();
    expect(onStartNew).not.toHaveBeenCalled();
  });

  it("requires confirmation before replacing a current or historical draft", async () => {
    const onStartNew = vi.fn();
    const user = userEvent.setup();

    render(
      <StartStep
        onStartNew={onStartNew}
        savedDraft={{ description: "Historical Alyssa", kind: "historical" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create new Character" }));
    expect(onStartNew).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("will replace");

    await user.click(screen.getByRole("button", { name: "Keep saved draft" }));
    expect(onStartNew).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Create new Character" }));
    await user.click(screen.getByRole("button", { name: "Replace draft and roll" }));
    expect(onStartNew).toHaveBeenCalledOnce();
  });
});
