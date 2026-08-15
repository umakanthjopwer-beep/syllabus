-- DEVELOPMENT DRAFT ONLY. DO NOT RUN ON PRODUCTION WITHOUT FINAL REVIEW.
-- Purpose: close direct Data API exposure found in the 15 Aug 2026 read-only preflight.
-- The multi-branch app uses branch-aware Edge Functions with custom app_sessions; browser clients
-- must not get direct table authority over operational school data.

begin;

-- 1) Three current public tables have RLS disabled and broad anon/authenticated grants.
-- Remove direct Data API table access first, then enable RLS as defense in depth.
revoke all privileges on table public.app_settings from anon, authenticated;
revoke all privileges on table public.weekly_entry_requests from anon, authenticated;
revoke all privileges on table public.safe_yearplan_recapture_state from anon, authenticated;

alter table public.app_settings enable row level security;
alter table public.weekly_entry_requests enable row level security;
alter table public.safe_yearplan_recapture_state enable row level security;

-- No anon/authenticated policies are intentionally created for these tables.
-- Branch-aware Edge Functions use the server service role after custom session authorization.

-- 2) SECURITY DEFINER trigger helper is currently exposed as an RPC to PUBLIC/anon/authenticated.
-- It is a trigger function and should not be a client-callable RPC.
revoke execute on function public.enforce_weekly_status_role_scope() from public, anon, authenticated;

-- 3) Pin search_path on legacy trigger functions flagged by the security advisor.
alter function public.khalsa_recapture_state_from_plan() set search_path = public, pg_temp;
alter function public.khalsa_block_recapture_week_delete() set search_path = public, pg_temp;
alter function public.khalsa_merge_recapture_week_insert() set search_path = public, pg_temp;

-- Verification queries for the controlled cutover environment:
-- select grantee,table_name,privilege_type from information_schema.role_table_grants
-- where table_schema='public' and grantee in ('anon','authenticated')
-- and table_name in ('app_settings','weekly_entry_requests','safe_yearplan_recapture_state');
-- Expected: no rows.
--
-- select c.relname,t.tgname,p.proname
-- from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid
-- where not t.tgisinternal and p.proname in
-- ('enforce_weekly_status_role_scope','khalsa_recapture_state_from_plan',
--  'khalsa_block_recapture_week_delete','khalsa_merge_recapture_week_insert');
-- Expected: all four triggers still present.

rollback;
