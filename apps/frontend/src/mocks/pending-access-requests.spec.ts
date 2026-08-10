import { setDemoIdentity } from '../lib/demo-identity';
import {
  applyMockDecision,
  createMockAccessRequest,
  getMockHistoryAccessRequests,
  getMockPendingAccessRequests,
  MOCK_PENDING_ACCESS_REQUESTS,
  resetMockPendingAccessRequests,
} from './pending-access-requests';

describe('pending-access-requests mock store', () => {
  beforeEach(() => {
    resetMockPendingAccessRequests();
    setDemoIdentity('admin');
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

  it('creates a mock request with a heuristic recommendation and prepends it', () => {
    const created = createMockAccessRequest({
      targetEntitlement: 'prod-postgres-admin',
      justification: 'Need admin for an incident',
    });

    expect(created.recommendation.decision).toBe('DENY');
    expect(created.justification).toBe('Need admin for an incident');
    expect(getMockPendingAccessRequests()[0]?.requestId).toBe(created.requestId);
  });

  it('rejects pending list access for user role', () => {
    setDemoIdentity('user');
    expect(() => getMockPendingAccessRequests()).toThrow(/admin role required/);
  });

  it('moves a pending request into history on escalate', () => {
    const first = MOCK_PENDING_ACCESS_REQUESTS[0];
    if (first === undefined) {
      throw new Error('Expected at least one mock pending request');
    }

    const payload = {
      requestId: first.requestId,
    };

    const result = applyMockDecision(payload, 'escalated');

    expect(result).toEqual({
      requestId: first.requestId,
      status: 'escalated',
    });
    expect(getMockPendingAccessRequests().map((request) => request.requestId)).not.toContain(
      first.requestId,
    );
    expect(getMockHistoryAccessRequests()[0]?.requestId).toBe(first.requestId);
    expect(getMockHistoryAccessRequests()[0]?.status).toBe('ESCALATED');
    expect(console.info).toHaveBeenCalledWith('[HITL mock decision]', payload, {
      status: 'escalated',
    });
  });

  it('overrides a history decision to a different status', () => {
    const history = getMockHistoryAccessRequests();
    const first = history[0];
    if (first === undefined) {
      throw new Error('Expected at least one mock history request');
    }

    const result = applyMockDecision({ requestId: first.requestId }, 'denied');

    expect(result.status).toBe('denied');
    expect(
      getMockHistoryAccessRequests().find((request) => request.requestId === first.requestId)
        ?.status,
    ).toBe('DENIED');
  });
});
