-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 2026-05-12 — one-active-commitment rule + mutual contact disclosure
-- ─────────────────────────────────────────────────────────────────────────────
-- Run this delta in Supabase Studio's SQL Editor. Idempotent and safe to re-run.
--
-- What changes:
--   1) accept_blood_request RPC now rejects a second commitment when the donor
--      already has an accepted response on a different still-active request.
--      Server-authoritative regardless of client state.
--   2) Adds a permissive SELECT policy on public.profiles that opens mutual
--      visibility ONLY after an accepted/completed response exists between
--      the two parties. Fixes "name / call / message missing on the request
--      detail screen" — the join was returning null because the prior policy
--      only allowed users to see their own row.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ── 1. accept_blood_request — one-active-commitment rule ─────────────────────
create or replace function public.accept_blood_request(
  p_request_id uuid,
  p_donor_id   uuid
)
returns table (
  response_id uuid,
  status      response_status_enum,
  message     text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status            request_status_enum;
  v_recipient_id      uuid;
  v_units_needed      integer;
  v_accepted_count    integer;
  v_existing          response_status_enum;
  v_resp_id           uuid;
  v_other_commitment  uuid;
begin
  select br.status, br.recipient_id, br.units_needed
    into v_status, v_recipient_id, v_units_needed
    from public.blood_requests br
   where br.id = p_request_id
   for update;

  if not found then
    return query select null::uuid, null::response_status_enum, 'Request not found';
    return;
  end if;

  if v_recipient_id = p_donor_id then
    return query select null::uuid, null::response_status_enum, 'Cannot donate to your own request';
    return;
  end if;

  if v_status <> 'active' then
    return query select null::uuid, null::response_status_enum, format('Request is %s', v_status);
    return;
  end if;

  -- Idempotency
  select rr.status into v_existing
    from public.request_responses rr
   where rr.request_id = p_request_id and rr.donor_id = p_donor_id
   for update;

  if v_existing = 'accepted' then
    select rr.id into v_resp_id from public.request_responses rr
     where rr.request_id = p_request_id and rr.donor_id = p_donor_id;
    return query select v_resp_id, 'accepted'::response_status_enum, 'Already accepted'::text;
    return;
  end if;

  if v_existing = 'completed' then
    select rr.id into v_resp_id from public.request_responses rr
     where rr.request_id = p_request_id and rr.donor_id = p_donor_id;
    return query select v_resp_id, 'completed'::response_status_enum, 'Already completed'::text;
    return;
  end if;

  -- One-active-commitment guard
  select rr.request_id
    into v_other_commitment
    from public.request_responses rr
    join public.blood_requests br on br.id = rr.request_id
   where rr.donor_id   = p_donor_id
     and rr.status     = 'accepted'
     and rr.request_id <> p_request_id
     and br.status     = 'active'
   limit 1;

  if v_other_commitment is not null then
    return query select null::uuid, null::response_status_enum,
      'You already committed to another active request — complete or cancel that one first';
    return;
  end if;

  -- Capacity check
  select count(*)
    into v_accepted_count
    from public.request_responses rr
   where rr.request_id = p_request_id
     and rr.status = 'accepted';

  if v_accepted_count >= v_units_needed then
    return query select null::uuid, null::response_status_enum,
      format('Request already has enough donors (%s of %s)', v_accepted_count, v_units_needed);
    return;
  end if;

  insert into public.request_responses (request_id, donor_id, status)
  values (p_request_id, p_donor_id, 'accepted')
  on conflict (request_id, donor_id)
  do update set status = 'accepted', updated_at = now()
  returning id into v_resp_id;

  return query select v_resp_id, 'accepted'::response_status_enum, 'OK';
end $$;

revoke all     on function public.accept_blood_request(uuid, uuid) from public;
grant  execute on function public.accept_blood_request(uuid, uuid) to service_role;

-- ── 2. profiles — mutual-commitment SELECT policy ────────────────────────────
drop policy if exists "profiles_select_mutual_commitment" on public.profiles;
create policy "profiles_select_mutual_commitment"
  on public.profiles for select
  using (
    exists (
      select 1
        from public.request_responses rr
        join public.blood_requests   br on br.id = rr.request_id
       where rr.status in ('accepted', 'completed')
         and (
           (rr.donor_id     = profiles.id and br.recipient_id = auth.uid())
           or
           (br.recipient_id = profiles.id and rr.donor_id     = auth.uid())
         )
    )
  );

-- ── Verify (single-row PASS/FAIL diagnostic) ─────────────────────────────────
select
  case
    when (select count(*) from pg_policies
          where schemaname = 'public'
            and tablename  = 'profiles'
            and policyname = 'profiles_select_mutual_commitment') = 1
     and (select pg_get_functiondef('public.accept_blood_request(uuid, uuid)'::regprocedure)
            ilike '%one-active-commitment%' escape '\') is not false
    then 'PASS · migration applied'
    else 'FAIL · re-run the migration'
  end as result;
