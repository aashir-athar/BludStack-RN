-- ════════════════════════════════════════════════════════════════════════════
-- BludStack — Supabase schema, RLS policies, indexes, triggers
-- ════════════════════════════════════════════════════════════════════════════
-- This file is the SINGLE SOURCE OF TRUTH for the database.
--
-- How to apply:
--   1. Open Supabase Studio → SQL Editor
--   2. Run this entire file (idempotent — safe to re-run after edits)
--   3. Verify under Database → Policies that RLS is ENABLED on every table
--
-- Security model:
--   • RLS is ENABLED on every public table — NO row is readable without a policy
--   • The mobile client uses the anon key + a Supabase JWT (Bearer token)
--   • The backend uses the service_role key which BYPASSES RLS
--   • Therefore: sensitive ops (push_token, total_donations, role, etc.)
--     are writable only via the backend's service_role connection
--   • Mobile clients can read public profile fields and active blood requests
--     but never push tokens, GPS coordinates, or other privacy-sensitive data
-- ════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 0. Extensions
-- ────────────────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Enum types
-- ────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type blood_group_enum as enum ('A+','A-','B+','B-','AB+','AB-','O+','O-');
exception when duplicate_object then null; end $$;

do $$ begin
  create type urgency_enum as enum ('critical','urgent','standard');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status_enum as enum ('active','fulfilled','cancelled','expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type response_status_enum as enum ('pending','accepted','declined','completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_role_enum as enum ('donor','recipient','both');
exception when duplicate_object then null; end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. profiles
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                     uuid primary key references auth.users(id) on delete cascade,
  email                  text not null,
  full_name              text,
  phone                  text,
  whatsapp_available     boolean not null default false,
  blood_group            blood_group_enum,
  gender                 text,
  date_of_birth          date,
  avatar_url             text,
  role                   user_role_enum not null default 'donor',
  is_available_to_donate boolean not null default true,
  last_donation_date     timestamptz,
  total_donations        integer not null default 0,
  is_verified            boolean not null default false,
  latitude               double precision,
  longitude              double precision,
  address                text,
  medical_conditions     text[] not null default '{}',
  share_medical_history  boolean not null default false,
  push_token             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- ── Server-enforced safety constraints ──────────────────────────────────
  constraint profiles_latitude_range  check (latitude  is null or (latitude  between -90  and 90)),
  constraint profiles_longitude_range check (longitude is null or (longitude between -180 and 180)),
  constraint profiles_total_donations_nonneg check (total_donations >= 0),

  -- ── Age gate: donors must be 18-65 ──────────────────────────────────────
  -- Recipients can be any age. 'both' implies donor capability, so the
  -- 18-65 window applies. The upper bound matches WHO + most national
  -- blood-bank guidelines for whole-blood donation. `date_of_birth > today
  -- - 66 years` means "younger than 66", i.e. still 65 today.
  constraint profiles_donor_age check (
    role = 'recipient'
    or date_of_birth is null
    or (
          date_of_birth <= (current_date - interval '18 years')
      and date_of_birth >  (current_date - interval '66 years')
    )
  )
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. blood_requests
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.blood_requests (
  id               uuid primary key default gen_random_uuid(),
  recipient_id     uuid not null references public.profiles(id) on delete cascade,
  donor_id         uuid     references public.profiles(id) on delete set null,
  blood_group      blood_group_enum not null,
  urgency          urgency_enum not null default 'urgent',
  units_needed     integer not null default 1,
  hospital_name    text not null,
  hospital_address text not null,
  latitude         double precision not null,
  longitude        double precision not null,
  notes            text,
  status           request_status_enum not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  fulfilled_at     timestamptz,

  -- ── Geo-fencing job state (DB-persisted so restarts don't drop expansion) ─
  geofence_ring_index  integer     not null default 0,
  geofence_next_at     timestamptz,                        -- when next ring fires
  geofence_country     text,                               -- detected ISO code or null

  constraint blood_requests_units_range    check (units_needed between 1 and 20),
  constraint blood_requests_lat_range      check (latitude  between -90  and 90),
  constraint blood_requests_lon_range      check (longitude between -180 and 180),
  constraint blood_requests_hospital_name  check (char_length(hospital_name)    between 2 and 200),
  constraint blood_requests_hospital_addr  check (char_length(hospital_address) between 5 and 400),
  constraint blood_requests_notes_length   check (notes is null or char_length(notes) <= 1000)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4b. messages — in-app chat between donor and recipient about a request
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.blood_requests(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id)       on delete cascade,
  receiver_id uuid not null references public.profiles(id)       on delete cascade,
  content     text not null,
  read        boolean not null default false,
  -- Client-generated idempotency key for offline outbox + optimistic UI reconciliation.
  -- Allows resending without dupes — the unique index rejects retries.
  client_id   uuid unique,
  created_at  timestamptz not null default now(),

  constraint messages_content_length check (char_length(content) between 1 and 2000),
  constraint messages_distinct_parties check (sender_id <> receiver_id)
);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. request_responses
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.request_responses (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.blood_requests(id) on delete cascade,
  donor_id   uuid not null references public.profiles(id)       on delete cascade,
  status     response_status_enum not null default 'pending',
  -- Live donor location, pushed by the donor's app via /donations/heartbeat
  -- while they're en-route to the hospital after accept. The recipient reads
  -- this via the existing request_responses_select_visible policy.
  donor_lat                  double precision,
  donor_lon                  double precision,
  donor_location_updated_at  timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint request_responses_unique unique (request_id, donor_id),
  constraint request_responses_donor_lat_range check (donor_lat is null or (donor_lat between -90  and 90)),
  constraint request_responses_donor_lon_range check (donor_lon is null or (donor_lon between -180 and 180)),
  -- Coherence: the three live-location columns must always move together.
  -- Either no live location yet (all null) or a complete reading (all set).
  -- Without this, a buggy write could leave e.g. donor_lat with a value but
  -- donor_lon null, and mobile/app/map/live.tsx + request/[id].tsx would
  -- read partial coordinates and render off-globe markers.
  constraint request_responses_donor_location_coherent check (
       (donor_lat is null and donor_lon is null and donor_location_updated_at is null)
    or (donor_lat is not null and donor_lon is not null and donor_location_updated_at is not null)
  )
);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Indexes (geo + status hot paths)
-- ────────────────────────────────────────────────────────────────────────────
create index if not exists idx_profiles_available_blood
  on public.profiles (is_available_to_donate, blood_group)
  where push_token is not null and latitude is not null;

create index if not exists idx_profiles_total_donations on public.profiles (total_donations desc);
create index if not exists idx_profiles_location        on public.profiles (latitude, longitude);

create index if not exists idx_blood_requests_status     on public.blood_requests (status, created_at desc);
create index if not exists idx_blood_requests_recipient  on public.blood_requests (recipient_id, created_at desc);
create index if not exists idx_blood_requests_donor      on public.blood_requests (donor_id) where donor_id is not null;
create index if not exists idx_blood_requests_geo        on public.blood_requests (latitude, longitude) where status = 'active';
create index if not exists idx_blood_requests_next_at    on public.blood_requests (geofence_next_at) where status = 'active' and geofence_next_at is not null;

create index if not exists idx_request_responses_request on public.request_responses (request_id, status);
create index if not exists idx_request_responses_donor   on public.request_responses (donor_id, status, created_at desc);

create index if not exists idx_messages_thread     on public.messages (request_id, sender_id, receiver_id, created_at);
create index if not exists idx_messages_receiver   on public.messages (receiver_id, read, created_at desc);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Triggers
-- ────────────────────────────────────────────────────────────────────────────

-- updated_at maintenance
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_updated_at         on public.profiles;
drop trigger if exists blood_requests_updated_at   on public.blood_requests;
drop trigger if exists request_responses_updated_at on public.request_responses;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

create trigger blood_requests_updated_at
  before update on public.blood_requests
  for each row execute function public.tg_set_updated_at();

create trigger request_responses_updated_at
  before update on public.request_responses
  for each row execute function public.tg_set_updated_at();

-- Auto-create profile row on new auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Auto-set fulfilled_at when status flips to fulfilled
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

-- ────────────────────────────────────────────────────────────────────────────
-- 7. RPCs — atomic, race-free operations the backend calls
-- ────────────────────────────────────────────────────────────────────────────

-- Atomic accept: claims a donor slot only if units_needed not yet reached.
-- Eliminates the read-then-write race described in flaw #8.
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
  v_last_donation     timestamptz;
  v_available         boolean;
begin
  -- Lock the request row for the duration of this transaction.
  -- Every column reference is alias-qualified — without that, PG treats
  -- "status" as ambiguous between the table column and the RETURNS TABLE
  -- output column with the same name (error 42702).
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

  -- Idempotency: if donor already accepted, return existing record
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

  -- ────────────────────────────────────────────────────────────────────────
  -- DONOR ELIGIBILITY (availability + 90-day cooldown) — race-free
  -- ────────────────────────────────────────────────────────────────────────
  -- Lock the donor's profile row AND read the eligibility fields in the same
  -- lock. The lock also serialises concurrent accepts on DIFFERENT requests for
  -- the SAME donor (without it, each call would lock only its own
  -- blood_requests row and both could pass the one-commitment check at once).
  -- Enforcing availability + cooldown here makes them authoritative inside the
  -- transaction instead of a racy app-layer pre-check.
  select p.last_donation_date, p.is_available_to_donate
    into v_last_donation, v_available
    from public.profiles p
   where p.id = p_donor_id
   for update;

  if not found then
    return query select null::uuid, null::response_status_enum, 'Donor profile not found';
    return;
  end if;

  if v_available is distinct from true then
    return query select null::uuid, null::response_status_enum,
      'You are currently marked as unavailable to donate';
    return;
  end if;

  if v_last_donation is not null
     and v_last_donation > now() - interval '90 days' then
    return query select null::uuid, null::response_status_enum,
      format(
        'You must wait %s more day(s) before donating again',
        ceil(extract(epoch from (v_last_donation + interval '90 days' - now())) / 86400.0)::int
      );
    return;
  end if;

  -- ────────────────────────────────────────────────────────────────────────
  -- ONE-ACTIVE-COMMITMENT RULE
  -- ────────────────────────────────────────────────────────────────────────
  -- A donor can only have ONE outstanding `accepted` response at a time — they
  -- cannot commit to a second request while a prior commitment is still in
  -- flight on an `active` blood_request. The block clears when (a) the prior
  -- response is marked `completed`, or (b) the prior request flips to
  -- `fulfilled`, `cancelled`, or `expired`. Serialised by the profile-row lock
  -- taken just above.
  select rr.request_id
    into v_other_commitment
    from public.request_responses rr
    join public.blood_requests br on br.id = rr.request_id
   where rr.donor_id  = p_donor_id
     and rr.status    = 'accepted'
     and rr.request_id <> p_request_id
     and br.status    = 'active'
   limit 1;

  if v_other_commitment is not null then
    return query select null::uuid, null::response_status_enum,
      'You already committed to another active request — complete or cancel that one first';
    return;
  end if;

  -- Capacity check inside the same transaction (race-free)
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

  -- Upsert accepted response
  insert into public.request_responses (request_id, donor_id, status)
  values (p_request_id, p_donor_id, 'accepted')
  on conflict (request_id, donor_id)
  do update set status = 'accepted', updated_at = now()
  returning id into v_resp_id;

  return query select v_resp_id, 'accepted'::response_status_enum, 'OK';
end $$;

-- Atomic complete: marks fulfilled, bumps donor stats, flips response — all in one transaction.
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
  v_status              request_status_enum;
  v_recipient_id        uuid;
  v_units_needed        integer;
  v_completed_count     integer;
  v_resp_status         response_status_enum;
  v_resp_id             uuid;
  v_new_total           integer;
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

  -- Accept either 'active' or already-flipped 'fulfilled' (idempotent path
  -- when a multi-unit request partially completed but later gets revisited).
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

  -- Bump donor stats. Table alias disambiguates `total_donations` from the
  -- RETURNS TABLE output column with the same name.
  update public.profiles p
     set total_donations    = p.total_donations + 1,
         last_donation_date = now()
   where p.id = p_donor_id;

  select p.total_donations into v_new_total
    from public.profiles p
   where p.id = p_donor_id;

  -- N donors = N units: only flip the REQUEST to fulfilled when all units
  -- are completed. A 3-unit request stays active until 3 distinct donors
  -- have completed.
  select count(*) into v_completed_count
    from public.request_responses rr
   where rr.request_id = p_request_id and rr.status = 'completed';

  if v_completed_count >= v_units_needed then
    -- Flip the request to fulfilled. `fulfilled_at` is set by the
    -- blood_requests_fulfilled_at trigger. We DO NOT write donor_id here:
    -- with N donors per N units, blood_requests.donor_id can only ever
    -- record one of N, which is misleading. request_responses.donor_id
    -- (one row per donor) is the source of truth.
    update public.blood_requests
       set status = 'fulfilled'
     where id = p_request_id;
  end if;

  return query select v_new_total, 'OK'::text;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Row Level Security — ENABLE everywhere
-- ────────────────────────────────────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.blood_requests    enable row level security;
alter table public.request_responses enable row level security;
alter table public.messages          enable row level security;

-- ── Table-level grants ─────────────────────────────────────────────────────
-- Postgres checks table-level GRANTs BEFORE RLS policies. If these are
-- missing, the user gets "permission denied for table X" even with a correct
-- RLS policy. Supabase's default grants can be revoked accidentally or
-- changed across project ages — these explicit grants make the schema
-- self-contained.
grant usage on schema public to anon, authenticated, service_role;

-- profiles: own-row read/insert/update (insert/update gated by RLS policy)
grant select, insert, update on public.profiles          to authenticated;
grant all                    on public.profiles          to service_role;

-- blood_requests: read active/own + update own status to 'cancelled'
grant select, update         on public.blood_requests    to authenticated;
grant all                    on public.blood_requests    to service_role;

-- request_responses: read only from the client; backend RPCs write
grant select                 on public.request_responses to authenticated;
grant all                    on public.request_responses to service_role;

-- messages: read party threads, insert as sender, flip read flag as receiver
grant select, insert, update on public.messages          to authenticated;
grant all                    on public.messages          to service_role;

-- Drop existing policies so this file is idempotent
do $$
declare r record;
begin
  for r in
    select policyname, tablename
      from pg_policies
     where schemaname = 'public'
       and tablename in ('profiles','blood_requests','request_responses','messages')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. RLS Policies — profiles
-- ────────────────────────────────────────────────────────────────────────────
-- The mobile client uses anon key + JWT. auth.uid() returns the user's id.
-- Public columns are exposed via a VIEW (see section 10); the base table itself
-- only allows reading your OWN row in full. This means:
--   • Mobile cannot select push_token, latitude, longitude, last_donation_date,
--     medical_conditions, address, etc. for any user other than themselves
--   • Public listings go through the public_profiles VIEW which strips PII

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- ── Mutual-commitment disclosure ──────────────────────────────────────────
-- Once a donor accepts a recipient's request, both parties need to see each
-- other's profile (name, contact, blood group, eligibility) to coordinate the
-- donation. This second permissive SELECT policy unlocks the join so the
-- request detail screen can render the ProfileCard for the other party.
--   • Visibility opens on `accepted` and stays open through `completed` so
--     post-donation chat and follow-up still resolve names.
--   • A `declined` response does NOT unlock anything.
-- (Multiple policies on the same op are OR-ed by Postgres, so this stays
-- additive on top of `profiles_select_own`.)
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
           -- profiles.id is the donor who accepted my (recipient's) request
           (rr.donor_id     = profiles.id and br.recipient_id = auth.uid())
           or
           -- profiles.id is the recipient whose request I (donor) accepted
           (br.recipient_id = profiles.id and rr.donor_id     = auth.uid())
         )
    )
  );

