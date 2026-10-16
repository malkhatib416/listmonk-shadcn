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
    // Down at once (no grace sleep), then one sleep before the answer.
    expect(slept).toBe(1);
  });

  test('an answer from the old process, before it shuts down, does not count', async () => {
    const script = [true, true, false, false, true];
    let calls = 0;
    const health = async () => {
      if (!script[calls++]) throw new Error('down');
    };
    await waitForRestart(health, async () => {});
    expect(calls).toBe(5);
  });

  test('a restart that was missed does not hang: a healthy app is accepted after the grace period', async () => {
    let calls = 0;
    await waitForRestart(
      async () => {
        calls += 1;
      },
      async () => {},
      120,
      4,
    );
    expect(calls).toBe(5);
  });

  test('gives up after the max number of attempts', async () => {
    const health = async () => {
      throw new Error('down');
    };
    await expect(waitForRestart(health, async () => {}, 5)).rejects.toThrow('did not come back');
  });
});
