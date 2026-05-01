/**
 * Run an async `fn` over `items` with bounded concurrency.
 * Results are returned in the same order as the input array.
 * If `fn` throws, the error is captured and rethrown after all in-flight
 * tasks have settled (so we don't leave dangling Magnific calls running).
 */
export async function pool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const max = Math.max(1, Math.min(limit, items.length));
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let firstError: unknown = undefined;

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i] as T, i);
      } catch (err) {
        if (firstError === undefined) firstError = err;
      }
    }
  }

  await Promise.all(Array.from({ length: max }, () => worker()));
  if (firstError !== undefined) throw firstError;
  return results;
}

/**
 * Same as `pool` but each task may resolve to either a value or `null` on
 * recoverable failure. Errors thrown by `fn` are caught, logged via `onError`,
 * and converted to `null` in the result array — the whole pool always settles.
 * Use for image-generation fan-out where one failed image should not abort
 * the rest.
 */
export async function poolSettled<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onError?: (err: unknown, item: T, index: number) => void,
): Promise<(R | null)[]> {
  const max = Math.max(1, Math.min(limit, items.length));
  const results: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i] as T, i);
      } catch (err) {
        if (onError) {
          try { onError(err, items[i] as T, i); } catch { /* noop */ }
        }
        results[i] = null;
      }
    }
  }

  await Promise.all(Array.from({ length: max }, () => worker()));
  return results;
}
