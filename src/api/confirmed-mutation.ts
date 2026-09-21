/** Secondary reads cannot change a server-confirmed mutation into a failure. */
export async function confirmedMutation<T>(mutation: () => Promise<T>, synchronize: () => Promise<unknown>): Promise<T> {
  const result = await mutation()
  void Promise.resolve().then(synchronize).catch(() => undefined)
  return result
}
