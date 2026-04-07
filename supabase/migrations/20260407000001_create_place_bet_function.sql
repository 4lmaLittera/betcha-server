-- Atominė statymo funkcija: sukuria statymo įrašą ir sumažina vartotojo balansą
-- vienos transakcijos ribose, išvengiant race condition
create or replace function place_bet(
  p_profile_id uuid,
  p_quest_id   uuid,
  p_amount     integer,
  p_direction  boolean,
  p_coefficient real
)
returns json
language plpgsql
security definer
as $$
declare
  v_balance integer;
  v_bet_id  uuid;
begin
  -- 1. Gauti dabartinį balansą su eilutės užraktu (FOR UPDATE)
  select balance
    into v_balance
    from public.profiles
   where id = p_profile_id
     for update;

  if not found then
    raise exception 'Vartotojas nerastas' using errcode = 'P0001';
  end if;

  -- 2. Patikrinti ar pakanka taškų
  if v_balance < p_amount then
    raise exception 'Nepakanka taškų' using errcode = 'P0002';
  end if;

  -- 3. Sukurti statymo įrašą
  insert into public.bets (quest_id, profile_id, amount, prediction_is_positive, coefficient, status)
  values (p_quest_id, p_profile_id, p_amount, p_direction, p_coefficient, 'pending')
  returning id into v_bet_id;

  -- 4. Sumažinti balansą
  update public.profiles
     set balance = balance - p_amount
   where id = p_profile_id;

  -- 5. Grąžinti sukurto statymo duomenis
  return json_build_object(
    'id',         v_bet_id,
    'quest_id',   p_quest_id,
    'profile_id', p_profile_id,
    'amount',     p_amount,
    'direction',  p_direction,
    'coefficient', p_coefficient,
    'status',     'pending'
  );
end;
$$;
