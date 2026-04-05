describe('Supabase klientas', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('turėtų mesti klaidą kai trūksta SUPABASE_URL', async () => {
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_KEY = 'test-key';

    await expect(() => import('./supabase')).rejects.toThrow(
      'Trūksta SUPABASE_URL arba SUPABASE_KEY',
    );
  });

  it('turėtų mesti klaidą kai trūksta SUPABASE_KEY', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = '';

    await expect(() => import('./supabase')).rejects.toThrow(
      'Trūksta SUPABASE_URL arba SUPABASE_KEY',
    );
  });

  it('turėtų sukurti klientą su teisingais kintamaisiais', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_KEY = 'test-key';

    const { supabase } = await import('./supabase');
    expect(supabase).toBeDefined();
  });
});
