import type { Id, IsoDateString } from "../types";

export type SyncOperationType = "upsert-character" | "delete-character" | "refresh-content";
export type SyncQueueStatus = "pending" | "processing" | "failed" | "synced";

export interface SyncQueueItem<TPayload = unknown> {
  id: Id;
  entityId: Id;
  operation: SyncOperationType;
  payload: TPayload;
  status: SyncQueueStatus;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  retryCount: number;
  lastError?: string;
}

export interface SyncPullRequest {
  cursor?: IsoDateString;
}

export interface SyncPullResponse<TPayload = unknown> {
  cursor: IsoDateString;
  items: TPayload[];
}

export interface SyncPushRequest<TPayload = unknown> {
  items: Array<SyncQueueItem<TPayload>>;
}

export interface SyncPushResponse {
  acceptedIds: Id[];
  rejectedIds: Id[];
}
