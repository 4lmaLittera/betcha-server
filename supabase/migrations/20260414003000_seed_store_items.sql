-- Seed shop items (id auto-generated). Inserts only if items with the same name don't exist yet.
-- Safe to run multiple times.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM store_items WHERE name = 'Praleisti užduotį') THEN
    INSERT INTO store_items (name, description, price)
    VALUES ('Praleisti užduotį', 'Leidžia praleisti einamą užduotį be baudos', 200);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM store_items WHERE name = 'Laisva diena') THEN
    INSERT INTO store_items (name, description, price)
    VALUES ('Laisva diena', 'Vienos dienos atostogos nuo užduočių', 500);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM store_items WHERE name = 'XP boost 24 h') THEN
    INSERT INTO store_items (name, description, price)
    VALUES ('XP boost 24 h', 'Dvigubas XP 24 valandoms', 300);
  END IF;
END $$;
