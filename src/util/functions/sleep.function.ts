/**
 * Promisified setTimeout() function.
 *
 * @param {number} ms Waiting time in milliseconds.
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
