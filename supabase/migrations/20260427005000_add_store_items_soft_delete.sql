alter table "public"."store_items"
add column "is_active" boolean not null default true;

alter table "public"."user_inventory"
drop constraint "user_inventory_item_id_fkey";

alter table "public"."user_inventory"
add constraint "user_inventory_item_id_fkey"
foreign key (item_id)
references public.store_items(id)
on delete restrict
not valid;

alter table "public"."user_inventory"
validate constraint "user_inventory_item_id_fkey";
