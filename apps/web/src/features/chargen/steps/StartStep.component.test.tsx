import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StartStep } from "./StartStep";

describe("StartStep", () => {
  it("starts chargen from the entry action", async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();

    render(<StartStep onStart={onStart} />);

    await user.click(screen.getByRole("button", { name: "Roll all dice" }));

    expect(onStart).toHaveBeenCalledOnce();
  });
});