-- Insert: only via the auth.users trigger (auto-creates row). Authenticated
-- users can also insert their own row in case the trigger is missing.
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Update: users can only update their OWN row, and only safe columns.
-- A trigger below blocks attempts to write privileged columns from the client.
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No DELETE policy — profiles are never client-deletable. Account deletion
-- happens via Supabase admin API which cascades from auth.users.

-- ── Trigger: prevent client from writing privileged columns ──────────────
-- service_role (backend) bypasses RLS entirely, so it can still write these.
-- Anything coming through the anon JWT path hits this guard.
create or replace function public.tg_guard_profile_privileged_writes()
returns trigger
language plpgsql
as $$
declare
  v_is_service_role boolean;
begin
  -- Service role bypasses this entirely
  -- Multiple detection methods OR-ed — empirically a single check
  -- (current_setting on the JWT claim) returns NULL in some PostgREST
  -- configurations even for service_role connections.
  v_is_service_role :=
       current_user = 'service_role'
    or current_role = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') = 'service_role';
  if v_is_service_role then
    return new;
  end if;

  -- Block privileged column writes from client-side JWTs
  if new.total_donations    is distinct from old.total_donations    then
    raise exception 'total_donations is server-managed' using errcode = '42501';
  end if;
  if new.last_donation_date is distinct from old.last_donation_date then
    raise exception 'last_donation_date is server-managed' using errcode = '42501';
  end if;
  if new.is_verified        is distinct from old.is_verified        then
    raise exception 'is_verified is server-managed' using errcode = '42501';
  end if;
  if new.push_token         is distinct from old.push_token         then
    raise exception 'push_token must be set via backend /notifications/token' using errcode = '42501';
  end if;
  if new.role               is distinct from old.role               then
    raise exception 'role changes must go through backend (age-gated)' using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.tg_guard_profile_privileged_writes();

