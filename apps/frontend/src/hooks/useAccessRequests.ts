import type {
  AccessRequestDecisionPayload,
  CreateAccessRequestPayload,
  PendingAccessRequest,
} from '@policy-pilot/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  ACCESS_REQUESTS_HISTORY_QUERY_KEY,
  ACCESS_REQUESTS_PENDING_QUERY_KEY,
} from '../api/access-request-keys';
import {
  approveAccessRequest,
  createAccessRequest,
  denyAccessRequest,
  escalateAccessRequest,
  fetchAccessRequestHistory,
  fetchPendingAccessRequests,
} from '../api/access-requests';
import { useDemoRole } from '../context/DemoRoleContext';

type DecisionMutationContext = {
  previousPending: PendingAccessRequest[] | undefined;
};

function removeRequestFromPendingCache(
  queryClient: ReturnType<typeof useQueryClient>,
  requestId: string,
): PendingAccessRequest[] | undefined {
  const previousPending = queryClient.getQueryData<PendingAccessRequest[]>(
    ACCESS_REQUESTS_PENDING_QUERY_KEY,
  );

  queryClient.setQueryData<PendingAccessRequest[]>(ACCESS_REQUESTS_PENDING_QUERY_KEY, (current) =>
    (current ?? []).filter((request) => request.requestId !== requestId),
  );

  return previousPending;
}

function useDecisionMutation(
  mutationFn: typeof approveAccessRequest | typeof denyAccessRequest | typeof escalateAccessRequest,
) {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof mutationFn>>,
    Error,
    AccessRequestDecisionPayload,
    DecisionMutationContext
  >({
    mutationFn,
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ACCESS_REQUESTS_PENDING_QUERY_KEY });
      const previousPending = removeRequestFromPendingCache(queryClient, payload.requestId);
      return { previousPending };
    },
    onError: (_error, _payload, context) => {
      if (context?.previousPending !== undefined) {
        queryClient.setQueryData(ACCESS_REQUESTS_PENDING_QUERY_KEY, context.previousPending);
      }
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ACCESS_REQUESTS_PENDING_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ACCESS_REQUESTS_HISTORY_QUERY_KEY }),
      ]);
    },
  });
}

export function usePendingRequests() {
  const { isAdmin } = useDemoRole();

  return useQuery({
    queryKey: ACCESS_REQUESTS_PENDING_QUERY_KEY,
    queryFn: fetchPendingAccessRequests,
    enabled: isAdmin,
  });
}

export function useRequestHistory() {
  const { isAdmin } = useDemoRole();

  return useQuery({
    queryKey: ACCESS_REQUESTS_HISTORY_QUERY_KEY,
    queryFn: fetchAccessRequestHistory,
    enabled: isAdmin,
  });
}

export function useSubmitAccessRequest() {
  const queryClient = useQueryClient();
  const { isAdmin } = useDemoRole();

  return useMutation({
    mutationFn: (payload: CreateAccessRequestPayload) => createAccessRequest(payload),
    onSuccess: async (created) => {
      if (isAdmin) {
        queryClient.setQueryData<PendingAccessRequest[]>(
          ACCESS_REQUESTS_PENDING_QUERY_KEY,
          (current) => [created, ...(current ?? [])],
        );
        await queryClient.invalidateQueries({ queryKey: ACCESS_REQUESTS_PENDING_QUERY_KEY });
      }
    },
  });
}

export function useApproveRequest() {
  return useDecisionMutation(approveAccessRequest);
}

export function useDenyRequest() {
  return useDecisionMutation(denyAccessRequest);
}

export function useEscalateRequest() {
  return useDecisionMutation(escalateAccessRequest);
}
