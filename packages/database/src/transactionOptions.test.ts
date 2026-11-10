import { describe, expect, it } from "vitest";

import { buildTransactionOptions } from "./transactionOptions";

describe("buildTransactionOptions", () => {
  it("defaults to 10s maxWait and 30s timeout", () => {
    expect(buildTransactionOptions({})).toEqual({ maxWait: 10000, timeout: 30000 });
  });
  it("accepts positive integer env overrides", () => {
    expect(
      buildTransactionOptions({
        GLANTRI_DB_TX_MAX_WAIT_MS: "2500",
        GLANTRI_DB_TX_TIMEOUT_MS: "60000",
      }),
    ).toEqual({ maxWait: 2500, timeout: 60000 });
  });
  it.each(["0", "-5", "abc", "1.5", "", "1e3"])("falls back for invalid %j", (bad) => {
    expect(
      buildTransactionOptions({ GLANTRI_DB_TX_MAX_WAIT_MS: bad, GLANTRI_DB_TX_TIMEOUT_MS: bad }),
    ).toEqual({ maxWait: 10000, timeout: 30000 });
  });
});
