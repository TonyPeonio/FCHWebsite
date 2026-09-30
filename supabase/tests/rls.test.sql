-- Row Level Security tests. Run with: npx supabase test db
-- Uses the users/projects/events from seed.sql:
--   Smith (c1) -> project 1, Jones (c2) -> project 2, Lee (c3) -> project 3
--   events: 1 -> P1, 2 -> P2, 3 -> P1+P2, 4 -> P1 staff-only, 5 -> P1+P2+P3
begin;
select no_plan();

-- Test fixtures: a visible and a hidden document in P1, and one in P2.
insert into storage.objects (bucket_id, name) values
  ('project-files', '10000000-0000-0000-0000-000000000001/docs/visible.pdf'),
  ('project-files', '10000000-0000-0000-0000-000000000001/docs/hidden.pdf'),
  ('project-files', '10000000-0000-0000-0000-000000000002/docs/jones.pdf');
insert into public.documents (project_id, storage_path, file_name, kind, client_visible) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001/docs/visible.pdf', 'visible.pdf', 'plan', true),
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001/docs/hidden.pdf', 'hidden.pdf', 'contract', false),
  ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002/docs/jones.pdf', 'jones.pdf', 'plan', true);

create function pg_temp.login(uid uuid, aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
$$;

---------------------------------------------------------------------------- Smith (client, P1)
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');

select results_eq($$ select name from projects $$, $$ values ('Smith Residence') $$, 'Smith sees only his project');
select results_eq(
  $$ select title from events order by title $$,
  $$ values ('Framing inspection'), ('Lumber delivery (shared truck)'), ('Office closed') $$,
  'Smith sees events tagged to P1 (incl. shared ones) but not P2-only or staff-only events');
select is((select count(*) from event_projects where project_id <> '10000000-0000-0000-0000-000000000001'), 0::bigint,
  'Smith cannot see which other projects a shared event is tagged to');
select results_eq($$ select title from selections $$, $$ values ('Master bath floor tile') $$, 'Smith sees only his selections');
select is((select count(*) from selection_options), 3::bigint, 'Smith sees options on his selection');
select is((select count(*) from quote_requests), 0::bigint, 'Clients cannot read quote requests');
select is((select count(*) from profiles), 1::bigint, 'Clients see only their own profile');
select results_eq($$ select file_name from documents $$, $$ values ('visible.pdf') $$, 'Smith sees only client-visible docs in P1');
select results_eq(
  $$ select name from storage.objects where bucket_id = 'project-files' $$,
  $$ values ('10000000-0000-0000-0000-000000000001/docs/visible.pdf') $$,
  'Storage: Smith can only download client-visible files from his project');

update selections set status = 'approved';
select is((select status::text from selections where id = '30000000-0000-0000-0000-000000000001'), 'requested',
  'Clients cannot update selections directly (e.g. self-approve)');
select throws_ok($$ update profiles set role = 'owner' where id = auth.uid() $$, '42501', null, 'Clients cannot change their role');
select lives_ok($$ update profiles set full_name = 'Sam S.' where id = auth.uid() $$, 'Clients can edit their own name');
select throws_ok($$ insert into events (title, starts_at) values ('x', now()) $$, '42501', null, 'Clients cannot create events');
select throws_ok(
  $$ insert into documents (project_id, storage_path, file_name, kind)
     values ('10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002/uploads/x.pdf', 'x.pdf', 'other') $$,
  '42501', null, 'Smith cannot add documents to the Jones project');
select lives_ok(
  $$ insert into documents (project_id, storage_path, file_name, kind)
     values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001/uploads/idea.jpg', 'idea.jpg', 'photo') $$,
  'Smith can upload to his own project');
select throws_ok(
  $$ insert into documents (project_id, storage_path, file_name, kind)
     values ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001/uploads/c.pdf', 'c.pdf', 'contract') $$,
  '42501', null, 'Clients cannot upload "contract" documents');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('project-files', '10000000-0000-0000-0000-000000000002/uploads/x.pdf') $$,
  '42501', null, 'Storage: Smith cannot upload into the Jones folder');

