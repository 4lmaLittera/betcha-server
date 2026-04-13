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

  describe('GET /api/groups', () => {
    it('turėtų grąžinti vartotojo grupių sąrašą', async () => {
      const mockMemberships = [
        {
          role: 'admin',
          groups: { id: 'group-1', name: 'Grupė 1', invite_code: 'ABC123', created_by_id: 'user-123' },
        },
        {
          role: 'member',
          groups: { id: 'group-2', name: 'Grupė 2', invite_code: 'DEF456', created_by_id: 'user-456' },
        },
      ];

      const mockCounts = [
        { group_id: 'group-1' },
        { group_id: 'group-1' },
        { group_id: 'group-2' },
        { group_id: 'group-2' },
        { group_id: 'group-2' },
      ];

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockMemberships, error: null }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ data: mockCounts, error: null }),
          }),
        });

      const response = await request(app)
        .get('/api/groups')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toEqual({
        id: 'group-1',
        name: 'Grupė 1',
        inviteCode: 'ABC123',
        createdById: 'user-123',
        role: 'admin',
        memberCount: 2,
      });
      expect(response.body[1].memberCount).toBe(3);
    });
  });

  describe('GET /api/groups/:id/members', () => {
    it('turėtų grąžinti grupės narius', async () => {
      const mockMembers = [
        {
          profile_id: 'user-123',
          role: 'admin',
          joined_at: '2026-04-07T00:00:00Z',
          profiles: { username: 'testuser', avatar_url: 'https://avatar.url' },
        },
      ];

      (supabase.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'member-1' }, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'group-1', name: 'Grupė 1', invite_code: 'ABC123' },
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: mockMembers, error: null }),
          }),
        });

      const response = await request(app)
        .get('/api/groups/group-1/members')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.inviteCode).toBe('ABC123');
      expect(response.body.members).toHaveLength(1);
      expect(response.body.members[0].username).toBe('testuser');
    });

    it('turėtų grąžinti 403, kai vartotojas nėra narys', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      });

      const response = await request(app)
        .get('/api/groups/group-1/members')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Neturite prieigos prie šios grupės');
    });
  });
});
