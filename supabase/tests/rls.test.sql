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

-- Thumbnails for the P1 files, and a photo in the owner's photo dump (library/, no project).
insert into storage.objects (bucket_id, name) values
  ('project-files', '10000000-0000-0000-0000-000000000001/docs/thumbs/visible.jpg'),
  ('project-files', '10000000-0000-0000-0000-000000000001/docs/thumbs/hidden.jpg'),
  ('project-files', 'library/dump.jpg'),
  ('project-files', 'library/thumbs/dump.jpg');
update public.documents set thumb_path = '10000000-0000-0000-0000-000000000001/docs/thumbs/visible.jpg' where file_name = 'visible.pdf';
update public.documents set thumb_path = '10000000-0000-0000-0000-000000000001/docs/thumbs/hidden.jpg' where file_name = 'hidden.pdf';
insert into public.documents (project_id, storage_path, thumb_path, file_name, kind) values
  (null, 'library/dump.jpg', 'library/thumbs/dump.jpg', 'dump.jpg', 'photo');

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
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
select results_eq($$ select name from calendar_projects() $$, $$ values ('Smith Residence') $$,
  'Clients get only their own projects for the calendar');
select throws_ok($$ insert into event_categories (name) values ('Client category') $$, '42501', null,
  'Clients cannot add calendar categories');
select results_eq(
  $$ select name from storage.objects where bucket_id = 'project-files' order by name $$,
  $$ values ('10000000-0000-0000-0000-000000000001/docs/thumbs/visible.jpg'), ('10000000-0000-0000-0000-000000000001/docs/visible.pdf') $$,
  'Storage: Smith can only download client-visible files (and their thumbnails) from his project');
select throws_ok(
  $$ insert into documents (project_id, storage_path, file_name, kind) values (null, 'library/mine.jpg', 'mine.jpg', 'photo') $$,
  '42501', null, 'Clients cannot add to the photo dump');

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

---------------------------------------------------------------------------- Staff (calendar only)
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select is(is_staff(), true, 'Staff accounts are staff');
select is((select count(*) from events), 5::bigint, 'Staff see all events, including staff-only');
select is((select count(*) from event_categories), 16::bigint, 'Staff see the calendar categories');
select throws_ok($$ insert into event_categories (name) values ('Staff category') $$, '42501', null,
  'Staff cannot add calendar categories');
delete from event_categories;
select is((select count(*) from calendar_projects()), 3::bigint, 'Staff get every project name and color for the calendar');
select is((select count(*) from projects), 0::bigint, 'Staff cannot open projects');
select is((select count(*) from selections), 0::bigint, 'Staff cannot see selections');
select is((select count(*) from selection_options), 0::bigint, 'Staff cannot see selection options');
select is((select count(*) from documents), 0::bigint, 'Staff cannot see photos or files');
select is((select count(*) from storage.objects where bucket_id in ('project-files', 'quote-uploads')), 0::bigint,
  'Staff cannot download photos or files');
select is((select count(*) from quote_requests), 0::bigint, 'Staff cannot see website inquiries');
select is((select count(*) from profiles), 1::bigint, 'Staff see only their own profile');
select is((select count(*) from project_members), 0::bigint, 'Staff cannot see who belongs to which project');
-- Staff can't change anything; changes that wouldn't raise an error are checked as the owner below.
select throws_ok($$ select decide_selection('30000000-0000-0000-0000-000000000001', true) $$, '42501', null,
  'Staff cannot approve selections');
select throws_ok($$ insert into events (title, starts_at) values ('x', now()) $$, '42501', null, 'Staff cannot add calendar events');
update events set title = 'changed by staff';
select is((select count(*) from events where title = 'changed by staff'), 0::bigint, 'Staff cannot edit calendar events');
delete from events;
select is((select count(*) from events), 5::bigint, 'Staff cannot delete calendar events');
delete from event_projects;
select is((select count(*) from event_projects), 8::bigint, 'Staff cannot change event project tags');
select throws_ok($$ insert into projects (name) values ('x') $$, '42501', null, 'Staff cannot create projects');
delete from projects;
select throws_ok($$ insert into selections (project_id, title) values ('10000000-0000-0000-0000-000000000001', 'x') $$,
  '42501', null, 'Staff cannot request selections');
