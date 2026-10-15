import { describe, expect, test } from 'bun:test';
import { waitForRestart } from './restart';

describe('waitForRestart', () => {
  test('polls until the health check succeeds', async () => {
    let calls = 0;
    const health = async () => {
      calls += 1;
      if (calls < 3) throw new Error('down');
    };
    let slept = 0;
    await waitForRestart(health, async () => {
      slept += 1;
    });
    expect(calls).toBe(3);
    expect(slept).toBe(2);
  });

  test('gives up after the max number of attempts', async () => {
    const health = async () => {
      throw new Error('down');
    };
    await expect(waitForRestart(health, async () => {}, 5)).rejects.toThrow('did not come back');
  });
});
