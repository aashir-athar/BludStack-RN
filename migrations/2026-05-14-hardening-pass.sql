-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 2026-05-14 — hardening pass (review findings #2, #3, #4, #8)
-- ─────────────────────────────────────────────────────────────────────────────
-- Run once in Supabase Studio → SQL Editor. Idempotent and safe to re-run.
--
-- What changes:
--   #2  Adds a CHECK constraint on request_responses that enforces coherence
--       between donor_lat / donor_lon / donor_location_updated_at — either all
--       three null or all three not null.
--   #3  Pins OWNER of the SECURITY DEFINER RPCs to service_role so the trigger
--       guards' `current_user = 'service_role'` short-circuit fires regardless
--       of caller. (Defense-in-depth; the JWT-claim fallback still works
--       independently.)
--   #4a Defines + attaches the tg_set_fulfilled_at trigger so this migration
--       is self-contained for fresh databases (the canonical schema already
--       has it; including it here means the standalone migration matches).
--   #4b Recreates complete_blood_donation WITHOUT writing
--       blood_requests.donor_id during fulfillment. With N donors per N units,
--       a single donor_id is misleading; request_responses is the source of
--       truth. fulfilled_at is now set by the trigger above, not the RPC.
--   #8  Recreates accept_blood_request with a SELECT … FOR UPDATE on the
--       donor's profile row before the one-active-commitment check. This
--       serialises concurrent accepts on different requests by the same
--       donor — they no longer race past the guard.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- ── #2.  Donor-location coherence CHECK ──────────────────────────────────────
do $$ begin
  -- Reject the constraint if any existing row is incoherent. This is rare
  -- (only happens if a buggy write predated this migration) but the loud
  -- failure is better than a silent partial-coordinate state.
  if exists (
    select 1 from public.request_responses
    where ( donor_lat is null) <> (donor_lon is null)
       or ( donor_lat is null) <> (donor_location_updated_at is null)
  ) then
    raise exception 'request_responses contains incoherent donor_lat/donor_lon/donor_location_updated_at rows — clean before adding the constraint';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'request_responses_donor_location_coherent'
  ) then
    alter table public.request_responses
      add constraint request_responses_donor_location_coherent check (
           (donor_lat is null and donor_lon is null and donor_location_updated_at is null)
        or (donor_lat is not null and donor_lon is not null and donor_location_updated_at is not null)
      );
  end if;
end $$;

-- ── #4a. tg_set_fulfilled_at trigger (idempotent recreate) ───────────────────
create or replace function public.tg_set_fulfilled_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'fulfilled' and (old.status is distinct from 'fulfilled') then
    new.fulfilled_at = now();
  end if;
  return new;
end $$;

drop trigger if exists blood_requests_fulfilled_at on public.blood_requests;
create trigger blood_requests_fulfilled_at
  before update on public.blood_requests
  for each row execute function public.tg_set_fulfilled_at();

-- ── #8.  accept_blood_request — donor profile lock before commitment check ──
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
  v_status           request_status_enum;
  v_recipient_id     uuid;
  v_units_needed     integer;
  v_accepted_count   integer;
  v_existing         response_status_enum;
  v_resp_id          uuid;
  v_other_commitment uuid;
begin
  select br.status, br.recipient_id, br.units_needed
    into v_status, v_recipient_id, v_units_needed
    from public.blood_requests br
   where br.id = p_request_id
   for update;

  if not found then
    return query select null::uuid, null::response_status_enum, 'Request not found'::text;
    return;
  end if;

  if v_recipient_id = p_donor_id then
    return query select null::uuid, null::response_status_enum, 'Cannot donate to your own request'::text;
    return;
  end if;

  if v_status <> 'active' then
    return query select null::uuid, null::response_status_enum, format('Request is %s', v_status);
    return;
  end if;

  select rr.status
    into v_existing
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

  -- ONE-ACTIVE-COMMITMENT — lock the donor's profile row so two concurrent
  -- accepts on DIFFERENT requests by the same donor are forced to serialise.
  -- Without this lock, each call would only lock its own blood_requests row
  -- and both could observe v_other_commitment = null at the same time.
  perform 1 from public.profiles where id = p_donor_id for update;

  select rr.request_id
    into v_other_commitment
    from public.request_responses rr
    join public.blood_requests   br on br.id = rr.request_id
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

  return query select v_resp_id, 'accepted'::response_status_enum, 'OK'::text;
