create table "public"."quests" (
  "id" uuid not null default gen_random_uuid(),
  "group_id" uuid not null,
  "creator_id" uuid not null,
  "assigned_to" uuid,
  "title" text not null,
  "status" text not null default 'open'::text,
  "initial_image_url" text,
  "evidence_image_url" text,
  "difficulty_score" real,
  "ai_verdict_reason" text,
  "created_at" timestamp with time zone not null default now(),
  "completed_at" timestamp with time zone
);

CREATE UNIQUE INDEX quests_pkey ON public.quests USING btree (id);

alter table "public"."quests" add constraint "quests_pkey" PRIMARY KEY using index "quests_pkey";

alter table "public"."quests" add constraint "quests_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."quests" validate constraint "quests_assigned_to_fkey";

alter table "public"."quests" add constraint "quests_creator_id_fkey" FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."quests" validate constraint "quests_creator_id_fkey";

alter table "public"."quests" add constraint "quests_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE not valid;

alter table "public"."quests" validate constraint "quests_group_id_fkey";

grant delete on table "public"."quests" to "anon";
grant insert on table "public"."quests" to "anon";
grant references on table "public"."quests" to "anon";
grant select on table "public"."quests" to "anon";
grant trigger on table "public"."quests" to "anon";
grant truncate on table "public"."quests" to "anon";
grant update on table "public"."quests" to "anon";

grant delete on table "public"."quests" to "authenticated";
grant insert on table "public"."quests" to "authenticated";
grant references on table "public"."quests" to "authenticated";
grant select on table "public"."quests" to "authenticated";
grant trigger on table "public"."quests" to "authenticated";
grant truncate on table "public"."quests" to "authenticated";
grant update on table "public"."quests" to "authenticated";

grant delete on table "public"."quests" to "service_role";
grant insert on table "public"."quests" to "service_role";
grant references on table "public"."quests" to "service_role";
grant select on table "public"."quests" to "service_role";
grant trigger on table "public"."quests" to "service_role";
grant truncate on table "public"."quests" to "service_role";
grant update on table "public"."quests" to "service_role";
