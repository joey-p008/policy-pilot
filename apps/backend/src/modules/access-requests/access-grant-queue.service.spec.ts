import { Queue } from 'bullmq';

import { AccessGrantQueueService } from './access-grant-queue.service';
import { ACCESS_GRANT_JOB_NAME, buildAccessGrantJobId } from './access-requests.constants';
import type { EntitlementExecutionInput } from './dto/entitlement-execution.dto';

const REQUEST_ID = 'req-grant-queue-1';
const ACTOR_USER_ID = 'f1c2a3b4-5d6e-4789-a012-3456789abcde';

const grantInput: EntitlementExecutionInput = {
  requestId: REQUEST_ID,
  employeeId: 'E-MOCK-042',
  actorUserId: ACTOR_USER_ID,
  systemName: 'DATA_WAREHOUSE',
  targetEntitlement: 'FIN_DATASET_READ',
};

describe('AccessGrantQueueService', () => {
  const add = jest.fn();
  const getJob = jest.fn();
  const service = new AccessGrantQueueService({
    add,
    getJob,
  } as unknown as Queue<EntitlementExecutionInput>);

  beforeEach(() => {
    jest.clearAllMocks();
    add.mockResolvedValue({ id: buildAccessGrantJobId(REQUEST_ID) });
  });

  describe('enqueueGrant', () => {
    it('builds a job id BullMQ will accept', () => {
      // BullMQ rejects custom job ids containing ':'.
      expect(buildAccessGrantJobId(REQUEST_ID)).not.toContain(':');
    });

    it('enqueues the grant under a deterministic job id so replays collapse', async () => {
      await service.enqueueGrant(grantInput);

      expect(add).toHaveBeenCalledWith(ACCESS_GRANT_JOB_NAME, grantInput, {
        jobId: buildAccessGrantJobId(REQUEST_ID),
      });
    });

    it('rejects an execution payload that fails schema validation', async () => {
      await expect(
        service.enqueueGrant({ ...grantInput, actorUserId: 'not-a-uuid' }),
      ).rejects.toThrow();
      expect(add).not.toHaveBeenCalled();
    });
  });

  describe('cancelQueuedGrant', () => {
    it('reports nothing to cancel when no grant job exists', async () => {
      getJob.mockResolvedValue(undefined);

      await expect(service.cancelQueuedGrant(REQUEST_ID)).resolves.toBe(false);
    });

    it.each(['waiting', 'delayed', 'prioritized', 'waiting-children'])(
      'removes a grant still in the %s state',
      async (state) => {
        const remove = jest.fn().mockResolvedValue(undefined);
        getJob.mockResolvedValue({ getState: jest.fn().mockResolvedValue(state), remove });

        await expect(service.cancelQueuedGrant(REQUEST_ID)).resolves.toBe(true);
        expect(getJob).toHaveBeenCalledWith(buildAccessGrantJobId(REQUEST_ID));
        expect(remove).toHaveBeenCalledTimes(1);
      },
    );

    it('leaves an already active grant alone so revoke repairs it instead', async () => {
      const remove = jest.fn();
      getJob.mockResolvedValue({ getState: jest.fn().mockResolvedValue('active'), remove });

      await expect(service.cancelQueuedGrant(REQUEST_ID)).resolves.toBe(false);
      expect(remove).not.toHaveBeenCalled();
    });

    it('leaves a completed grant alone', async () => {
      const remove = jest.fn();
      getJob.mockResolvedValue({ getState: jest.fn().mockResolvedValue('completed'), remove });

      await expect(service.cancelQueuedGrant(REQUEST_ID)).resolves.toBe(false);
      expect(remove).not.toHaveBeenCalled();
    });

    it('reports a lost removal race without failing the override', async () => {
      const remove = jest.fn().mockRejectedValue(new Error('could not remove job: locked'));
      getJob.mockResolvedValue({ getState: jest.fn().mockResolvedValue('waiting'), remove });

      await expect(service.cancelQueuedGrant(REQUEST_ID)).resolves.toBe(false);
    });
  });
});
