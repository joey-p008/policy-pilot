import type { AccessRequestProvisioningStatus } from '@policy-pilot/shared-types';
import type { JSX } from 'react';

const BADGE_CLASS_BY_STATUS: Record<AccessRequestProvisioningStatus, string> = {
  NOT_APPLICABLE: '',
  QUEUED: 'bg-sky-900/70 text-sky-200 ring-sky-700/80',
  PROVISIONED: 'bg-teal-900/70 text-teal-200 ring-teal-700/80',
  FAILED: 'bg-rose-900/70 text-rose-200 ring-rose-700/80',
};

const LABEL_BY_STATUS: Record<AccessRequestProvisioningStatus, string> = {
  NOT_APPLICABLE: '',
  QUEUED: 'Provisioning queued',
  PROVISIONED: 'Provisioned',
  FAILED: 'Provisioning failed',
};

const DESCRIPTION_BY_STATUS: Record<AccessRequestProvisioningStatus, string> = {
  NOT_APPLICABLE: '',
  QUEUED: 'Approved. Waiting for downstream capacity before the entitlement is granted.',
  PROVISIONED: 'The downstream system has granted the entitlement.',
  FAILED:
    'The downstream grant exhausted its retries. The request stays approved but the entitlement was never granted, so it needs manual follow-up.',
};

export function ProvisioningBadge({
  provisioningStatus,
}: {
  provisioningStatus: AccessRequestProvisioningStatus;
}): JSX.Element | null {
  if (provisioningStatus === 'NOT_APPLICABLE') {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide ring-1 ring-inset ${BADGE_CLASS_BY_STATUS[provisioningStatus]}`}
      title={DESCRIPTION_BY_STATUS[provisioningStatus]}
    >
      {LABEL_BY_STATUS[provisioningStatus]}
    </span>
  );
}
