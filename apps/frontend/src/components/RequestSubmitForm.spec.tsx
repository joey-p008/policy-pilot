/** @jest-environment jsdom */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import { RequestSubmitForm } from './RequestSubmitForm';

describe('RequestSubmitForm', () => {
  it('keeps the entitlement listbox disabled until a system name is selected', () => {
    render(<RequestSubmitForm isSubmitting={false} errorMessage={null} onSubmit={jest.fn()} />);

    const entitlementSelect = screen.getByLabelText('Entitlement key');
    expect(entitlementSelect).toBeDisabled();
    expect(entitlementSelect).toHaveDisplayValue('Select a system name first');
    expect(screen.queryByRole('option', { name: 'FIN_DATASET_READ' })).not.toBeInTheDocument();
  });

  it('limits entitlement options to the selected system and keeps submit disabled until all ticket fields are set', () => {
    const onSubmit = jest.fn();
    render(<RequestSubmitForm isSubmitting={false} errorMessage={null} onSubmit={onSubmit} />);

    const systemSelect = screen.getByLabelText('System name');
    const entitlementSelect = screen.getByLabelText('Entitlement key');
    const justification = screen.getByPlaceholderText('Explain why this access is needed…');
    const submitButton = screen.getByRole('button', { name: 'Submit for recommendation' });

    expect(submitButton).toBeDisabled();

    fireEvent.change(systemSelect, { target: { value: 'DATA_WAREHOUSE' } });
    expect(entitlementSelect).toBeEnabled();
    expect(screen.getByRole('option', { name: 'FIN_DATASET_READ' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'FIN_DATASET_EDIT' })).not.toBeInTheDocument();

    fireEvent.change(entitlementSelect, { target: { value: 'FIN_DATASET_READ' } });
    expect(submitButton).toBeDisabled();

    fireEvent.change(justification, { target: { value: 'Quarterly reporting pipeline' } });
    expect(submitButton).toBeEnabled();
  });

  it('clears the entitlement key when the system name changes', () => {
    render(<RequestSubmitForm isSubmitting={false} errorMessage={null} onSubmit={jest.fn()} />);

    const systemSelect = screen.getByLabelText('System name');
    const entitlementSelect = screen.getByLabelText('Entitlement key');

    fireEvent.change(systemSelect, { target: { value: 'DATA_WAREHOUSE' } });
    fireEvent.change(entitlementSelect, { target: { value: 'FIN_DATASET_READ' } });
    expect(entitlementSelect).toHaveValue('FIN_DATASET_READ');

    fireEvent.change(systemSelect, { target: { value: 'FINANCE_ANALYTICS_DB' } });
    expect(entitlementSelect).toHaveValue('');
    expect(screen.getByRole('option', { name: 'FIN_DATASET_EDIT' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'FIN_DATASET_READ' })).not.toBeInTheDocument();
  });
});