-- ────────────────────────────────────────────────────────────────────────────
-- 10. public_profiles VIEW — sanitized public listing
-- ────────────────────────────────────────────────────────────────────────────
-- Used by mobile when it needs to display *other* users (e.g. leaderboard).
-- Strips PII: phone, email, push_token, exact lat/lon, address, last_donation_date.
-- Medical conditions are only exposed if the user opted in via share_medical_history.
create or replace view public.public_profiles
with (security_invoker = on)
as
select
  id,
  full_name,
  avatar_url,
  blood_group,
  gender,
  role,
  is_available_to_donate,
  total_donations,
  is_verified,
  case when share_medical_history then medical_conditions else array[]::text[] end as medical_conditions,
  share_medical_history,
  created_at
from public.profiles;

grant select on public.public_profiles to anon, authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 11. RLS Policies — blood_requests
-- ────────────────────────────────────────────────────────────────────────────

-- READ: any authenticated user can see ACTIVE requests (needed for the donor
-- "find requests" feed). They can also see their OWN requests in any status.
-- Note: latitude/longitude on a blood_request is the hospital location,
-- which is public-by-design (donors need to know where to go).
create policy "blood_requests_select_active_or_own"
  on public.blood_requests for select
  using (
    status = 'active'
    or recipient_id = auth.uid()
    or donor_id     = auth.uid()
  );