select throws_ok($$ select submit_selection('30000000-0000-0000-0000-000000000002', 'hi') $$, 'P0002', null,
  'Smith cannot answer the Jones selection');
select throws_ok($$ select submit_selection('30000000-0000-0000-0000-000000000001', 'x', '00000000-0000-0000-0000-000000000000') $$,
  'P0001', null, 'Option must belong to the selection');
select lives_ok($$ select submit_selection('30000000-0000-0000-0000-000000000001', 'Love the gray', '31000000-0000-0000-0000-000000000001') $$,
  'Smith can submit his selection');
select is((select status::text from selections where id = '30000000-0000-0000-0000-000000000001'), 'submitted', 'Selection is now submitted');
select throws_ok($$ select submit_selection('30000000-0000-0000-0000-000000000001', 'again') $$, 'P0001', null,
  'Cannot resubmit once submitted');
select throws_ok($$ select decide_selection('30000000-0000-0000-0000-000000000001', true) $$, '42501', null,
  'Clients cannot approve selections');

---------------------------------------------------------------------------- Jones & Lee
select pg_temp.login('00000000-0000-0000-0000-0000000000c2');
select results_eq(
  $$ select title from events order by title $$,
  $$ values ('Kitchen demo'), ('Lumber delivery (shared truck)'), ('Office closed') $$,
  'Jones sees P2 events and the shared ones, not Smith-only events');
select results_eq($$ select file_name from documents $$, $$ values ('jones.pdf') $$, 'Jones sees only his docs');

select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
select results_eq($$ select title from events $$, $$ values ('Office closed') $$, 'Lee sees only the event tagged to P3');
select is((select count(*) from selections), 0::bigint, 'Lee has no selections');

---------------------------------------------------------------------------- Staff without 2FA
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'aal1');
select is(is_staff(), false, 'Staff without 2FA are not treated as staff');
select is((select count(*) from projects), 0::bigint, 'Staff without 2FA see no projects');
select is((select count(*) from quote_requests), 0::bigint, 'Staff without 2FA see no quotes');

---------------------------------------------------------------------------- Staff with 2FA
select pg_temp.login('00000000-0000-0000-0000-00000000000b', 'aal2');
select is(is_staff(), true, 'Staff with 2FA are staff');
select is((select count(*) from projects), 3::bigint, 'Staff see all projects');
select is((select count(*) from events), 5::bigint, 'Staff see all events, including staff-only');
select is((select count(*) from quote_requests), 1::bigint, 'Staff see quote requests');
select is((select count(*) from documents), 4::bigint, 'Staff see all documents');
select lives_ok($$ select decide_selection('30000000-0000-0000-0000-000000000001', true, 'Ordering it') $$, 'Staff can approve');
select throws_ok($$ select set_user_role('00000000-0000-0000-0000-0000000000c1', 'staff') $$, '42501', null,
  'Only the owner can change roles');
select throws_ok($$ update profiles set role = 'owner' where id = auth.uid() $$, '42501', null,
  'Staff cannot promote themselves');

---------------------------------------------------------------------------- Owner
select pg_temp.login('00000000-0000-0000-0000-00000000000a', 'aal2');
select lives_ok($$ select set_user_role('00000000-0000-0000-0000-0000000000c3', 'staff') $$, 'Owner can change roles');
select throws_ok($$ select set_user_role(auth.uid(), 'client') $$, 'P0001', null, 'Owner cannot demote themselves');

---------------------------------------------------------------------------- Anonymous
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from projects), 0::bigint, 'Anonymous users see nothing');
select is((select count(*) from events), 0::bigint, 'Anonymous users see no events');
select throws_ok($$ insert into quote_requests (email) values ('x@y.z') $$, '42501', null,
  'Anonymous users cannot write quotes directly (only through the edge function)');

select * from finish();
rollback;
