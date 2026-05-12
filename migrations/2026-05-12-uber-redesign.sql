-- migrations/2026-05-12-uber-redesign.sql
-- Run once in Supabase Studio → SQL Editor.
-- Idempotent — safe to re-run. Contains every schema delta from the
-- 2026 Uber-style redesign pass:
--   • Live donor-location columns on request_responses
--   • complete_blood_donation: ambiguous-column fix + N-donors-per-N-units rule
--   • accept_blood_request: ambiguous-column fix (table aliases)
--   • Trigger guards: stronger service_role detection (multiple methods OR'd)
--   • Explicit table-level grants to the authenticated + service_role roles
--     (Supabase project defaults were missing on this project)

-- ════════════════════════════════════════════════════════════════════════════
-- 1.  Live donor-location columns on request_responses
-- ════════════════════════════════════════════════════════════════════════════
alter table public.request_responses
  add column if not exists donor_lat                 double precision,
  add column if not exists donor_lon                 double precision,
  add column if not exists donor_location_updated_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'request_responses_donor_lat_range') then
    alter table public.request_responses
      add constraint request_responses_donor_lat_range
      check (donor_lat is null or (donor_lat between -90 and 90));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'request_responses_donor_lon_range') then
    alter table public.request_responses
      add constraint request_responses_donor_lon_range
      check (donor_lon is null or (donor_lon between -180 and 180));
  end if;
end $$;

create index if not exists idx_request_responses_location
  on public.request_responses (request_id)
  where donor_lat is not null;

-- ════════════════════════════════════════════════════════════════════════════
-- 2.  accept_blood_request RPC — table aliases on every reference
-- ════════════════════════════════════════════════════════════════════════════
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
  v_status         request_status_enum;
  v_recipient_id   uuid;
  v_units_needed   integer;
  v_accepted_count integer;
  v_existing       response_status_enum;
  v_resp_id        uuid;
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

  select count(*)
    into v_accepted_count
    from public.request_responses rr
   where rr.request_id = p_request_id and rr.status = 'accepted';

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

-- ════════════════════════════════════════════════════════════════════════════
-- 3.  complete_blood_donation RPC — N-donors-per-N-units + alias-disambiguated
-- ════════════════════════════════════════════════════════════════════════════
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

  -- Allow 'active' (normal) and 'fulfilled' (idempotent retry when partial-
  -- multi-unit was completed and revisited).
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

  -- Flip this donor's response to completed
  update public.request_responses set status = 'completed' where id = v_resp_id;

  -- Bump donor stats. Alias to disambiguate from the OUTPUT column.
  update public.profiles p
     set total_donations    = p.total_donations + 1,
         last_donation_date = now()
   where p.id = p_donor_id;

  select p.total_donations into v_new_total
    from public.profiles p
   where p.id = p_donor_id;

  -- N donors = N units rule: request -> fulfilled only when ALL completed.
  select count(*) into v_completed_count
    from public.request_responses rr
   where rr.request_id = p_request_id and rr.status = 'completed';

  if v_completed_count >= v_units_needed then
    update public.blood_requests
       set status = 'fulfilled', donor_id = p_donor_id
     where id = p_request_id;
  end if;

  return query select v_new_total, 'OK'::text;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4.  Trigger guards — stronger service_role detection
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.tg_guard_profile_privileged_writes()
returns trigger
language plpgsql
as $$
declare
  v_is_service_role boolean;
begin
  v_is_service_role :=
       current_user = 'service_role'
    or current_role = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claims',     true), '')::jsonb->>'role', '') = 'service_role';
  if v_is_service_role then return new; end if;

  if new.total_donations    is distinct from old.total_donations    then raise exception 'total_donations is server-managed'    using errcode = '42501'; end if;
  if new.last_donation_date is distinct from old.last_donation_date then raise exception 'last_donation_date is server-managed' using errcode = '42501'; end if;
  if new.is_verified        is distinct from old.is_verified        then raise exception 'is_verified is server-managed'        using errcode = '42501'; end if;
  if new.push_token         is distinct from old.push_token         then raise exception 'push_token must be set via backend /notifications/token' using errcode = '42501'; end if;
  if new.role               is distinct from old.role               then raise exception 'role changes must go through backend (age-gated)'        using errcode = '42501'; end if;
  return new;
