import request from 'supertest';
import app from '../app';
import { supabase } from '../lib/supabase';

jest.mock('../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

describe('ShopController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });
  });

  it('turėtų grąžinti tik aktyvius store itemus', async () => {
    const eqMock = jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({
        data: [{ id: 'item-1', name: 'Aktyvus', is_active: true, price: 100 }],
        error: null,
      }),
    });

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: eqMock,
      }),
    });

    const response = await request(app)
      .get('/api/shop')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(eqMock).toHaveBeenCalledWith('is_active', true);
    expect(response.body).toEqual([{ id: 'item-1', name: 'Aktyvus', is_active: true, price: 100 }]);
  });
});
