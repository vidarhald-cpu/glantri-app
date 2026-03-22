import type {
  SyncPullRequest,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse
} from "@glantri/shared";

export interface SyncClient {
  pull<TPayload = unknown>(request: SyncPullRequest): Promise<SyncPullResponse<TPayload>>;
  push<TPayload = unknown>(request: SyncPushRequest<TPayload>): Promise<SyncPushResponse>;
}

export class HttpSyncClient implements SyncClient {
  constructor(private readonly baseUrl: string) {}

  async pull<TPayload = unknown>(
    request: SyncPullRequest
  ): Promise<SyncPullResponse<TPayload>> {
    const url = new URL("/sync", this.baseUrl);

    if (request.cursor) {
      url.searchParams.set("cursor", request.cursor);
    }

    const response = await fetch(url);
    return response.json();
  }

  async push<TPayload = unknown>(
    request: SyncPushRequest<TPayload>
  ): Promise<SyncPushResponse> {
    const response = await fetch(new URL("/sync", this.baseUrl), {
      body: JSON.stringify(request),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    return response.json();
  }
}
