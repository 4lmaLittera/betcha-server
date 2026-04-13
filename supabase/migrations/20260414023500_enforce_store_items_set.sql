-- Enforce exact Shop items set (idempotent): keep only 3 required items
-- and update/insert them with desired descriptions and prices.
-- Safe to run multiple times.

DO $$
BEGIN
  -- 1) Praleisti užduotį
  UPDATE public.store_items
     SET description = 'Leidžia praleisti einamą užduotį be baudos',
         price = 200
   WHERE name = 'Praleisti užduotį';
  IF NOT FOUND THEN
    INSERT INTO public.store_items (name, description, price)
    VALUES ('Praleisti užduotį', 'Leidžia praleisti einamą užduotį be baudos', 200);
  END IF;

  -- 2) Laisva diena
  UPDATE public.store_items
     SET description = 'Vienos dienos atostogos nuo užduočių',
         price = 500
   WHERE name = 'Laisva diena';
  IF NOT FOUND THEN
    INSERT INTO public.store_items (name, description, price)
    VALUES ('Laisva diena', 'Vienos dienos atostogos nuo užduočių', 500);
  END IF;

  -- 3) XP boost 24 h
  UPDATE public.store_items
     SET description = 'Dvigubas XP 24 valandoms',
         price = 300
   WHERE name = 'XP boost 24 h';
  IF NOT FOUND THEN
    INSERT INTO public.store_items (name, description, price)
    VALUES ('XP boost 24 h', 'Dvigubas XP 24 valandoms', 300);
  END IF;

  -- 4) Pašaliname visus kitus įrašus, kurių neturi būti parduotuvėje
  DELETE FROM public.store_items
   WHERE name NOT IN ('Praleisti užduotį', 'Laisva diena', 'XP boost 24 h');
END $$;

COMMENT ON FUNCTION pg_catalog.pg_sleep IS NULL; -- no-op to keep file ending consistent
