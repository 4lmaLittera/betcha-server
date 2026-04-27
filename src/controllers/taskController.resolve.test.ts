import request from 'supertest';

jest.mock('../lib/logger', () => {
  const mock = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { __esModule: true, default: mock };
});

const mockQuestMaybeSingle = jest.fn();
const mockMembershipMaybeSingle = jest.fn();
const mockRpc = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'requester-id', email: 'requester@test.com' } },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === 'quests') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => mockQuestMaybeSingle(),
            }),
            limit: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      if (table === 'group_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => mockMembershipMaybeSingle(),
              }),
            }),
          }),
        };
      }
      return {
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

jest.mock('../lib/openai', () => ({
  getOpenAI: () => ({}),
}));

import app from '../app';

describe('POST /api/tasks/:taskId/resolve', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc.mockResolvedValue({
      data: { success: true, quest_id: 'quest-1', resolution: true },
      error: null,
    });
  });

  const validBody = { resolution_is_positive: true };

  const baseQuest = {
    id: 'quest-1',
    group_id: 'group-1',
    creator_id: 'requester-id',
  };

  it('turėtų leisti kūrėjui spręsti užduotį', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: baseQuest, error: null });

    const response = await request(app)
      .post('/api/tasks/quest-1/resolve')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, quest_id: 'quest-1', resolution: true });
    expect(mockRpc).toHaveBeenCalledWith('resolve_quest', {
      p_quest_id: 'quest-1',
      p_resolution_is_positive: true,
    });
  });

  it('turėtų leisti grupės adminui spręsti net jei nėra kūrėjas', async () => {
    mockQuestMaybeSingle.mockResolvedValue({
      data: { ...baseQuest, creator_id: 'other-creator' },
      error: null,
    });
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { role: 'admin' },
      error: null,
    });

    const response = await request(app)
      .post('/api/tasks/quest-1/resolve')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalled();
  });

  it('turėtų grąžinti 403 kai vartotojas nėra nei kūrėjas, nei adminas', async () => {
    mockQuestMaybeSingle.mockResolvedValue({
      data: { ...baseQuest, creator_id: 'other-creator' },
      error: null,
    });
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { role: 'member' },
      error: null,
    });

    const response = await request(app)
      .post('/api/tasks/quest-1/resolve')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Neturite teisės');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('turėtų grąžinti 403 kai vartotojas nėra grupės narys', async () => {
    mockQuestMaybeSingle.mockResolvedValue({
      data: { ...baseQuest, creator_id: 'other-creator' },
      error: null,
    });
    mockMembershipMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const response = await request(app)
      .post('/api/tasks/quest-1/resolve')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(403);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('turėtų grąžinti 404 kai užduotis nerasta', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await request(app)
      .post('/api/tasks/missing/resolve')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(404);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('turėtų grąžinti 400 kai resolution_is_positive ne boolean', async () => {
    const response = await request(app)
      .post('/api/tasks/quest-1/resolve')
      .set('Authorization', 'Bearer valid-token')
      .send({ resolution_is_positive: 'yes' });

    expect(response.status).toBe(400);
  });

  it('turėtų grąžinti 401 be autorizacijos', async () => {
    const response = await request(app)
      .post('/api/tasks/quest-1/resolve')
      .send(validBody);

    expect(response.status).toBe(401);
  });
});