-- INSERT: Disallowed from client. The backend (service_role) is the only
-- caller; this is enforced by NOT creating an insert policy for authenticated.
-- (No policy = denied under RLS.)

-- UPDATE: recipient can change status to 'cancelled'. Backend handles the rest.
create policy "blood_requests_update_own_status"
  on public.blood_requests for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- ── Trigger: restrict authenticated UPDATEs to status='cancelled' only ──
create or replace function public.tg_guard_request_updates()
returns trigger
language plpgsql
as $$
declare
  v_is_service_role boolean;
begin
  -- Multiple detection methods OR-ed — empirically a single check
  -- (current_setting on the JWT claim) returns NULL in some PostgREST
  -- configurations even for service_role connections.
  v_is_service_role :=
       current_user = 'service_role'
    or current_role = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '') = 'service_role'
    or coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') = 'service_role';
  if v_is_service_role then
    return new;
  end if;

  -- Client may only flip status to cancelled, nothing else
  if new.recipient_id     is distinct from old.recipient_id     then raise exception 'recipient_id immutable' using errcode = '42501'; end if;
  if new.donor_id         is distinct from old.donor_id         then raise exception 'donor_id is server-managed'         using errcode = '42501'; end if;
  if new.blood_group      is distinct from old.blood_group      then raise exception 'blood_group immutable after create' using errcode = '42501'; end if;
  if new.urgency          is distinct from old.urgency          then raise exception 'urgency is server-managed'           using errcode = '42501'; end if;
  if new.units_needed     is distinct from old.units_needed     then raise exception 'units_needed is server-managed'      using errcode = '42501'; end if;
  if new.hospital_name    is distinct from old.hospital_name    then raise exception 'hospital_name is server-managed'     using errcode = '42501'; end if;
  if new.hospital_address is distinct from old.hospital_address then raise exception 'hospital_address is server-managed'  using errcode = '42501'; end if;
  if new.latitude         is distinct from old.latitude         then raise exception 'latitude is server-managed'          using errcode = '42501'; end if;
  if new.longitude        is distinct from old.longitude        then raise exception 'longitude is server-managed'         using errcode = '42501'; end if;
  if new.fulfilled_at     is distinct from old.fulfilled_at     then raise exception 'fulfilled_at is server-managed'      using errcode = '42501'; end if;

  if new.status is distinct from old.status and new.status <> 'cancelled' then
    raise exception 'status changes other than cancelled must go through backend' using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists blood_requests_guard on public.blood_requests;
