-- Įjungiame Row Level Security profilių lentelei
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Vartotojas gali skaityti savo profilį
CREATE POLICY "Vartotojas gali skaityti savo profilį"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Vartotojas gali atnaujinti savo profilį
CREATE POLICY "Vartotojas gali atnaujinti savo profilį"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Vartotojai gali matyti kitų profilius (tik skaitymas)
CREATE POLICY "Visi gali skaityti profilius"
  ON public.profiles FOR SELECT
  USING (true);