select throws_ok($$ insert into project_members values ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c1') $$,
  '42501', null, 'Staff cannot add clients to projects');
update quote_requests set status = 'declined';
update documents set client_visible = true;
update documents set show_on_website = true;
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('project-files', '10000000-0000-0000-0000-000000000001/docs/x.pdf') $$,
  '42501', null, 'Staff cannot upload files');
select throws_ok($$ select set_user_role('00000000-0000-0000-0000-0000000000c1', 'staff') $$, '42501', null,
  'Only the owner can change roles');
select throws_ok($$ update profiles set role = 'owner' where id = auth.uid() $$, '42501', null,
  'Staff cannot promote themselves');

---------------------------------------------------------------------------- Owner
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select is((select count(*) from projects), 3::bigint, 'Staff could not delete projects');
select is((select count(*) from quote_requests where status = 'declined'), 0::bigint, 'Staff could not change inquiry status');
select is((select count(*) from documents where not client_visible), 1::bigint, 'Staff could not change file visibility');
select is((select count(*) from documents where show_on_website), 0::bigint, 'Staff could not put photos on the website');
select is((select count(*) from event_categories), 16::bigint, 'Staff could not remove calendar categories');
select lives_ok($$ insert into event_categories (name) values ('Landscaping') $$, 'Owner can add a calendar category');
select throws_ok($$ insert into event_categories (name) values ('  landscaping ') $$, '23505', null,
  'Calendar categories must be unique, ignoring capitals and spaces');
select throws_ok($$ insert into event_categories (name) values ('   ') $$, '23514', null, 'Calendar categories cannot be blank');
select lives_ok($$ delete from event_categories where name = 'Landscaping' $$, 'Owner can remove a calendar category');
select is((select count(*) from event_categories), 16::bigint, 'Category removed');
select lives_ok($$ insert into events (title, starts_at) values ('Owner event', now()) $$, 'Owner can add calendar events');
select lives_ok($$ update events set title = 'Framing inspection (moved)' where id = '20000000-0000-0000-0000-000000000001' $$, 'Owner can edit events');
select is((select title from events where id = '20000000-0000-0000-0000-000000000001'), 'Framing inspection (moved)', 'Owner edit saved');
select lives_ok($$ select decide_selection('30000000-0000-0000-0000-000000000001', true, 'Ordering it') $$, 'Owner can approve selections');
select lives_ok($$ insert into projects (name) values ('Owner project') $$, 'Owner can create projects');
select is((select count(*) from documents where project_id is null), 1::bigint, 'Owner sees the photo dump');
select is((select count(*) from storage.objects where name like 'library/%'), 2::bigint, 'Owner can download photo-dump files');
select lives_ok(
  $$ update documents set project_id = '10000000-0000-0000-0000-000000000001',
       storage_path = '10000000-0000-0000-0000-000000000001/docs/dump.jpg', show_on_website = true
     where storage_path = 'library/dump.jpg' $$,
  'Owner can assign a photo to a project and put it on the website');
select throws_ok(
  $$ update documents set project_id = '10000000-0000-0000-0000-000000000002' where file_name = 'dump.jpg' $$,
  '23514', null, 'A photo''s file path must match its project');
select lives_ok($$ select set_user_role('00000000-0000-0000-0000-0000000000c3', 'staff') $$, 'Owner can change roles');
select throws_ok($$ select set_user_role(auth.uid(), 'client') $$, 'P0001', null, 'Owner cannot demote themselves');

---------------------------------------------------------------------------- Anonymous
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*) from projects), 0::bigint, 'Anonymous users see nothing');
select is((select count(*) from events), 0::bigint, 'Anonymous users see no events');
select is((select count(*) from event_categories), 0::bigint, 'Anonymous users see no calendar categories');
select throws_ok($$ select * from calendar_projects() $$, '42501', null, 'Anonymous users cannot list projects');
select is((select count(*) from documents), 0::bigint, 'Anonymous users see no photos, even ones on the website');
select throws_ok($$ insert into quote_requests (email) values ('x@y.z') $$, '42501', null,
  'Anonymous users cannot write quotes directly (only through the edge function)');

select * from finish();
rollback;
