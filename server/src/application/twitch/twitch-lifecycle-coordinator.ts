/** One lifecycle boundary shared by Chat, Favor, Gift and unlink. Never nest run for one Player. */
export class TwitchLifecycleCoordinator {
  private readonly queues = new Map<string, Promise<void>>();
  async run<T>(playerId: string, action: () => Promise<T>): Promise<T> {
    const job = (this.queues.get(playerId) ?? Promise.resolve()).then(action);
    const settled = job.then(() => undefined, () => undefined);
    this.queues.set(playerId, settled);
    try { return await job; }
    finally { if (this.queues.get(playerId) === settled) this.queues.delete(playerId); }
  }
}