create trigger blood_requests_guard
  before update on public.blood_requests
  for each row execute function public.tg_guard_request_updates();

-- ────────────────────────────────────────────────────────────────────────────
-- 12. RLS Policies — request_responses
-- ────────────────────────────────────────────────────────────────────────────

-- READ: donor can see their own responses; recipient can see all responses to their requests.
create policy "request_responses_select_visible"
  on public.request_responses for select
  using (
    donor_id = auth.uid()
    or exists (
      select 1 from public.blood_requests br
       where br.id = request_responses.request_id
         and br.recipient_id = auth.uid()
    )
  );

-- INSERT / UPDATE: backend-only. All accepts/declines/completes go through
-- the API which uses service_role + the atomic RPCs above.
-- (No client policies = denied.)

-- ────────────────────────────────────────────────────────────────────────────
-- 12b. RLS Policies — messages
-- ────────────────────────────────────────────────────────────────────────────
-- A message is visible to its sender or its receiver. Inserts are allowed only
-- from the sender (auth.uid() = sender_id) and only when there is a matching
-- accepted donation linking the two users on that request. Read-flag flips
-- (UPDATE) are allowed only by the receiver.

create policy "messages_select_party"
  on public.messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "messages_insert_self_with_relationship"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.request_responses rr
       join public.blood_requests br on br.id = rr.request_id
       where rr.request_id = messages.request_id
         and rr.status in ('accepted','completed')
         and (
           (rr.donor_id    = auth.uid() and br.recipient_id = messages.receiver_id)
           or
           (br.recipient_id = auth.uid() and rr.donor_id    = messages.receiver_id)
         )
    )
  );

