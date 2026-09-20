import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MediaInspectionViewport } from "./MediaInspectionViewport";

describe("MediaInspectionViewport", () => {
  it("fits the material first and then zooms and pans on request", async () => {
    const user = userEvent.setup();
    render(<MediaInspectionViewport alt="A mountain pass" src="/content/artifact-1" />);

    const stage = screen.getByRole("group", { name: "Pan and zoom Artifact" });
    const image = screen.getByRole("img", { name: "A mountain pass" });
    expect(screen.getByText("Zoom 100%")).toBeVisible();
    expect(image).toHaveStyle({ transform: "translate(0px, 0px) scale(1)" });

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("Zoom 125%")).toBeVisible();
    fireEvent.keyDown(stage, { key: "ArrowDown" });
    expect(image).toHaveStyle({ transform: "translate(0px, 48px) scale(1.25)" });

    await user.click(screen.getByRole("button", { name: "Fit to screen" }));
    expect(screen.getByText("Zoom 100%")).toBeVisible();
    expect(image).toHaveStyle({ transform: "translate(0px, 0px) scale(1)" });
  });

  it("names its controls after the material so other visual content can reuse it", () => {
    render(
      <MediaInspectionViewport alt="The Broken Lands" mediaLabel="Map" src="/content/map-1" />,
    );
    expect(screen.getByRole("group", { name: "Pan and zoom Map" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Map view" })).toBeVisible();
  });

  it("gives a document the whole inspection area instead of image zoom controls", () => {
    const { container } = render(
      <MediaInspectionViewport alt="Guild charter" kind="document" src="about:blank" />,
    );
    const reader = container.querySelector("iframe");
    expect(reader).toHaveAttribute("title", "Guild charter");
    expect(reader).toHaveAttribute("src", "about:blank");
    expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull();
  });
});
