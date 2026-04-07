alter table "public"."profiles" add column "total_points_collected" integer not null default 0;

comment on column "public"."profiles"."total_points_collected" is 'Visas per laika surinktas tašku kiekis (nepriklausomai nuo išlaidu)';


alter table "public"."profiles" add column "total_points_collected" integer not null default 0;

comment on column "public"."profiles"."total_points_collected" is 'Visas per laiką surinktas taškų kiekis (nepriklausomai nuo išlaidų)';
