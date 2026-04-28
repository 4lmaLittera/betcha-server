create table "public"."store_items" (
  "id" uuid not null default gen_random_uuid(),
  "name" text not null,
  "description" text,
  "price" integer not null
);

CREATE UNIQUE INDEX store_items_pkey ON public.store_items USING btree (id);

alter table "public"."store_items" add constraint "store_items_pkey" PRIMARY KEY using index "store_items_pkey";

grant delete on table "public"."store_items" to "anon";
grant insert on table "public"."store_items" to "anon";
grant references on table "public"."store_items" to "anon";
grant select on table "public"."store_items" to "anon";
grant trigger on table "public"."store_items" to "anon";
grant truncate on table "public"."store_items" to "anon";
grant update on table "public"."store_items" to "anon";

grant delete on table "public"."store_items" to "authenticated";
grant insert on table "public"."store_items" to "authenticated";
grant references on table "public"."store_items" to "authenticated";
grant select on table "public"."store_items" to "authenticated";
grant trigger on table "public"."store_items" to "authenticated";
grant truncate on table "public"."store_items" to "authenticated";
grant update on table "public"."store_items" to "authenticated";

grant delete on table "public"."store_items" to "service_role";
grant insert on table "public"."store_items" to "service_role";
grant references on table "public"."store_items" to "service_role";
grant select on table "public"."store_items" to "service_role";
grant trigger on table "public"."store_items" to "service_role";
grant truncate on table "public"."store_items" to "service_role";
grant update on table "public"."store_items" to "service_role";
