import request from 'supertest';

jest.mock('../lib/logger', () => {
  const mock = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { __esModule: true, default: mock };
});

const mockQuestMaybeSingle = jest.fn();
const mockMembershipMaybeSingle = jest.fn();
const mockUpdateEq = jest.fn();
const mockUpdate = jest.fn((payload: unknown) => {
  void payload;
  return { eq: (..._args: unknown[]) => mockUpdateEq(..._args) };
});

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
          update: mockUpdate,
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
  },
}));

jest.mock('../lib/openai', () => ({
  getOpenAI: () => ({}),
}));

import app from '../app';

describe('PATCH /api/tasks/:taskId/assign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateEq.mockResolvedValue({ data: null, error: null });
  });

  const validBody = { assignedTo: 'assignee-id' };

  const openQuest = {
    id: 'quest-1',
    group_id: 'group-1',
    creator_id: 'requester-id',
    status: 'open',
  };

  it('turėtų leisti kūrėjui priskirti grupės narį', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: openQuest, error: null });
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { profile_id: 'assignee-id' },
      error: null,
    });

    const response = await request(app)
      .patch('/api/tasks/quest-1/assign')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'quest-1', assignedTo: 'assignee-id' });
    expect(mockUpdate).toHaveBeenCalledWith({ assigned_to: 'assignee-id' });
  });

  it('turėtų leisti grupės adminui priskirti net jei nėra kūrėjas', async () => {
    mockQuestMaybeSingle.mockResolvedValue({
      data: { ...openQuest, creator_id: 'other-creator' },
      error: null,
    });
    mockMembershipMaybeSingle
      .mockResolvedValueOnce({ data: { role: 'admin' }, error: null })
      .mockResolvedValueOnce({
        data: { profile_id: 'assignee-id' },
        error: null,
      });

    const response = await request(app)
      .patch('/api/tasks/quest-1/assign')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(200);
  });

  it('turėtų grąžinti 403 kai vartotojas nėra nei kūrėjas, nei adminas', async () => {
    mockQuestMaybeSingle.mockResolvedValue({
      data: { ...openQuest, creator_id: 'other-creator' },
      error: null,
    });
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { role: 'member' },
      error: null,
    });

    const response = await request(app)
      .patch('/api/tasks/quest-1/assign')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Neturite teisės');
  });

  it('turėtų grąžinti 400 kai assignedTo yra tuščias', async () => {
    const response = await request(app)
      .patch('/api/tasks/quest-1/assign')
      .set('Authorization', 'Bearer valid-token')
      .send({ assignedTo: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('assignedTo');
  });

  it('turėtų grąžinti 404 kai užduotis nerasta', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await request(app)
      .patch('/api/tasks/missing/assign')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(404);
  });

  it('turėtų grąžinti 400 kai užduotis ne open būsenoje', async () => {
    mockQuestMaybeSingle.mockResolvedValue({
      data: { ...openQuest, status: 'completed' },
      error: null,
    });

    const response = await request(app)
      .patch('/api/tasks/quest-1/assign')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('atviras');
  });

  it('turėtų grąžinti 400 kai priskiriamas narys nėra grupėje', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: openQuest, error: null });
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const response = await request(app)
      .patch('/api/tasks/quest-1/assign')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('grupės narys');
  });

  it('turėtų grąžinti 401 be autorizacijos', async () => {
    const response = await request(app)
      .patch('/api/tasks/quest-1/assign')
      .send(validBody);

    expect(response.status).toBe(401);
  });

  it('turėtų grąžinti 500 kai DB klaida atnaujinant', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: openQuest, error: null });
    mockMembershipMaybeSingle.mockResolvedValueOnce({
      data: { profile_id: 'assignee-id' },
      error: null,
    });
    mockUpdateEq.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    });

    const response = await request(app)
      .patch('/api/tasks/quest-1/assign')
      .set('Authorization', 'Bearer valid-token')
      .send(validBody);

    expect(response.status).toBe(500);
  });
});
