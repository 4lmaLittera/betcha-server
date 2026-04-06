create table "public"."groups" (
  "id" uuid not null default gen_random_uuid(),
  "name" text not null,
  "invite_code" text not null,
  "created_by_id" uuid not null,
  "created_at" timestamp with time zone not null default now()
);

CREATE UNIQUE INDEX groups_pkey ON public.groups USING btree (id);
CREATE UNIQUE INDEX groups_invite_code_key ON public.groups USING btree (invite_code);

alter table "public"."groups" add constraint "groups_pkey" PRIMARY KEY using index "groups_pkey";

alter table "public"."groups" add constraint "groups_created_by_id_fkey" FOREIGN KEY (created_by_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."groups" validate constraint "groups_created_by_id_fkey";

alter table "public"."groups" add constraint "groups_invite_code_key" UNIQUE using index "groups_invite_code_key";

grant delete on table "public"."groups" to "anon";
grant insert on table "public"."groups" to "anon";
grant references on table "public"."groups" to "anon";
grant select on table "public"."groups" to "anon";
grant trigger on table "public"."groups" to "anon";
grant truncate on table "public"."groups" to "anon";
grant update on table "public"."groups" to "anon";

grant delete on table "public"."groups" to "authenticated";
grant insert on table "public"."groups" to "authenticated";
grant references on table "public"."groups" to "authenticated";
grant select on table "public"."groups" to "authenticated";
grant trigger on table "public"."groups" to "authenticated";
grant truncate on table "public"."groups" to "authenticated";
grant update on table "public"."groups" to "authenticated";

grant delete on table "public"."groups" to "service_role";
grant insert on table "public"."groups" to "service_role";
grant references on table "public"."groups" to "service_role";
grant select on table "public"."groups" to "service_role";
grant trigger on table "public"."groups" to "service_role";
grant truncate on table "public"."groups" to "service_role";
grant update on table "public"."groups" to "service_role";
