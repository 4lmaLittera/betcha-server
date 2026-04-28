create table "public"."bets" (
  "id" uuid not null default gen_random_uuid(),
  "quest_id" uuid not null,
  "profile_id" uuid not null,
  "amount" integer not null,
  "prediction_is_positive" boolean not null,
  "coefficient" real not null,
  "status" text not null default 'pending'::text,
  "created_at" timestamp with time zone not null default now()
);

CREATE UNIQUE INDEX bets_pkey ON public.bets USING btree (id);

alter table "public"."bets" add constraint "bets_pkey" PRIMARY KEY using index "bets_pkey";

alter table "public"."bets" add constraint "bets_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."bets" validate constraint "bets_profile_id_fkey";

alter table "public"."bets" add constraint "bets_quest_id_fkey" FOREIGN KEY (quest_id) REFERENCES public.quests(id) ON DELETE CASCADE not valid;

alter table "public"."bets" validate constraint "bets_quest_id_fkey";

grant delete on table "public"."bets" to "anon";
grant insert on table "public"."bets" to "anon";
grant references on table "public"."bets" to "anon";
grant select on table "public"."bets" to "anon";
grant trigger on table "public"."bets" to "anon";
grant truncate on table "public"."bets" to "anon";
grant update on table "public"."bets" to "anon";

grant delete on table "public"."bets" to "authenticated";
grant insert on table "public"."bets" to "authenticated";
grant references on table "public"."bets" to "authenticated";
grant select on table "public"."bets" to "authenticated";
grant trigger on table "public"."bets" to "authenticated";
grant truncate on table "public"."bets" to "authenticated";
grant update on table "public"."bets" to "authenticated";

grant delete on table "public"."bets" to "service_role";
grant insert on table "public"."bets" to "service_role";
grant references on table "public"."bets" to "service_role";
grant select on table "public"."bets" to "service_role";
grant trigger on table "public"."bets" to "service_role";
grant truncate on table "public"."bets" to "service_role";
grant update on table "public"."bets" to "service_role";
