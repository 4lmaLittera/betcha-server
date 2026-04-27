import request from 'supertest';

jest.mock('../lib/logger', () => {
  const mock = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { __esModule: true, default: mock };
});

const mockUploadToStorage = jest.fn();
jest.mock('../services/storage', () => ({
  uploadToStorage: (...args: unknown[]) => mockUploadToStorage(...args),
}));

const mockEvaluateEvidence = jest.fn();
jest.mock('../services/evidenceVerdict', () => ({
  evaluateEvidence: (...args: unknown[]) => mockEvaluateEvidence(...args),
}));

const mockQuestMaybeSingle = jest.fn();
const mockQuestUpdateEq = jest.fn();
const mockQuestUpdate = jest.fn(() => ({
  eq: (..._args: unknown[]) => mockQuestUpdateEq(..._args),
}));
const mockRpc = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'assignee-id', email: 'assignee@test.com' } },
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
          update: mockQuestUpdate,
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

describe('POST /api/tasks/:taskId/evidence', () => {
  const fakeJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);

  const openQuest = {
    id: 'quest-1',
    title: 'Išplauti indus',
    description: 'Kriauklėje yra nešvarių indų',
    status: 'open',
    assigned_to: 'assignee-id',
    initial_image_url: 'https://example.com/initial.jpg',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuestUpdateEq.mockResolvedValue({ data: null, error: null });
    mockUploadToStorage.mockResolvedValue('https://example.com/evidence.jpg');
    mockRpc.mockResolvedValue({
      data: { success: true, quest_id: 'quest-1', resolution: true },
      error: null,
    });
  });

  it('approved → kviečia resolve_quest ir grąžina status completed', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: openQuest, error: null });
    mockEvaluateEvidence.mockResolvedValue({
      verdict: 'approved',
      reason: 'Indai išplauti, kriauklė švari',
    });

    const response = await request(app)
      .post('/api/tasks/quest-1/evidence')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', fakeJpeg, {
        filename: 'evidence.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      verdict: 'approved',
      reason: 'Indai išplauti, kriauklė švari',
      status: 'completed',
    });
    expect(mockUploadToStorage).toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith('resolve_quest', {
      p_quest_id: 'quest-1',
      p_resolution_is_positive: true,
    });
  });

  it('rejected → quest lieka open, ai_verdict_reason užpildytas', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: openQuest, error: null });
    mockEvaluateEvidence.mockResolvedValue({
      verdict: 'rejected',
      reason: 'Kriauklėje vis dar matomi nešvarūs indai',
    });

    const response = await request(app)
      .post('/api/tasks/quest-1/evidence')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', fakeJpeg, {
        filename: 'evidence.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      verdict: 'rejected',
      reason: 'Kriauklėje vis dar matomi nešvarūs indai',
      status: 'open',
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockQuestUpdate).toHaveBeenCalledWith({
      ai_verdict_reason: 'Kriauklėje vis dar matomi nešvarūs indai',
    });
  });

  it('unclear → 502 + status open', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: openQuest, error: null });
    mockEvaluateEvidence.mockResolvedValue({
      verdict: 'unclear',
      reason: 'Nuotrauka per tamsi',
    });

    const response = await request(app)
      .post('/api/tasks/quest-1/evidence')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', fakeJpeg, {
        filename: 'evidence.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(502);
    expect(response.body.verdict).toBe('unclear');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('AI klaida → 502 unclear', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: openQuest, error: null });
    mockEvaluateEvidence.mockRejectedValue(new Error('AI_TIMEOUT'));

    const response = await request(app)
      .post('/api/tasks/quest-1/evidence')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', fakeJpeg, {
        filename: 'evidence.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(502);
    expect(response.body.verdict).toBe('unclear');
  });

  it('403 — kai vartotojas ne assigned_to', async () => {
    mockQuestMaybeSingle.mockResolvedValue({
      data: { ...openQuest, assigned_to: 'other-user' },
      error: null,
    });

    const response = await request(app)
      .post('/api/tasks/quest-1/evidence')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', fakeJpeg, {
        filename: 'evidence.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(403);
    expect(mockUploadToStorage).not.toHaveBeenCalled();
  });

  it('409 — kai užduotis ne open būsenoje', async () => {
    mockQuestMaybeSingle.mockResolvedValue({
      data: { ...openQuest, status: 'completed' },
      error: null,
    });

    const response = await request(app)
      .post('/api/tasks/quest-1/evidence')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', fakeJpeg, {
        filename: 'evidence.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(409);
    expect(mockUploadToStorage).not.toHaveBeenCalled();
  });

  it('422 — kai nėra initial_image_url', async () => {
    mockQuestMaybeSingle.mockResolvedValue({
      data: { ...openQuest, initial_image_url: null },
      error: null,
    });

    const response = await request(app)
      .post('/api/tasks/quest-1/evidence')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', fakeJpeg, {
        filename: 'evidence.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(422);
    expect(mockUploadToStorage).not.toHaveBeenCalled();
  });

  it('404 — kai užduotis nerasta', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await request(app)
      .post('/api/tasks/missing/evidence')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', fakeJpeg, {
        filename: 'evidence.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(404);
  });

  it('400 — kai nuotrauka neperduota', async () => {
    const response = await request(app)
      .post('/api/tasks/quest-1/evidence')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(400);
  });

  it('401 — be autorizacijos', async () => {
    const response = await request(app)
      .post('/api/tasks/quest-1/evidence')
      .attach('photo', fakeJpeg, {
        filename: 'evidence.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(401);
  });

  it('500 — kai upload nepavyksta', async () => {
    mockQuestMaybeSingle.mockResolvedValue({ data: openQuest, error: null });
    mockUploadToStorage.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/tasks/quest-1/evidence')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', fakeJpeg, {
        filename: 'evidence.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(500);
    expect(mockEvaluateEvidence).not.toHaveBeenCalled();
  });
});