end $$;

create or replace function public.tg_guard_request_updates()
returns trigger
language plpgsql
as $$
declare
  v_is_service_role boolean;
begin
  v_is_service_role :=
       current_user = 'service_role'
    or current_role = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claims',     true), '')::jsonb->>'role', '') = 'service_role';
  if v_is_service_role then return new; end if;

  if new.recipient_id     is distinct from old.recipient_id     then raise exception 'recipient_id immutable'                using errcode = '42501'; end if;
  if new.donor_id         is distinct from old.donor_id         then raise exception 'donor_id is server-managed'             using errcode = '42501'; end if;
  if new.blood_group      is distinct from old.blood_group      then raise exception 'blood_group immutable after create'     using errcode = '42501'; end if;
  if new.urgency          is distinct from old.urgency          then raise exception 'urgency is server-managed'              using errcode = '42501'; end if;
  if new.units_needed     is distinct from old.units_needed     then raise exception 'units_needed is server-managed'         using errcode = '42501'; end if;
  if new.hospital_name    is distinct from old.hospital_name    then raise exception 'hospital_name is server-managed'        using errcode = '42501'; end if;
  if new.hospital_address is distinct from old.hospital_address then raise exception 'hospital_address is server-managed'     using errcode = '42501'; end if;
  if new.latitude         is distinct from old.latitude         then raise exception 'latitude is server-managed'             using errcode = '42501'; end if;
  if new.longitude        is distinct from old.longitude        then raise exception 'longitude is server-managed'            using errcode = '42501'; end if;
  if new.fulfilled_at     is distinct from old.fulfilled_at     then raise exception 'fulfilled_at is server-managed'         using errcode = '42501'; end if;
  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'status changes other than cancelled must go through backend' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function public.tg_guard_message_updates()
returns trigger
language plpgsql
as $$
declare
  v_is_service_role boolean;
begin
  v_is_service_role :=
       current_user = 'service_role'
    or current_role = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claims',     true), '')::jsonb->>'role', '') = 'service_role';
  if v_is_service_role then return new; end if;

  if new.request_id  is distinct from old.request_id  then raise exception 'request_id immutable'  using errcode = '42501'; end if;
  if new.sender_id   is distinct from old.sender_id   then raise exception 'sender_id immutable'   using errcode = '42501'; end if;
  if new.receiver_id is distinct from old.receiver_id then raise exception 'receiver_id immutable' using errcode = '42501'; end if;
  if new.content     is distinct from old.content     then raise exception 'content immutable'     using errcode = '42501'; end if;
  return new;
end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5.  Explicit table-level grants (Postgres checks these BEFORE RLS policies)
-- ════════════════════════════════════════════════════════════════════════════
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update on public.profiles          to authenticated;
grant all                    on public.profiles          to service_role;

grant select, update         on public.blood_requests    to authenticated;
grant all                    on public.blood_requests    to service_role;

grant select                 on public.request_responses to authenticated;
grant all                    on public.request_responses to service_role;

grant select, insert, update on public.messages          to authenticated;
grant all                    on public.messages          to service_role;

grant select                 on public.public_profiles   to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6.  RPC grants (only service_role executes; clients hit them via backend)
-- ════════════════════════════════════════════════════════════════════════════
revoke all on function public.accept_blood_request    (uuid, uuid)       from public;
revoke all on function public.complete_blood_donation (uuid, uuid, uuid) from public;
grant execute on function public.accept_blood_request    (uuid, uuid)       to service_role;
grant execute on function public.complete_blood_donation (uuid, uuid, uuid) to service_role;