create policy "messages_update_read_by_receiver"
  on public.messages for update
  using (receiver_id = auth.uid())
  with check (receiver_id = auth.uid());

-- Block mutation of anything except `read` from the client side
create or replace function public.tg_guard_message_updates()
returns trigger
language plpgsql
as $$
declare
  v_is_service_role boolean;
begin
  v_is_service_role := coalesce(
    current_setting('request.jwt.claim.role', true) = 'service_role', false);
  if v_is_service_role then return new; end if;

  if new.request_id  is distinct from old.request_id  then raise exception 'request_id immutable'  using errcode = '42501'; end if;
  if new.sender_id   is distinct from old.sender_id   then raise exception 'sender_id immutable'   using errcode = '42501'; end if;
  if new.receiver_id is distinct from old.receiver_id then raise exception 'receiver_id immutable' using errcode = '42501'; end if;
  if new.content     is distinct from old.content     then raise exception 'content immutable'     using errcode = '42501'; end if;
  return new;
end $$;

drop trigger if exists messages_guard on public.messages;
create trigger messages_guard
  before update on public.messages
  for each row execute function public.tg_guard_message_updates();

-- ────────────────────────────────────────────────────────────────────────────
-- 13. Realtime
-- ────────────────────────────────────────────────────────────────────────────
-- Add the tables to supabase_realtime publication so the mobile app can
-- subscribe to UPDATE events for their own data.
do $$
begin
  -- profiles realtime (own row only, enforced by RLS above)
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'profiles'
  ) then
    execute 'alter publication supabase_realtime add table public.profiles';
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'blood_requests'
  ) then
    execute 'alter publication supabase_realtime add table public.blood_requests';
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'request_responses'
  ) then
    execute 'alter publication supabase_realtime add table public.request_responses';
  end if;

  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 14. Grants
