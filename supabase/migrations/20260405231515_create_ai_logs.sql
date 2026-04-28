create table "public"."ai_logs" (
  "id" uuid not null default gen_random_uuid(),
  "quest_id" uuid,
  "status" text not null,
  "error_reason" text,
  "created_at" timestamp with time zone not null default now()
);

CREATE UNIQUE INDEX ai_logs_pkey ON public.ai_logs USING btree (id);

alter table "public"."ai_logs" add constraint "ai_logs_pkey" PRIMARY KEY using index "ai_logs_pkey";

alter table "public"."ai_logs" add constraint "ai_logs_quest_id_fkey" FOREIGN KEY (quest_id) REFERENCES public.quests(id) ON DELETE SET NULL not valid;

alter table "public"."ai_logs" validate constraint "ai_logs_quest_id_fkey";

grant delete on table "public"."ai_logs" to "anon";
grant insert on table "public"."ai_logs" to "anon";
grant references on table "public"."ai_logs" to "anon";
grant select on table "public"."ai_logs" to "anon";
grant trigger on table "public"."ai_logs" to "anon";
grant truncate on table "public"."ai_logs" to "anon";
grant update on table "public"."ai_logs" to "anon";

grant delete on table "public"."ai_logs" to "authenticated";
grant insert on table "public"."ai_logs" to "authenticated";
grant references on table "public"."ai_logs" to "authenticated";
grant select on table "public"."ai_logs" to "authenticated";
grant trigger on table "public"."ai_logs" to "authenticated";
grant truncate on table "public"."ai_logs" to "authenticated";
grant update on table "public"."ai_logs" to "authenticated";

grant delete on table "public"."ai_logs" to "service_role";
grant insert on table "public"."ai_logs" to "service_role";
grant references on table "public"."ai_logs" to "service_role";
grant select on table "public"."ai_logs" to "service_role";
grant trigger on table "public"."ai_logs" to "service_role";
grant truncate on table "public"."ai_logs" to "service_role";
grant update on table "public"."ai_logs" to "service_role";
