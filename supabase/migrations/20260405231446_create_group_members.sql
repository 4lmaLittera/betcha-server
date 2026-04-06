create table "public"."group_members" (
  "id" uuid not null default gen_random_uuid(),
  "group_id" uuid not null,
  "profile_id" uuid not null,
  "role" text not null default 'member'::text,
  "joined_at" timestamp with time zone not null default now()
);

CREATE UNIQUE INDEX group_members_pkey ON public.group_members USING btree (id);
CREATE UNIQUE INDEX group_members_group_id_profile_id_key ON public.group_members USING btree (group_id, profile_id);

alter table "public"."group_members" add constraint "group_members_pkey" PRIMARY KEY using index "group_members_pkey";

alter table "public"."group_members" add constraint "group_members_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE not valid;

alter table "public"."group_members" validate constraint "group_members_group_id_fkey";

alter table "public"."group_members" add constraint "group_members_group_id_profile_id_key" UNIQUE using index "group_members_group_id_profile_id_key";

alter table "public"."group_members" add constraint "group_members_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."group_members" validate constraint "group_members_profile_id_fkey";

grant delete on table "public"."group_members" to "anon";
grant insert on table "public"."group_members" to "anon";
grant references on table "public"."group_members" to "anon";
grant select on table "public"."group_members" to "anon";
grant trigger on table "public"."group_members" to "anon";
grant truncate on table "public"."group_members" to "anon";
grant update on table "public"."group_members" to "anon";

grant delete on table "public"."group_members" to "authenticated";
grant insert on table "public"."group_members" to "authenticated";
grant references on table "public"."group_members" to "authenticated";
grant select on table "public"."group_members" to "authenticated";
grant trigger on table "public"."group_members" to "authenticated";
grant truncate on table "public"."group_members" to "authenticated";
grant update on table "public"."group_members" to "authenticated";

grant delete on table "public"."group_members" to "service_role";
grant insert on table "public"."group_members" to "service_role";
grant references on table "public"."group_members" to "service_role";
grant select on table "public"."group_members" to "service_role";
grant trigger on table "public"."group_members" to "service_role";
grant truncate on table "public"."group_members" to "service_role";
grant update on table "public"."group_members" to "service_role";