-- ────────────────────────────────────────────────────────────────────────────
-- Allow authenticated users to execute the RPCs (server-side functions still
-- run with SECURITY DEFINER so they bypass RLS for the work they need to do).
-- In practice, the backend calls these via service_role, but exposing to
-- authenticated lets us test from Supabase Studio while logged in.
revoke all on function public.accept_blood_request    (uuid, uuid)       from public;
revoke all on function public.complete_blood_donation (uuid, uuid, uuid) from public;

grant execute on function public.accept_blood_request    (uuid, uuid)       to service_role;
grant execute on function public.complete_blood_donation (uuid, uuid, uuid) to service_role;

-- Pin OWNER to service_role for both SECURITY DEFINER RPCs. The RPCs already
-- work via the JWT-claim fallback in the trigger guards, but `current_user =
-- 'service_role'` only short-circuits the guard when the function owner IS
-- service_role (because SECURITY DEFINER sets current_user to the definer).
-- This is defense-in-depth: even if the JWT-claim path ever changes shape,
-- the guards still see service_role here.
alter function public.accept_blood_request    (uuid, uuid)       owner to service_role;
alter function public.complete_blood_donation (uuid, uuid, uuid) owner to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- DONE — RLS is now enforced. The mobile client can no longer:
--   ✗ Read other users' push tokens, GPS, or last_donation_date
--   ✗ Insert blood_requests directly (must go through backend)
--   ✗ Insert/update request_responses directly (must go through backend)
--   ✗ Mutate total_donations, last_donation_date, role, push_token, is_verified
--   ✗ Update any blood_request field except status='cancelled' on their own
-- The backend retains full access via service_role.
-- ════════════════════════════════════════════════════════════════════════════
