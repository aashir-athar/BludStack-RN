-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 2026-05-14 — add maximum donor age (65)
-- ─────────────────────────────────────────────────────────────────────────────
-- Run once in Supabase Studio → SQL Editor. Idempotent and safe to re-run.
--
-- Tightens the existing profiles_donor_age CHECK constraint:
--   was:  donors must be 18+
--   now:  donors must be 18-65 inclusive (WHO whole-blood guideline)
--
-- The mobile client + backend (authController, profileController) already
-- enforce the same window — this DB constraint is the final guard against
-- direct service_role writes that bypass the application layer.
-- ─────────────────────────────────────────────────────────────────────────────

set search_path = public;

-- Reject the migration up front if any existing donor row already violates
-- the new ceiling. The operator must decide what to do with them (downgrade
-- to recipient, or grant an exception) before the constraint lands — silent
-- corruption is worse than a noisy abort.
do $$
declare
  v_violators int;
begin
  select count(*)
    into v_violators
    from public.profiles
   where role in ('donor', 'both')
     and date_of_birth is not null
     and date_of_birth <= (current_date - interval '66 years');

  if v_violators > 0 then
    raise exception
      'cannot tighten profiles_donor_age: % donor/both row(s) are older than 65. Downgrade them to recipient first, then re-run.',
      v_violators;
  end if;
end $$;

-- Drop + recreate so the constraint definition is the single source of
-- truth on every re-run (Postgres has no "alter check constraint" verb).
alter table public.profiles drop constraint if exists profiles_donor_age;

alter table public.profiles add constraint profiles_donor_age check (
  role = 'recipient'
  or date_of_birth is null
  or (
        date_of_birth <= (current_date - interval '18 years')
    and date_of_birth >  (current_date - interval '66 years')
  )
);

-- ── Verify (single-row PASS/FAIL diagnostic) ─────────────────────────────────
select
  case
    when (select pg_get_constraintdef(oid)
            from pg_constraint
           where conname = 'profiles_donor_age') ilike '%66 years%'
    then 'PASS · donor max age (65) enforced'
    else 'FAIL · re-run the migration'
  end as result;
