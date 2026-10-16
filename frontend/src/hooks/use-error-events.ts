import { useEffect } from 'react';
import { toast } from 'sonner';
import { apiUrl } from '@/lib/api';
import { errorEventMessage } from '@/lib/events';

// Cap toasts so a burst of server errors cannot flood the page.
const MAX_TOASTS = 50;

// Toast server-side errors as they happen (SSE). Only for users allowed to read the stream.
export function useErrorEvents(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const src = new EventSource(apiUrl(window._LM_ROOT, '/api/events?type=error'), {
      withCredentials: true,
    });
    let count = 0;
    src.onmessage = (e) => {
      if (count >= MAX_TOASTS) {
        src.close();
        return;
      }
      count += 1;
      const msg = errorEventMessage(e.data);
      if (msg) toast.error(msg);
    };
    return () => src.close();
  }, [enabled]);
}
