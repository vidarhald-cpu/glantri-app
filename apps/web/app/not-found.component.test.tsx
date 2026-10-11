// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "./not-found";

describe("not-found page (#559)", () => {
  it("renders readable text and a way back to the app", () => {
    render(<NotFound />);

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeTruthy();
    expect(screen.getByText("This page could not be found.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to Home" }).getAttribute("href")).toBe("/");
  });
});
