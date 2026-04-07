jest.mock('../lib/logger', () => {
  const mock = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { __esModule: true, default: mock };
});

const mockCreate = jest.fn();

jest.mock('../lib/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    },
  },
}));

import { analyzePhoto } from './analyzePhoto';

describe('analyzePhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const fakeBuffer = Buffer.from('fake-image-data');

  it('turėtų grąžinti analizės rezultatą', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              verdict: 'mess',
              title: 'Netvarkinga virtuvė',
              description: 'Ant stalo palikti nešvarūs indai.',
              bettingIndex: 7,
            }),
          },
        },
      ],
    });

    const result = await analyzePhoto(fakeBuffer, 'image/jpeg');

    expect(result.verdict).toBe('mess');
    expect(result.title).toBe('Netvarkinga virtuvė');
    expect(result.bettingIndex).toBe(7);
  });

  it('turėtų mesti klaidą kai OpenAI negrąžina atsakymo', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    await expect(analyzePhoto(fakeBuffer, 'image/jpeg')).rejects.toThrow(
      'OpenAI negrąžino atsakymo',
    );
  });

  it('turėtų mesti klaidą kai trūksta laukų', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ verdict: 'mess' }),
          },
        },
      ],
    });

    await expect(analyzePhoto(fakeBuffer, 'image/jpeg')).rejects.toThrow(
      'trūksta privalomų laukų',
    );
  });

  it('turėtų apriboti bettingIndex nuo 1 iki 10', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              verdict: 'mess',
              title: 'Test',
              description: 'Test desc',
              bettingIndex: 15,
            }),
          },
        },
      ],
    });

    const result = await analyzePhoto(fakeBuffer, 'image/jpeg');
    expect(result.bettingIndex).toBe(10);
  });

  it('turėtų naudoti json_object response formatą', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              verdict: 'clean',
              title: 'Švaru',
              description: 'Viskas tvarkinga.',
              bettingIndex: 1,
            }),
          },
        },
      ],
    });

    await analyzePhoto(fakeBuffer, 'image/jpeg');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
      }),
    );
  });
});
