/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { ProvisioningBadge } from './ProvisioningBadge';

describe('ProvisioningBadge', () => {
  it('renders nothing for a decision that never reaches a downstream adapter', () => {
    const { container } = render(<ProvisioningBadge provisioningStatus="NOT_APPLICABLE" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('tells the reviewer an approved grant is still waiting on downstream capacity', () => {
    render(<ProvisioningBadge provisioningStatus="QUEUED" />);

    expect(screen.getByText('Provisioning queued')).toBeInTheDocument();
    expect(screen.getByTitle(/Waiting for downstream capacity/)).toBeInTheDocument();
  });

  it('confirms a completed downstream grant', () => {
    render(<ProvisioningBadge provisioningStatus="PROVISIONED" />);

    expect(screen.getByText('Provisioned')).toBeInTheDocument();
  });

  it('surfaces an exhausted grant as needing manual follow-up', () => {
    render(<ProvisioningBadge provisioningStatus="FAILED" />);

    expect(screen.getByText('Provisioning failed')).toBeInTheDocument();
    expect(screen.getByTitle(/needs manual follow-up/)).toBeInTheDocument();
  });
});
