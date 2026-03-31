export type ContentSnapshotSource = "database" | "seed";

export interface RevisionedContentSnapshot<TContent = unknown> {
  content: TContent;
  revision: number;
  source: ContentSnapshotSource;
  updatedAt?: string;
}

export interface AdminContentGetResponse<TContent = unknown>
  extends RevisionedContentSnapshot<TContent> {}

export interface AdminContentPutRequest<TContent = unknown> {
  content: TContent;
  expectedRevision: number;
}

export interface AdminContentPutResponse<TContent = unknown>
  extends RevisionedContentSnapshot<TContent> {}

export interface AdminContentConflictResponse<TContent = unknown> {
  current: RevisionedContentSnapshot<TContent>;
  error: string;
}
