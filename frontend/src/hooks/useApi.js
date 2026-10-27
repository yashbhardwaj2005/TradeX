import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, get, errorMessage } from '../services/api';
export const useApi = (path, params, options = {}) =>
  useQuery({ queryKey: [path, params], queryFn: () => get(path, params), ...options });
export function useAction({ success, onSuccess } = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ method = 'post', path, data, headers }) =>
      (await api.request({ method, url: path, data, headers })).data.data,
    onSuccess: (data) => {
      client.invalidateQueries();
      if (success) toast.success(typeof success === 'function' ? success(data) : success);
      onSuccess?.(data);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
