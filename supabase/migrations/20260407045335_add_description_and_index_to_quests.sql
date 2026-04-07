alter table "public"."quests" add column "description" text;

create index quests_group_id_idx on public.quests using btree (group_id);
