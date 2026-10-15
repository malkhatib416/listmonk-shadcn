import { apiFetch } from './api';

const DEFAULT_ATTEMPTS = 120;
const INTERVAL_MS = 500;

const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// After a restart is triggered, poll /api/health until the app answers again.
export async function waitForRestart(
  health: () => Promise<unknown> = () => apiFetch('/api/health'),
  sleep: (ms: number) => Promise<void> = sleepMs,
  maxAttempts = DEFAULT_ATTEMPTS,
): Promise<void> {
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
