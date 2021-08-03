/**
 * Promisified setTimeout() function.
 *
 * @param {number} ms Waiting time in milliseconds.
 */
// istanbul ignore next: no need to test
export async function sleep(ms: number): Promise<void> {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
