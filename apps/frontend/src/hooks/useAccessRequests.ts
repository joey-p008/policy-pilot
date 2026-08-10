import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  ACCESS_REQUESTS_PENDING_QUERY_KEY,
  approveAccessRequest,
  denyAccessRequest,
  fetchPendingAccessRequests,
} from '../api/access-requests';

export function usePendingRequests() {
  return useQuery({
    queryKey: ACCESS_REQUESTS_PENDING_QUERY_KEY,
    queryFn: fetchPendingAccessRequests,
  });
}

export function useApproveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: approveAccessRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ACCESS_REQUESTS_PENDING_QUERY_KEY });
    },
  });
}

export function useDenyRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: denyAccessRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ACCESS_REQUESTS_PENDING_QUERY_KEY });
    },
  });
}
