import type { JSX } from 'react';

import { RequestSubmitForm } from '../components/RequestSubmitForm';
import { useDemoRole } from '../context/DemoRoleContext';
import { useRequesterProfile } from '../context/RequesterProfileContext';
import { useSubmitAccessRequest } from '../hooks/useAccessRequests';
import { mutationErrorMessage } from '../lib/mutation-error';

export function RequestSubmitPage(): JSX.Element {
  const { isAdmin } = useDemoRole();
  const { profile } = useRequesterProfile();
  const submit = useSubmitAccessRequest();

  const submitError =
    submit.error !== null
      ? mutationErrorMessage(submit.error, 'Failed to generate recommendation.')
      : null;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-100">New request</h2>
        <p className="text-sm text-slate-400">
          {isAdmin
            ? 'Admins can submit requests and then review them in the Review queue.'
            : 'Users can submit access requests. Approvals are handled by admins.'}
        </p>
      </div>
      <RequestSubmitForm
        isSubmitting={submit.isPending}
        errorMessage={submitError}
        onSubmit={(payload) => {
          if (profile === null) {
            return;
          }
          submit.mutate({
            title: profile.title,
            department: profile.department,
            costCenter: profile.costCenter,
            systemName: payload.systemName,
            entitlementKey: payload.entitlementKey,
            justification: payload.justification,
          });
        }}
      />
      {submit.isSuccess ? (
        <p className="text-sm text-teal-300" role="status">
          Request submitted
          {isAdmin
            ? '. Open Review to approve, deny, or escalate.'
            : '. An admin will review the recommendation.'}
        </p>
      ) : null}
    </div>
  );
}
