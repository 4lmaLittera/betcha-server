-- Pridėti total_points stulpelį į profiles lentelę
alter table "public"."profiles" add column "total_points" integer not null default 0;

-- Komentaras: total_points bus naudojamas lygiui skaičiuoti, o balance - pirkimams.
