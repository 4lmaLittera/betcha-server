import request from 'supertest';

jest.mock('../lib/logger', () => {
  const mock = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { __esModule: true, default: mock };
});

const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@test.com' } },
        error: null,
      }),
    },
    from: () => ({
      insert: (...args: unknown[]) => {
        mockInsert(...args);
        return {
          select: (...sArgs: unknown[]) => {
            mockSelect(...sArgs);
            return { single: mockSingle };
          },
        };
      },
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  },
}));

jest.mock('../lib/openai', () => ({
  getOpenAI: () => ({}),
}));

import app from '../app';

describe('POST /api/tasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: 'task-123' }, error: null });
  });

  const validBody = {
    title: 'Netvarkinga virtuvė',
    description: 'Ant stalo palikti indai.',
    bettingIndex: 7,
    groupId: 'group-abc',
  };

  it('turėtų sukurti užduotį ir grąžinti ID', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 'task-123' });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Netvarkinga virtuvė',
        description: 'Ant stalo palikti indai.',
        difficulty_score: 7,
        group_id: 'group-abc',
        creator_id: 'test-user-id',
      }),
    );
  });

  it('turėtų atmesti kai trūksta pavadinimo', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({ ...validBody, title: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Pavadinimas');
  });

  it('turėtų atmesti kai trūksta aprašymo', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({ ...validBody, description: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Aprašymas');
  });

  it('turėtų atmesti netinkamą bettingIndex', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send({ ...validBody, bettingIndex: 15 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('indeksas');
  });

  it('turėtų atmesti be autorizacijos', async () => {
    const response = await request(app).post('/api/tasks').send(validBody);

    expect(response.status).toBe(401);
  });
});
