import { afterEach, describe, expect, it, vi } from "vitest";

function response(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json" },
    status: 200,
  });
}

describe("artifactClient strict mutation bodies", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("keeps route identity and action fields out of strict API payloads", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockImplementation(async () => response({ artifact: {}, reference: {} }));
    vi.stubGlobal("fetch", fetchMock);
    const client = await import("./artifactClient");

    await client.setArtifactAudience({
      artifactId: "artifact-1",
      audience: "campaign",
      campaignId: "campaign-1",
      expectedMetadataVersion: 3,
    });
    await client.updateArtifactMetadata({
      artifactId: "artifact-1",
      campaignId: "campaign-1",
      expectedMetadataVersion: 4,
      title: "Safe title",
    });
    await client.mutateScenarioArtifact({
      action: "publish",
      artifactId: "artifact-1",
      campaignId: "campaign-1",
      expectedArtifactVersion: 5,
      expectedReferenceVersion: 2,
      scenarioId: "scenario-1",
    });

    expect(fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { audience: "campaign", expectedMetadataVersion: 3 },
      { expectedMetadataVersion: 4, title: "Safe title" },
      { expectedArtifactVersion: 5, expectedReferenceVersion: 2 },
    ]);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.example.test/campaigns/campaign-1/artifacts/artifact-1/audience",
      "https://api.example.test/campaigns/campaign-1/artifacts/artifact-1",
      "https://api.example.test/campaigns/campaign-1/scenarios/scenario-1/artifacts/artifact-1/publish",
    ]);
  });
});
