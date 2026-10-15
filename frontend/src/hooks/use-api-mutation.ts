import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Options<TVars, TData> {
  mutationFn: (vars: TVars) => Promise<TData>;
  // Query keys to refetch on success.
  invalidate?: QueryKey[];
  // Toast text on success; return undefined for no toast.
  success?: (data: TData, vars: TVars) => string | undefined;
  onSuccess?: (data: TData, vars: TVars) => void;
}

// A mutation with the app-wide behaviour: success toast, refetch, error toast with
// the server's message.
export function useApiMutation<TVars = void, TData = unknown>(o: Options<TVars, TData>) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars>({
    mutationFn: o.mutationFn,
    onSuccess: async (data, vars) => {
      await Promise.all((o.invalidate ?? []).map((queryKey) => qc.invalidateQueries({ queryKey })));
      const msg = o.success?.(data, vars);
      if (msg) toast.success(msg);
      o.onSuccess?.(data, vars);
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });
}
