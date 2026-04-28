-- Atominė funkcija, kuri gavus rezoliuciją (Už / Prieš laimėjo) perskirsto taškus nugalėtojams.
create or replace function resolve_quest(
  p_quest_id uuid,
  p_resolution_is_positive boolean
)
returns json
language plpgsql
security definer
as $$
declare
  v_status text;
begin
  -- 1. Patikriname ar quest dar nėra išspręstas ir užrakiname jį
  select status into v_status
    from public.quests
   where id = p_quest_id
     for update;

  if not found then
    raise exception 'Užduotis nerasta' using errcode = 'P0001';
  end if;

  if v_status != 'open' then
    raise exception 'Užduotis jau yra uždaryta' using errcode = 'P0002';
  end if;

  -- 2. Atnaujiname quests statusą
  -- Tarkime, "completed" atitinka resolution_is_positive = true (UŽ)
  -- "rejected" atitinka resolution_is_positive = false (PRIEŠ)
  update public.quests 
     set status = case when p_resolution_is_positive then 'completed' else 'rejected' end,
         completed_at = now()
   where id = p_quest_id;

  -- 3. Atnaujiname lažybų statusą į won arba lost
  update public.bets
     set status = case when prediction_is_positive = p_resolution_is_positive then 'won' else 'lost' end
   where quest_id = p_quest_id
     and status = 'pending';

  -- 4. Paskirstome prizus laimėtojams
  -- Pastaba: Kai lažybos buvo daromos, asmens balansas jau buvo sumažintas jo asmeniniu statymu.
  -- Grąžinant pelną + jo statymą, reikia balansą padidinti (amount * coefficient).
  update public.profiles p
     set balance = balance + (b.amount * b.coefficient)
    from public.bets b
   where b.quest_id = p_quest_id
     and b.profile_id = p.id
     and b.status = 'won';

  return json_build_object(
    'success', true,
    'quest_id', p_quest_id,
    'resolution', case when p_resolution_is_positive then 'completed' else 'rejected' end
  );
end;
$$;
