-- migrations/2026-06-16-cooldown-in-rpc.sql
-- ----------------------------------------------------------------------------
-- Move the 90-day donation cooldown (and the availability gate) INTO the
-- accept_blood_request RPC, enforced inside the donor-profile row lock that
-- already serialises concurrent accepts for a donor.
--
-- Why: the cooldown was previously checked only in the Node controller
-- (donationController.acceptRequest) BEFORE calling the RPC. Two concurrent
-- accept requests for the same donor could both read last_donation_date, both
-- pass the JS check, and both reach the RPC — a TOCTOU race that could let a
-- donor accept while still inside their cooldown window. Enforcing it in the
-- same locked transaction as the capacity + one-commitment checks closes the
-- window completely. The controller keeps a fast, friendly pre-check, but the
-- RPC is now the authoritative boundary.
--
-- Idempotent: CREATE OR REPLACE. Safe to re-run. Apply in Supabase Studio →
-- SQL Editor after supabase_schema.sql.
-- ----------------------------------------------------------------------------

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

  -- Idempotency: if donor already accepted/completed, return existing record
  -- (do NOT re-apply the cooldown gate to an existing acceptance).
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
  -- Lock the donor's profile row (serialises concurrent accepts for this
  -- donor — see the one-active-commitment note below) AND read the fields that
  -- gate eligibility in the same lock, so availability + cooldown are enforced
  -- authoritatively inside the transaction rather than in a racy app-layer
  -- pre-check.
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
  -- A donor can only have ONE outstanding `accepted` response at a time. The
  -- profile-row lock taken above also serialises concurrent accepts on
  -- DIFFERENT requests for the SAME donor (without it, each call would lock
  -- only its own blood_requests row and both could pass this check at once).
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
