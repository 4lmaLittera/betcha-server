-- Ensure current store items set is recreated as active without hard deletes.
-- Keeps previously purchased items safe even if they are no longer sold.

DO $$
BEGIN
  -- 1) Praleisti užduotį
  UPDATE public.store_items
     SET description = 'Leidžia praleisti einamą užduotį be baudos',
         price = 200,
         is_active = true
   WHERE name = 'Praleisti užduotį';
  IF NOT FOUND THEN
    INSERT INTO public.store_items (name, description, price, is_active)
    VALUES ('Praleisti užduotį', 'Leidžia praleisti einamą užduotį be baudos', 200, true);
  END IF;

  -- 2) Laisva diena
  UPDATE public.store_items
     SET description = 'Vienos dienos atostogos nuo užduočių',
         price = 500,
         is_active = true
   WHERE name = 'Laisva diena';
  IF NOT FOUND THEN
    INSERT INTO public.store_items (name, description, price, is_active)
    VALUES ('Laisva diena', 'Vienos dienos atostogos nuo užduočių', 500, true);
  END IF;

  -- 3) XP boost 24 h
  UPDATE public.store_items
     SET description = 'Dvigubas XP 24 valandoms',
         price = 300,
         is_active = true
   WHERE name = 'XP boost 24 h';
  IF NOT FOUND THEN
    INSERT INTO public.store_items (name, description, price, is_active)
    VALUES ('XP boost 24 h', 'Dvigubas XP 24 valandoms', 300, true);
  END IF;

  -- 4) Visi kiti item'ai paliekami DB, bet neberodomi store
  UPDATE public.store_items
     SET is_active = false
   WHERE name NOT IN ('Praleisti užduotį', 'Laisva diena', 'XP boost 24 h');
END $$;
