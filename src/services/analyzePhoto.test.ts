jest.mock('../lib/logger', () => {
  const mock = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
  return { __esModule: true, default: mock };
});

const mockCreate = jest.fn();

jest.mock('../lib/openai', () => ({
  getOpenAI: () => ({
    chat: {
      completions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    },
  }),
}));

import { analyzePhoto } from './analyzePhoto';

function streamFor(content: string) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content } }] };
    },
  };
}

describe('analyzePhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const fakeBuffer = Buffer.from('fake-image-data');

  it('turėtų grąžinti analizės rezultatą', async () => {
    mockCreate.mockResolvedValue(
      streamFor(
        JSON.stringify({
          verdict: 'mess',
          title: 'Netvarkinga virtuvė',
          description: 'Ant stalo palikti nešvarūs indai.',
          bettingIndex: 7,
        }),
      ),
    );

    const result = await analyzePhoto(fakeBuffer, 'image/jpeg');

    expect(result.verdict).toBe('mess');
    expect(result.title).toBe('Netvarkinga virtuvė');
    expect(result.bettingIndex).toBe(7);
  });

  it("turėtų surinkti atsakymą iš kelių chunk'ų", async () => {
    const json = JSON.stringify({
      verdict: 'clean',
      title: 'Švaru',
      description: 'Viskas tvarkinga.',
      bettingIndex: 1,
    });
    const mid = Math.floor(json.length / 2);
    const multiChunkStream = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: json.slice(0, mid) } }] };
        yield { choices: [{ delta: { content: json.slice(mid) } }] };
      },
    };
    mockCreate.mockResolvedValue(multiChunkStream);

    const result = await analyzePhoto(fakeBuffer, 'image/jpeg');

    expect(result.verdict).toBe('clean');
    expect(result.title).toBe('Švaru');
  });

  it('turėtų mesti klaidą kai OpenAI negrąžina atsakymo', async () => {
    mockCreate.mockResolvedValue(streamFor(''));

    await expect(analyzePhoto(fakeBuffer, 'image/jpeg')).rejects.toThrow(
      'OpenAI negrąžino atsakymo',
    );
  });

  it('turėtų mesti klaidą kai trūksta laukų', async () => {
    mockCreate.mockResolvedValue(
      streamFor(JSON.stringify({ verdict: 'mess' })),
    );

    await expect(analyzePhoto(fakeBuffer, 'image/jpeg')).rejects.toThrow(
      'trūksta privalomų laukų',
    );
  });

  it('turėtų apriboti bettingIndex nuo 1 iki 10', async () => {
    mockCreate.mockResolvedValue(
      streamFor(
        JSON.stringify({
          verdict: 'mess',
          title: 'Test',
          description: 'Test desc',
          bettingIndex: 15,
        }),
      ),
    );

    const result = await analyzePhoto(fakeBuffer, 'image/jpeg');
    expect(result.bettingIndex).toBe(10);
  });

  it('turėtų naudoti json_object response formatą ir streaming', async () => {
    mockCreate.mockResolvedValue(
      streamFor(
        JSON.stringify({
          verdict: 'clean',
          title: 'Švaru',
          description: 'Viskas tvarkinga.',
          bettingIndex: 1,
        }),
      ),
    );

    await analyzePhoto(fakeBuffer, 'image/jpeg');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        stream: true,
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("turėtų mesti AI_TIMEOUT kai pirmas chunk'as neatsako per 20s", async () => {
    jest.useFakeTimers();

    mockCreate.mockImplementation(
      (_args: unknown, opts: { signal: AbortSignal }) => {
        const signal = opts.signal;
        return Promise.resolve({
          [Symbol.asyncIterator]() {
            return {
              next() {
                return new Promise((_resolve, reject) => {
                  signal.addEventListener('abort', () => {
                    const err = new Error('Request was aborted.');
                    err.name = 'APIUserAbortError';
                    reject(err);
                  });
                });
              },
            };
          },
        });
      },
    );

    const promise = analyzePhoto(fakeBuffer, 'image/jpeg');
    const expectation = expect(promise).rejects.toThrow('AI_TIMEOUT');
    await jest.advanceTimersByTimeAsync(20000);
    await expectation;

    jest.useRealTimers();
  });

  it("turėtų mesti AI_TIMEOUT kai stream'as užstringa po pirmo chunk'o (5s idle)", async () => {
    jest.useFakeTimers();

    mockCreate.mockImplementation(
      (_args: unknown, opts: { signal: AbortSignal }) => {
        const signal = opts.signal;
        let yieldedFirst = false;
        return Promise.resolve({
          [Symbol.asyncIterator]() {
            return {
              next() {
                if (!yieldedFirst) {
                  yieldedFirst = true;
                  return Promise.resolve({
                    value: { choices: [{ delta: { content: '{' } }] },
                    done: false,
                  });
                }
                return new Promise((_resolve, reject) => {
                  signal.addEventListener('abort', () => {
                    const err = new Error('Request was aborted.');
                    err.name = 'APIUserAbortError';
                    reject(err);
                  });
                });
              },
            };
          },
        });
      },
    );

    const promise = analyzePhoto(fakeBuffer, 'image/jpeg');
    const expectation = expect(promise).rejects.toThrow('AI_TIMEOUT');
    await jest.advanceTimersByTimeAsync(5000);
    await expectation;

    jest.useRealTimers();
  });
});
