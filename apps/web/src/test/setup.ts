import "fake-indexeddb/auto";
import "@testing-library/jest-dom";
import { beforeAll, afterAll } from "vitest";

// styled-jsx (<style jsx>) leaks `jsx={true}` to DOM in happy-dom since the
// Next.js/SWC transform is not active in the test environment.
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("non-boolean attribute `jsx`")) return;
    originalConsoleError(...args);
  };
});
afterAll(() => {
  console.error = originalConsoleError;
});
