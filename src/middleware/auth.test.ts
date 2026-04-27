import { Response, NextFunction } from 'express';
import { requireAuth, AuthenticatedRequest } from './auth';

const mockGetUser = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: (token: string) => mockGetUser(token),
    },
  },
}));

jest.mock('../lib/logger', () => ({
  warn: jest.fn(),
}));

function createMockReq(
  headers: Record<string, string> = {},
): AuthenticatedRequest {
  return { headers } as AuthenticatedRequest;
}

function createMockRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('requireAuth middleware', () => {
  const next: NextFunction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('grąžina 401 kai nėra Authorization header', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Trūksta autorizacijos antraštės',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('grąžina 401 kai Authorization header neturi Bearer prefikso', async () => {
    const req = createMockReq({ authorization: 'Basic abc123' });
    const res = createMockRes();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('grąžina 401 kai tokenas negalioja', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });
    const req = createMockReq({ authorization: 'Bearer invalid-token' });
    const res = createMockRes();

    await requireAuth(req, res, next);

    expect(mockGetUser).toHaveBeenCalledWith('invalid-token');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Neteisingas arba pasibaigęs tokenas',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('iškviečia next() ir priskiria user kai tokenas galioja', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123', email: 'test@test.com' } },
      error: null,
    });
    const req = createMockReq({ authorization: 'Bearer valid-token' });
    const res = createMockRes();

    await requireAuth(req, res, next);

    expect(mockGetUser).toHaveBeenCalledWith('valid-token');
    expect(req.user).toEqual({ id: 'user-123', email: 'test@test.com' });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('grąžina 401 kai getUser grąžina null user be klaidos', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const req = createMockReq({ authorization: 'Bearer some-token' });
    const res = createMockRes();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
