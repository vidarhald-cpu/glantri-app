export class ChargenDraftPersistenceCoordinator {
  private acceptingWrites = true;
  private pendingWrites: Promise<void> = Promise.resolve();

  constructor(private readonly onWriteError: (error: unknown) => void) {}

  enqueue(write: () => Promise<void>): void {
    if (!this.acceptingWrites) {
      return;
    }

    this.pendingWrites = this.pendingWrites
      .then(async () => {
        if (!this.acceptingWrites) {
          return;
        }

        await write();
      })
      .catch((error) => {
        this.onWriteError(error);
      });
  }

  async suspendAndDrain(): Promise<void> {
    this.acceptingWrites = false;
    await this.pendingWrites;
  }

  resume(): void {
    this.acceptingWrites = true;
  }
}
