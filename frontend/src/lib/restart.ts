import { apiFetch } from './api';

const DEFAULT_ATTEMPTS = 120;
// Go answers the restart request first and signals itself 500ms later, so for a moment the
// old process still answers /api/health. How many polls to give it to go down.
const DEFAULT_GRACE = 8;
const INTERVAL_MS = 500;

const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// After a restart is triggered, wait for the old process to go down, then poll /api/health
// until the new one answers. A restart that never shows as down (it was quick, or did not
// happen) is not waited on past the grace period.
export async function waitForRestart(
  health: () => Promise<unknown> = () => apiFetch('/api/health'),
  sleep: (ms: number) => Promise<void> = sleepMs,
  maxAttempts = DEFAULT_ATTEMPTS,
  graceAttempts = DEFAULT_GRACE,
): Promise<void> {
  for (let i = 0; i < graceAttempts; i += 1) {
    try {
      await health();
    } catch {
      break;
    }
    await sleep(INTERVAL_MS);
  }

  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      await health();
      return;
    } catch {
      await sleep(INTERVAL_MS);
    }
  }
  throw new Error('The app did not come back after the restart.');
}
