import request from 'supertest';

jest.mock('../lib/logger', () => {
  const mock = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { __esModule: true, default: mock };
});

const mockMembershipMaybeSingle = jest.fn();
const mockOpenQuestsResult = jest.fn();
const mockResolvedQuestsResult = jest.fn();
const mockOpenCountResult = jest.fn();
const mockBetsResult = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'requester-id', email: 'requester@test.com' } },
        error: null,
      }),
    },
    from: (table: string) => {
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
      if (table === 'quests') {
        return {
          select: (
            _cols: string,
            opts?: { count?: string; head?: boolean },
          ) => {
            if (opts?.count === 'exact' && opts?.head === true) {
              return {
                eq: () => ({
                  eq: () => mockOpenCountResult(),
                }),
              };
            }
            return {
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => mockOpenQuestsResult(),
                  }),
                }),
                in: () => ({
                  order: () => ({
                    limit: () => mockResolvedQuestsResult(),
                  }),
                }),
              }),
            };
          },
        };
      }
      if (table === 'bets') {
        return {
          select: () => ({
            in: () => ({
              eq: () => mockBetsResult(),
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

describe('GET /api/groups/:id/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMembershipMaybeSingle.mockResolvedValue({
      data: { id: 'mem-1' },
      error: null,
    });
    mockOpenQuestsResult.mockResolvedValue({ data: [], error: null });
    mockResolvedQuestsResult.mockResolvedValue({ data: [], error: null });
    mockOpenCountResult.mockResolvedValue({ count: 0, error: null });
    mockBetsResult.mockResolvedValue({ data: [], error: null });
  });

  it('200 — narys gauna pilną statistiką', async () => {
    mockOpenQuestsResult.mockResolvedValue({
      data: [
        {
          id: 'q1',
          title: 'Išplauti indus',
          status: 'open',
          difficulty_score: 5,
          created_at: '2026-04-20T12:00:00Z',
          assigned: { id: 'u2', username: 'Tomas' },
        },
        {
          id: 'q2',
          title: 'Išnešti šiukšles',
          status: 'open',
          difficulty_score: 3,
          created_at: '2026-04-19T12:00:00Z',
          assigned: null,
        },
      ],
      error: null,
    });
    mockResolvedQuestsResult.mockResolvedValue({
      data: [
        {
          id: 'q3',
          title: 'Susitvarkyti stalą',
          status: 'completed',
          completed_at: '2026-04-18T12:00:00Z',
        },
      ],
      error: null,
    });
    mockOpenCountResult.mockResolvedValue({ count: 2, error: null });
    mockBetsResult.mockResolvedValue({
      data: [{ amount: 50 }, { amount: 30 }, { amount: 20 }],
      error: null,
    });

    const response = await request(app)
      .get('/api/groups/group-1/stats')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      openQuests: [
        {
          id: 'q1',
          title: 'Išplauti indus',
          status: 'open',
          difficultyScore: 5,
          assignedTo: { id: 'u2', username: 'Tomas' },
          createdAt: '2026-04-20T12:00:00Z',
        },
        {
          id: 'q2',
          title: 'Išnešti šiukšles',
          status: 'open',
          difficultyScore: 3,
          assignedTo: null,
          createdAt: '2026-04-19T12:00:00Z',
        },
      ],
      openCount: 2,
      recentResolved: [
        {
          id: 'q3',
          title: 'Susitvarkyti stalą',
          status: 'completed',
          completedAt: '2026-04-18T12:00:00Z',
        },
      ],
      totalPrizePool: 100,
    });
  });

  it('200 — tuščia grupė grąžina nulinius arrays + 0', async () => {
    const response = await request(app)
      .get('/api/groups/group-1/stats')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      openQuests: [],
      openCount: 0,
      recentResolved: [],
      totalPrizePool: 0,
    });
    expect(mockBetsResult).not.toHaveBeenCalled();
  });

  it('403 — kai vartotojas ne grupės narys', async () => {
    mockMembershipMaybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await request(app)
      .get('/api/groups/group-1/stats')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(403);
    expect(mockOpenQuestsResult).not.toHaveBeenCalled();
  });

  it('401 — be autorizacijos', async () => {
    const response = await request(app).get('/api/groups/group-1/stats');
    expect(response.status).toBe(401);
  });

  it('500 — kai narystės užklausa klysta', async () => {
    mockMembershipMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'DB error' },
    });

    const response = await request(app)
      .get('/api/groups/group-1/stats')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(500);
  });
});
