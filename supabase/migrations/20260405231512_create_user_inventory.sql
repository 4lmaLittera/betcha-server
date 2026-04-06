create table "public"."user_inventory" (
  "id" uuid not null default gen_random_uuid(),
  "profile_id" uuid not null,
  "item_id" uuid not null,
  "is_used" boolean not null default false,
  "purchased_at" timestamp with time zone not null default now()
);

CREATE UNIQUE INDEX user_inventory_pkey ON public.user_inventory USING btree (id);

alter table "public"."user_inventory" add constraint "user_inventory_pkey" PRIMARY KEY using index "user_inventory_pkey";

alter table "public"."user_inventory" add constraint "user_inventory_item_id_fkey" FOREIGN KEY (item_id) REFERENCES public.store_items(id) ON DELETE CASCADE not valid;

alter table "public"."user_inventory" validate constraint "user_inventory_item_id_fkey";

alter table "public"."user_inventory" add constraint "user_inventory_profile_id_fkey" FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."user_inventory" validate constraint "user_inventory_profile_id_fkey";

grant delete on table "public"."user_inventory" to "anon";
grant insert on table "public"."user_inventory" to "anon";
grant references on table "public"."user_inventory" to "anon";
grant select on table "public"."user_inventory" to "anon";
grant trigger on table "public"."user_inventory" to "anon";
grant truncate on table "public"."user_inventory" to "anon";
grant update on table "public"."user_inventory" to "anon";

grant delete on table "public"."user_inventory" to "authenticated";
grant insert on table "public"."user_inventory" to "authenticated";
grant references on table "public"."user_inventory" to "authenticated";
grant select on table "public"."user_inventory" to "authenticated";
grant trigger on table "public"."user_inventory" to "authenticated";
grant truncate on table "public"."user_inventory" to "authenticated";
grant update on table "public"."user_inventory" to "authenticated";

grant delete on table "public"."user_inventory" to "service_role";
grant insert on table "public"."user_inventory" to "service_role";
grant references on table "public"."user_inventory" to "service_role";
grant select on table "public"."user_inventory" to "service_role";
grant trigger on table "public"."user_inventory" to "service_role";
grant truncate on table "public"."user_inventory" to "service_role";
grant update on table "public"."user_inventory" to "service_role";
