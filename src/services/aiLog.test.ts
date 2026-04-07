jest.mock('../lib/logger', () => {
  const mock = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { __esModule: true, default: mock };
});

const mockInsert = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
    }),
  },
}));

import { logAiRequest } from './aiLog';

describe('logAiRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('turėtų įrašyti sėkmingą užklausą', async () => {
    mockInsert.mockResolvedValue({ error: null });

    await logAiRequest({ uploadId: 'abc-123', status: 'success' });

    expect(mockInsert).toHaveBeenCalledWith({
      upload_id: 'abc-123',
      status: 'success',
      error_reason: null,
    });
  });

  it('turėtų įrašyti nesėkmingą užklausą su klaidos priežastimi', async () => {
    mockInsert.mockResolvedValue({ error: null });

    await logAiRequest({
      uploadId: 'abc-123',
      status: 'failed',
      errorReason: 'Timeout',
    });

    expect(mockInsert).toHaveBeenCalledWith({
      upload_id: 'abc-123',
      status: 'failed',
      error_reason: 'Timeout',
    });
  });

  it('turėtų nesukelti klaidos kai DB insert nepavyksta', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'DB error' } });

    await expect(
      logAiRequest({ uploadId: 'abc-123', status: 'success' }),
    ).resolves.toBeUndefined();
  });
});
