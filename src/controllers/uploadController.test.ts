import request from 'supertest';
import path from 'path';
import fs from 'fs';

jest.mock('../lib/logger', () => {
  const mock = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { __esModule: true, default: mock };
});

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@test.com' } },
        error: null,
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  },
}));

import app from '../app';

const FIXTURES_DIR = path.join(__dirname, '__fixtures__');
const JPEG_PATH = path.join(FIXTURES_DIR, 'test.jpg');
const PNG_PATH = path.join(FIXTURES_DIR, 'test.png');
const TXT_PATH = path.join(FIXTURES_DIR, 'test.txt');

beforeAll(() => {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  // Minimal valid JPEG (2x2 pixel)
  const jpegBuffer = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS' +
      'Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ' +
      'CQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
      'MjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEA' +
      'AAAAAAAAAAECAwQFBgcICQoL/8QAFRABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAA' +
      'AAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==',
    'base64',
  );
  fs.writeFileSync(JPEG_PATH, jpegBuffer);

  // Minimal valid PNG (1x1 pixel)
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  fs.writeFileSync(PNG_PATH, pngBuffer);

  fs.writeFileSync(TXT_PATH, 'this is not an image');
});

afterAll(() => {
  fs.rmSync(FIXTURES_DIR, { recursive: true, force: true });
});

describe('POST /api/upload', () => {
  it('turėtų priimti JPEG nuotrauką ir grąžinti uploadId', async () => {
    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', JPEG_PATH);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('uploadId');
    expect(typeof response.body.uploadId).toBe('string');
  });

  it('turėtų priimti PNG nuotrauką', async () => {
    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', PNG_PATH);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('uploadId');
  });

  it('turėtų atmesti užklausą be nuotraukos', async () => {
    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Nuotrauka yra privaloma');
  });

  it('turėtų atmesti netinkamą failo tipą', async () => {
    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', TXT_PATH);

    expect(response.status).toBe(415);
    expect(response.body.error).toContain('Netinkamas failo tipas');
  });

  it('turėtų atmesti užklausą be autorizacijos', async () => {
    const response = await request(app)
      .post('/api/upload')
      .attach('photo', JPEG_PATH);

    expect(response.status).toBe(401);
  });

  it('turėtų atmesti per didelį failą', async () => {
    const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
    const largePath = path.join(FIXTURES_DIR, 'large.jpg');
    fs.writeFileSync(largePath, largeBuffer);

    const response = await request(app)
      .post('/api/upload')
      .set('Authorization', 'Bearer valid-token')
      .attach('photo', largePath);

    expect(response.status).toBe(413);
    expect(response.body.error).toContain('per didelis');
  });
});
