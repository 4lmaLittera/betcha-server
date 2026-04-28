-- Idempotentinė migracija: saugiai prideda/užtikrina total_points_collected stulpelį
DO $$
BEGIN
  -- Jei stulpelio nėra – pridedame jį (be NOT NULL, kad galėtume užpildyti reikšmes)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'total_points_collected'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN total_points_collected integer;
  END IF;

  -- Užtikriname numatytąją reikšmę
  ALTER TABLE public.profiles
    ALTER COLUMN total_points_collected SET DEFAULT 0;

  -- Užpildome galimas NULL reikšmes
  UPDATE public.profiles
  SET total_points_collected = 0
  WHERE total_points_collected IS NULL;

  -- Užtikriname NOT NULL po užpildymo
  ALTER TABLE public.profiles
    ALTER COLUMN total_points_collected SET NOT NULL;
END $$;

-- Aprašymas (saugus vykdyti pakartotinai)
COMMENT ON COLUMN public.profiles.total_points_collected IS 'Visas per laiką surinktas taškų kiekis (nepriklausomai nuo išlaidų)';
