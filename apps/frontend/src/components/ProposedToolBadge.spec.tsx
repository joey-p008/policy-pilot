/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { AWAITING_HUMAN_APPROVAL_PROPOSED_TOOL } from '@policy-pilot/shared-types';

import { ProposedToolBadge } from './ProposedToolBadge';

describe('ProposedToolBadge', () => {
  it('renders the gated tool call awaiting human approval', () => {
    render(<ProposedToolBadge tool={AWAITING_HUMAN_APPROVAL_PROPOSED_TOOL} />);

    expect(
      screen.getByText('Proposed tool: propose_access_decision · awaiting human approval'),
    ).toBeInTheDocument();
  });
});
