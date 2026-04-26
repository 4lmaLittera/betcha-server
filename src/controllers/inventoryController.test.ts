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

describe('InventoryController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@example.com' } },
      error: null,
    });
  });

  it('turėtų grąžinti inventoriaus itemus ir kai itemas nebeaktyvus store', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'inv-1',
                  is_used: false,
                  purchased_at: '2026-04-27T00:00:00Z',
                  item: {
                    id: 'item-1',
                    name: 'Nebeparduodamas itemas',
                    description: 'Išliko inventoriuje',
                    is_active: false,
                  },
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });

    const response = await request(app)
      .get('/api/inventory')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].item.name).toBe('Nebeparduodamas itemas');
    expect(response.body[0].item.is_active).toBe(false);
  });
});
