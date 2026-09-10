/**
 * Serializes async tasks that share a key.
 *
 * Used to protect read-modify-write sequences on a single game so that
 * concurrent messages (e.g. both players locking their fleet at once) cannot
 * clobber each other. This is sufficient for a single server instance; a
 * multi-instance deployment would need a distributed lock.
 */
export type KeyedMutex = <T>(key: string, task: () => Promise<T>) => Promise<T>;

export function createKeyedMutex(): KeyedMutex {
  const tails = new Map<string, Promise<void>>();

  return function run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    const result = previous.then(task, task);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    tails.set(key, tail);
    void tail.finally(() => {
      if (tails.get(key) === tail) {
        tails.delete(key);
      }
    });
    return result;
  };
}
