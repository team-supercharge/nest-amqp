import { sleep } from './sleep.function';

describe('sleep()', () => {
  it('should wait for the specified time', async () => {
    await expect(sleep(1000)).resolves.toBe(undefined);
  });
});
