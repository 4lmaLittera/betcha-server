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

const mockUser = { id: 'user-123', email: 'test@example.com' };

function mockAuth() {
  (supabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: mockUser },
    error: null,
  });
}

describe('GroupController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth();
  });

  describe('POST /api/groups', () => {
    it('turėtų sukurti grupę ir grąžinti 201', async () => {
      const mockGroup = { id: 'group-1', name: 'Test Group', invite_code: 'ABC123' };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockGroup, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null }),
        });

      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Test Group' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual(mockGroup);
    });

    it('turėtų grąžinti 400, kai pavadinimas tuščias', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: '' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Grupės pavadinimas yra privalomas');
    });

    it('turėtų grąžinti 400, kai pavadinimas nepateiktas', async () => {
      const response = await request(app)
        .post('/api/groups')
        .set('Authorization', 'Bearer valid-token')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/groups/join', () => {
    it('turėtų prisijungti prie grupės su teisingu kodu', async () => {
      const mockGroup = { id: 'group-1', name: 'Test Group' };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockGroup, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: null }),
        });

      const response = await request(app)
        .post('/api/groups/join')
        .set('Authorization', 'Bearer valid-token')
        .send({ inviteCode: 'ABC123' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ groupId: 'group-1', name: 'Test Group' });
    });

    it('turėtų grąžinti 404 su netinkamu kodu', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      });

      const response = await request(app)
        .post('/api/groups/join')
        .set('Authorization', 'Bearer valid-token')
        .send({ inviteCode: 'INVALID' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Grupė su tokiu kvietimo kodu nerasta');
    });

    it('turėtų grąžinti 409, kai jau narys', async () => {
      const mockGroup = { id: 'group-1', name: 'Test Group' };

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockGroup, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockResolvedValue({ error: { code: '23505', message: 'duplicate' } }),
        });

      const response = await request(app)
        .post('/api/groups/join')
        .set('Authorization', 'Bearer valid-token')
        .send({ inviteCode: 'ABC123' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Jau esate šios grupės narys');
    });
  });
});
