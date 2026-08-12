import {
  MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE,
  MOCK_DOWNSTREAM_WINDOW_MS,
  MockDownstreamRateLimitError,
  MockDownstreamService,
} from './mock-downstream.service';

describe('MockDownstreamService', () => {
  let service: MockDownstreamService;
  let now: number;

  beforeEach(() => {
    service = new MockDownstreamService();
    now = 1_800_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function invokeTimes(count: number): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      await service.invoke();
    }
  }

  it('accepts calls up to the advertised ceiling', async () => {
    await expect(invokeTimes(MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE)).resolves.toBeUndefined();
  });

  it('rejects the call that would exceed the ceiling', async () => {
    await invokeTimes(MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE);

    await expect(service.invoke()).rejects.toBeInstanceOf(MockDownstreamRateLimitError);
  });

  it('reports a retry-after covering the whole window when the burst is instantaneous', async () => {
    await invokeTimes(MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE);

    await expect(service.invoke()).rejects.toMatchObject({
      retryAfterMs: MOCK_DOWNSTREAM_WINDOW_MS,
    });
  });

  it('shrinks the retry-after as the oldest call ages toward the window edge', async () => {
    await invokeTimes(MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE);
    now += MOCK_DOWNSTREAM_WINDOW_MS - 10;

    await expect(service.invoke()).rejects.toMatchObject({ retryAfterMs: 10 });
  });

  it('frees a slot once the oldest call leaves the sliding window', async () => {
    await invokeTimes(MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE);
    now += MOCK_DOWNSTREAM_WINDOW_MS + 1;

    await expect(service.invoke()).resolves.toBeUndefined();
  });

  it('never advertises a non-positive retry-after', async () => {
    await invokeTimes(MOCK_DOWNSTREAM_RATE_LIMIT_PER_MINUTE);
    now += MOCK_DOWNSTREAM_WINDOW_MS;

    // The oldest call sits exactly on the boundary and is still counted, so the
    // hint must stay positive or a worker would busy-loop on a 0ms pause.
    await expect(service.invoke()).rejects.toMatchObject({ retryAfterMs: 1 });
  });
});
