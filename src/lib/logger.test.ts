describe('Logger', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('turėtų sukurti logger su numatytu info lygiu', async () => {
    const { default: logger } = await import('./logger');
    expect(logger).toBeDefined();
    expect(logger.level).toBe('info');
  });

  it('turėtų naudoti LOG_LEVEL iš aplinkos kintamųjų', async () => {
    process.env.LOG_LEVEL = 'debug';
    const { default: logger } = await import('./logger');
    expect(logger.level).toBe('debug');
  });
});
