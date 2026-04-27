import request from 'supertest';

jest.mock('../lib/logger', () => {
  const mock = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { __esModule: true, default: mock };
});

const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockQuestMaybeSingle = jest.fn();
const mockBetsResult = jest.fn();
const mockGroupMembersSelect = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@test.com' } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'quests') {
        return {
          insert: (...args: unknown[]) => {
            mockInsert(...args);
            return {
              select: (...sArgs: unknown[]) => {
                mockSelect(...sArgs);
                return { single: mockSingle };
              },
            };
          },
          select: () => ({
            eq: () => ({
              maybeSingle: () => mockQuestMaybeSingle(),
            }),
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === 'bets') {
        return {
          select: () => ({
            eq: () => mockBetsResult(),
          }),
        };
      }
      if (table === 'group_members') {
        return {
          select: () => ({
            eq: () => mockGroupMembersSelect(),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    },
  },
}));

jest.mock('../lib/openai', () => ({
  getOpenAI: () => ({}),
}));

import app from '../app';

describe('POST /api/tasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGroupMembersSelect.mockResolvedValue({
      data: [{ profile_id: 'test-user-id' }],
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: { id: 'task-123', assigned_to: 'test-user-id' },
      error: null,
    });
  });

  const validBody = {
    title: 'Netvarkinga virtuvė',
    description: 'Ant stalo palikti indai.',
    bettingIndex: 7,
    groupId: 'group-abc',
  };

  it('turėtų sukurti užduotį ir grąžinti ID su assignedTo', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 'task-123', assignedTo: 'test-user-id' });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Netvarkinga virtuvė',
        description: 'Ant stalo palikti indai.',
        difficulty_score: 7,
        group_id: 'group-abc',
        creator_id: 'test-user-id',
        assigned_to: 'test-user-id',
      }),
    );
  });

  it('turėtų automatiškai priskirti atsitiktiniam ne-creator nariui', async () => {
    mockGroupMembersSelect.mockResolvedValue({
      data: [
        { profile_id: 'test-user-id' },
        { profile_id: 'member-1' },
        { profile_id: 'member-2' },
      ],
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: { id: 'task-123', assigned_to: 'member-1' },
      error: null,
    });
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body.assignedTo).toBe('member-1');
    const insertArg = mockInsert.mock.calls[0][0] as { assigned_to: string };
    expect(['member-1', 'member-2']).toContain(insertArg.assigned_to);
    expect(insertArg.assigned_to).not.toBe('test-user-id');

    randomSpy.mockRestore();
  });

  it('turėtų priskirti creator kai jis yra vienintelis grupės narys', async () => {
    mockGroupMembersSelect.mockResolvedValue({
      data: [{ profile_id: 'test-user-id' }],
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: { id: 'task-123', assigned_to: 'test-user-id' },
      error: null,
    });

    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(201);
    expect(response.body.assignedTo).toBe('test-user-id');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ assigned_to: 'test-user-id' }),
    );
  });

  it('turėtų grąžinti 500 kai narių užklausa nepavyksta', async () => {
    mockGroupMembersSelect.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    });

    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(500);
    expect(response.body.error).toContain('grupės narių');
    expect(mockInsert).not.toHaveBeenCalled();
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

describe('GET /api/tasks/:taskId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const questRow = {
    id: 'task-123',
    group_id: 'group-abc',
    title: 'Netvarkinga virtuvė',
    description: 'Indai ant stalo',
    status: 'open',
    difficulty_score: 6,
    ai_verdict_reason: null,
    initial_image_url: 'https://example.com/initial.jpg',
    evidence_image_url: null,
    created_at: '2026-04-26T10:00:00Z',
    completed_at: null,
    creator: { id: 'creator-1', username: 'Tomas', avatar_url: null },
    assigned: { id: 'assignee-1', username: 'Petras', avatar_url: null },
  };

  it('turėtų grąžinti pilną užduoties informaciją su agreguotomis lažybomis', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: questRow, error: null });
    mockBetsResult.mockResolvedValue({
      data: [
        { amount: 50, prediction_is_positive: true },
        { amount: 30, prediction_is_positive: true },
        { amount: 20, prediction_is_positive: false },
      ],
      error: null,
    });

    const response = await request(app)
      .get('/api/tasks/task-123')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: 'task-123',
      groupId: 'group-abc',
      title: 'Netvarkinga virtuvė',
      description: 'Indai ant stalo',
      status: 'open',
      difficultyScore: 6,
      aiVerdictReason: null,
      initialImageUrl: 'https://example.com/initial.jpg',
      evidenceImageUrl: null,
      createdAt: '2026-04-26T10:00:00Z',
      completedAt: null,
      creator: { id: 'creator-1', username: 'Tomas', avatar_url: null },
      assignedTo: { id: 'assignee-1', username: 'Petras', avatar_url: null },
      bets: { totalPool: 100, forCount: 2, againstCount: 1 },
    });
  });

  it('turėtų grąžinti 404 kai užduotis nerasta', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await request(app)
      .get('/api/tasks/missing-id')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(404);
    expect(response.body.error).toContain('nerasta');
  });

  it('turėtų grąžinti tuščią lažybų agregaciją kai nėra statymų', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: questRow, error: null });
    mockBetsResult.mockResolvedValue({ data: [], error: null });

    const response = await request(app)
      .get('/api/tasks/task-123')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.bets).toEqual({ totalPool: 0, forCount: 0, againstCount: 0 });
  });

  it('turėtų grąžinti assignedTo null kai užduotis nepriskirta', async () => {
    mockQuestMaybeSingle.mockResolvedValue({
      data: { ...questRow, assigned: null },
      error: null,
    });
    mockBetsResult.mockResolvedValue({ data: [], error: null });

    const response = await request(app)
      .get('/api/tasks/task-123')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.assignedTo).toBeNull();
  });

  it('turėtų atmesti be autorizacijos', async () => {
    const response = await request(app).get('/api/tasks/task-123');
    expect(response.status).toBe(401);
  });

  it('turėtų grąžinti 500 kai DB klaida', async () => {
    mockQuestMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    });

    const response = await request(app)
      .get('/api/tasks/task-123')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(500);
  });
});
