import {
  applyMockDecision,
  getMockPendingAccessRequests,
  MOCK_PENDING_ACCESS_REQUESTS,
  resetMockPendingAccessRequests,
} from './pending-access-requests';

describe('pending-access-requests mock store', () => {
  beforeEach(() => {
    resetMockPendingAccessRequests();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a copy of the seeded pending list', () => {
    const pending = getMockPendingAccessRequests();
    expect(pending).toEqual(MOCK_PENDING_ACCESS_REQUESTS);
    pending.pop();
    expect(getMockPendingAccessRequests()).toHaveLength(MOCK_PENDING_ACCESS_REQUESTS.length);
  });

  it('removes a request on decision and logs the admin_id payload', () => {
    const first = MOCK_PENDING_ACCESS_REQUESTS[0];
    if (first === undefined) {
      throw new Error('Expected at least one mock pending request');
    }

    const payload = {
      requestId: first.requestId,
      admin_id: 'admin-123',
    };

    const result = applyMockDecision(payload, 'approved');

    expect(result).toEqual({
      requestId: first.requestId,
      status: 'approved',
    });
    expect(getMockPendingAccessRequests().map((request) => request.requestId)).not.toContain(
      first.requestId,
    );
    expect(console.info).toHaveBeenCalledWith('[HITL mock decision]', payload, {
      status: 'approved',
    });
  });
});
