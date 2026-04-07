jest.mock('../lib/logger', () => {
  const mock = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { __esModule: true, default: mock };
});

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  },
}));

import { uploadToStorage } from './storage';

describe('uploadToStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const fakeBuffer = Buffer.from('fake-image');

  it('turėtų įkelti nuotrauką ir grąžinti URL', async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://storage.example.com/photos/uploads/abc.jpg' },
    });

    const url = await uploadToStorage(fakeBuffer, 'image/jpeg', 'abc');

    expect(url).toBe('https://storage.example.com/photos/uploads/abc.jpg');
    expect(mockUpload).toHaveBeenCalledWith(
      'uploads/abc.jpg',
      fakeBuffer,
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
  });

  it('turėtų naudoti .png plėtinį PNG nuotraukoms', async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://storage.example.com/photos/uploads/abc.png' },
    });

    await uploadToStorage(fakeBuffer, 'image/png', 'abc');

    expect(mockUpload).toHaveBeenCalledWith(
      'uploads/abc.png',
      fakeBuffer,
      expect.objectContaining({ contentType: 'image/png' }),
    );
  });

  it('turėtų grąžinti null kai įkėlimas nepavyksta', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Storage error' } });

    const url = await uploadToStorage(fakeBuffer, 'image/jpeg', 'abc');

    expect(url).toBeNull();
  });
});
