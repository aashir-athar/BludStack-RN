-- verify_schema.sql - single-result diagnostic.
-- Run in Supabase Studio → SQL Editor. Returns one combined table with one
-- row per check, ordered by importance. Any row with ok=false is the problem.

with checks as (
  -- Enum types
  select 1 as ord, 'enum: blood_group_enum'      as check_name,
         exists(select 1 from pg_type where typname = 'blood_group_enum')      as ok,
         '' as detail
  union all
  select 2, 'enum: urgency_enum',
         exists(select 1 from pg_type where typname = 'urgency_enum'), ''
  union all
  select 3, 'enum: request_status_enum',
         exists(select 1 from pg_type where typname = 'request_status_enum'), ''
  union all
  select 4, 'enum: response_status_enum',
         exists(select 1 from pg_type where typname = 'response_status_enum'), ''
  union all
  select 5, 'enum: user_role_enum',
         exists(select 1 from pg_type where typname = 'user_role_enum'), ''

  -- Tables
  union all
  select 10, 'table: profiles',
         exists(select 1 from pg_tables where schemaname='public' and tablename='profiles'), ''
  union all
  select 11, 'table: blood_requests',
         exists(select 1 from pg_tables where schemaname='public' and tablename='blood_requests'), ''
  union all
  select 12, 'table: request_responses',
         exists(select 1 from pg_tables where schemaname='public' and tablename='request_responses'), ''
  union all
  select 13, 'table: messages',
         exists(select 1 from pg_tables where schemaname='public' and tablename='messages'), ''

  -- Critical profiles columns (most common source of /auth/register 500)
  union all
  select 20, 'profiles.role column',
         exists(select 1 from information_schema.columns
                 where table_schema='public' and table_name='profiles' and column_name='role'), ''
  union all
  select 21, 'profiles.whatsapp_available',
         exists(select 1 from information_schema.columns
                 where table_schema='public' and table_name='profiles' and column_name='whatsapp_available'), ''
  union all
  select 22, 'profiles.share_medical_history',
         exists(select 1 from information_schema.columns
                 where table_schema='public' and table_name='profiles' and column_name='share_medical_history'), ''
  union all
  select 23, 'profiles.medical_conditions',
         exists(select 1 from information_schema.columns
                 where table_schema='public' and table_name='profiles' and column_name='medical_conditions'), ''
  union all
  select 24, 'profiles.push_token',
         exists(select 1 from information_schema.columns
                 where table_schema='public' and table_name='profiles' and column_name='push_token'), ''
  union all
  select 25, 'blood_requests.geofence_next_at',
         exists(select 1 from information_schema.columns
                 where table_schema='public' and table_name='blood_requests' and column_name='geofence_next_at'), ''
  union all
  select 26, 'messages.client_id',
         exists(select 1 from information_schema.columns
                 where table_schema='public' and table_name='messages' and column_name='client_id'), ''

  -- RLS enabled
  union all
  select 30, 'RLS on profiles',
         coalesce((select rowsecurity from pg_tables where schemaname='public' and tablename='profiles'), false), ''
  union all
  select 31, 'RLS on blood_requests',
         coalesce((select rowsecurity from pg_tables where schemaname='public' and tablename='blood_requests'), false), ''
  union all
  select 32, 'RLS on request_responses',
         coalesce((select rowsecurity from pg_tables where schemaname='public' and tablename='request_responses'), false), ''
  union all
  select 33, 'RLS on messages',
         coalesce((select rowsecurity from pg_tables where schemaname='public' and tablename='messages'), false), ''

  -- Policies (the actual cause of "permission denied")
  union all
  select 40, 'policy: profiles_select_own',
         exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_select_own'), ''
  union all
  select 41, 'policy: profiles_insert_own',
         exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_insert_own'), ''
  union all
  select 42, 'policy: profiles_update_own',
         exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_update_own'), ''
  union all
  select 43, 'policy: blood_requests_select_active_or_own',
         exists(select 1 from pg_policies where schemaname='public' and tablename='blood_requests' and policyname='blood_requests_select_active_or_own'), ''
  union all
  select 44, 'policy: blood_requests_update_own_status',
         exists(select 1 from pg_policies where schemaname='public' and tablename='blood_requests' and policyname='blood_requests_update_own_status'), ''
  union all
  select 45, 'policy: request_responses_select_visible',
         exists(select 1 from pg_policies where schemaname='public' and tablename='request_responses' and policyname='request_responses_select_visible'), ''
  union all
  select 46, 'policy: messages_select_party',
         exists(select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='messages_select_party'), ''
  union all
  select 47, 'policy: messages_insert_self_with_relationship',
         exists(select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='messages_insert_self_with_relationship'), ''
  union all
  select 48, 'policy: messages_update_read_by_receiver',
         exists(select 1 from pg_policies where schemaname='public' and tablename='messages' and policyname='messages_update_read_by_receiver'), ''

  -- Grants for authenticated role
  union all
  select 50, 'GRANT SELECT on profiles to authenticated',
         exists(select 1 from information_schema.table_privileges
                 where table_schema='public' and table_name='profiles'
                   and grantee='authenticated' and privilege_type='SELECT'), ''
  union all
  select 51, 'GRANT SELECT on blood_requests to authenticated',
         exists(select 1 from information_schema.table_privileges
                 where table_schema='public' and table_name='blood_requests'
                   and grantee='authenticated' and privilege_type='SELECT'), ''
  union all
  select 52, 'GRANT INSERT on messages to authenticated',
         exists(select 1 from information_schema.table_privileges
                 where table_schema='public' and table_name='messages'
                   and grantee='authenticated' and privilege_type='INSERT'), ''

  -- Triggers
  union all
  select 60, 'trigger: on_auth_user_created',
         exists(select 1 from information_schema.triggers
                 where trigger_schema='auth' and trigger_name='on_auth_user_created'), ''
  union all
  select 61, 'trigger: profiles_guard_privileged',
         exists(select 1 from information_schema.triggers
                 where trigger_schema='public' and trigger_name='profiles_guard_privileged'), ''
  union all
  select 62, 'trigger: blood_requests_guard',
         exists(select 1 from information_schema.triggers
                 where trigger_schema='public' and trigger_name='blood_requests_guard'), ''

  -- RPCs
  union all
  select 70, 'rpc: accept_blood_request',
         exists(select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname='accept_blood_request'), ''
  union all
  select 71, 'rpc: complete_blood_donation',
         exists(select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname='complete_blood_donation'), ''
  union all
  select 72, 'rpc: handle_new_user',
         exists(select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname='handle_new_user'), ''

  -- Realtime publication
  union all
  select 80, 'realtime: profiles',
         exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='profiles'), ''
  union all
  select 81, 'realtime: blood_requests',
         exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='blood_requests'), ''
  union all
  select 82, 'realtime: request_responses',
         exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='request_responses'), ''
  union all
  select 83, 'realtime: messages',
         exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages'), ''

  -- Views
  union all
  select 90, 'view: public_profiles',
         exists(select 1 from information_schema.views where table_schema='public' and table_name='public_profiles'), ''
)
select
  ord,
  check_name,
  case when ok then 'PASS' else 'FAIL' end as status
from checks
order by ord;
