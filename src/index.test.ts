import request from 'supertest';

jest.mock('./lib/logger', () => {
  const mock = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { __esModule: true, default: mock };
});

jest.mock('./lib/supabase', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  },
}));

import app from './app';

describe('GET /health', () => {
  it('turėtų grąžinti 200 kai DB ryšys veikia', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'connected' });
  });

  it('turėtų grąžinti 503 kai DB ryšys nepasiekiamas', async () => {
    const { supabase } = await import('./lib/supabase');
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST000', message: 'Connection refused' },
        }),
      }),
    });

    const response = await request(app).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.status).toBe('error');
  });
});
