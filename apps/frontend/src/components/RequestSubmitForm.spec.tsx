/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import { RequestSubmitForm } from './RequestSubmitForm';

describe('RequestSubmitForm', () => {
  it('renders system and entitlement listboxes and keeps submit disabled until all ticket fields are set', () => {
    const onSubmit = jest.fn();
    render(<RequestSubmitForm isSubmitting={false} errorMessage={null} onSubmit={onSubmit} />);

    const systemSelect = screen.getByLabelText('System name');
    const entitlementSelect = screen.getByLabelText('Entitlement key');
    const justification = screen.getByPlaceholderText('Explain why this access is needed…');
    const submitButton = screen.getByRole('button', { name: 'Submit for recommendation' });

    expect(systemSelect).toBeInTheDocument();
    expect(entitlementSelect).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    fireEvent.change(systemSelect, { target: { value: 'DATA_WAREHOUSE' } });
    fireEvent.change(entitlementSelect, { target: { value: 'FIN_DATASET_EDIT' } });
    expect(submitButton).toBeDisabled();

    fireEvent.change(justification, { target: { value: 'Quarterly reporting pipeline' } });
    expect(submitButton).toBeEnabled();
  });
});