end $$;

-- ── #4b. complete_blood_donation — no donor_id write, fulfilled_at via trigger
create or replace function public.complete_blood_donation(
  p_request_id uuid,
  p_donor_id   uuid,
  p_caller_id  uuid
)
returns table (
  total_donations integer,
  message         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status          request_status_enum;
  v_recipient_id    uuid;
  v_units_needed    integer;
  v_completed_count integer;
  v_resp_status     response_status_enum;
  v_resp_id         uuid;
  v_new_total       integer;
begin
  select br.status, br.recipient_id, br.units_needed
    into v_status, v_recipient_id, v_units_needed
    from public.blood_requests br
   where br.id = p_request_id
   for update;

  if not found then
    return query select null::integer, 'Request not found'::text;
    return;
  end if;

  if v_recipient_id <> p_caller_id then
    return query select null::integer, 'Not authorised'::text;
    return;
  end if;

  if v_status not in ('active','fulfilled') then
    return query select null::integer, format('Request already %s', v_status);
    return;
  end if;

  select rr.id, rr.status
    into v_resp_id, v_resp_status
    from public.request_responses rr
   where rr.request_id = p_request_id and rr.donor_id = p_donor_id
   for update;

  if v_resp_id is null then
    return query select null::integer, 'Donor has not accepted this request'::text;
    return;
  end if;

  if v_resp_status = 'completed' then
    select p.total_donations into v_new_total from public.profiles p where p.id = p_donor_id;
    return query select v_new_total, 'Already completed'::text;
    return;
  end if;

  if v_resp_status <> 'accepted' then
    return query select null::integer, format('Donor status is %s', v_resp_status);
    return;
  end if;

  update public.request_responses set status = 'completed' where id = v_resp_id;

  update public.profiles p
     set total_donations    = p.total_donations + 1,
         last_donation_date = now()
   where p.id = p_donor_id;

  select p.total_donations into v_new_total
    from public.profiles p
   where p.id = p_donor_id;

  select count(*) into v_completed_count
    from public.request_responses rr
   where rr.request_id = p_request_id and rr.status = 'completed';

  if v_completed_count >= v_units_needed then
    -- N donors per N units: do NOT write blood_requests.donor_id (it could
    -- only ever record one of N). request_responses is the source of truth.
    -- fulfilled_at is set automatically by blood_requests_fulfilled_at above.
    update public.blood_requests
       set status = 'fulfilled'
     where id = p_request_id;
  end if;

  return query select v_new_total, 'OK'::text;
end $$;

-- ── #3.  Pin OWNER to service_role for both SECURITY DEFINER RPCs ───────────
revoke all     on function public.accept_blood_request    (uuid, uuid)       from public;
revoke all     on function public.complete_blood_donation (uuid, uuid, uuid) from public;
grant  execute on function public.accept_blood_request    (uuid, uuid)       to service_role;
grant  execute on function public.complete_blood_donation (uuid, uuid, uuid) to service_role;
alter  function public.accept_blood_request    (uuid, uuid)       owner to service_role;
alter  function public.complete_blood_donation (uuid, uuid, uuid) owner to service_role;

-- ── Verify (single-row PASS/FAIL diagnostic) ─────────────────────────────────
select
  case
    when (select count(*) from pg_constraint
          where conname = 'request_responses_donor_location_coherent') = 1
     and (select pg_get_functiondef('public.accept_blood_request(uuid, uuid)'::regprocedure)
           ilike '%for update%') is not false
     and (select pg_get_functiondef('public.complete_blood_donation(uuid, uuid, uuid)'::regprocedure)
           not ilike '%set status = ''fulfilled'', donor_id%') is not false
     and (select tgname from pg_trigger
          where tgrelid = 'public.blood_requests'::regclass
            and tgname = 'blood_requests_fulfilled_at') is not null
    then 'PASS · hardening migration applied'
    else 'FAIL · re-run the migration'
  end as result;
