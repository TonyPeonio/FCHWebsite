-- Local development data only (loaded by `supabase db reset`). Never run against production.
-- Every seeded account's password is: password123
--   owner@fch.test   (owner)      office@fch.test (staff / secretary)
--   smith@fch.test   (client: Smith Residence)
--   jones@fch.test   (client: Jones Remodel)
--   lee@fch.test     (client: Lee Spec House)

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('password123', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name),
       now(), now(), '', '', '', ''
from (values
  ('00000000-0000-0000-0000-00000000000a'::uuid, 'owner@fch.test',  'Owner Test'),
  ('00000000-0000-0000-0000-00000000000b'::uuid, 'office@fch.test', 'Office Manager'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'smith@fch.test',  'Sam Smith'),
  ('00000000-0000-0000-0000-0000000000c2'::uuid, 'jones@fch.test',  'Jordan Jones'),
  ('00000000-0000-0000-0000-0000000000c3'::uuid, 'lee@fch.test',    'Lee Park')
) as u(id, email, full_name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text, jsonb_build_object('sub', id::text, 'email', email), 'email', now(), now(), now()
from auth.users where email like '%@fch.test';

update public.profiles set role = 'owner' where email = 'owner@fch.test';
update public.profiles set role = 'staff' where email = 'office@fch.test';

insert into public.projects (id, name, address, status, color, start_date, target_completion) values
  ('10000000-0000-0000-0000-000000000001', 'Smith Residence', '120 Elm St, Kalama, WA', 'active',   '#2f6f8f', current_date - 60, current_date + 210),
  ('10000000-0000-0000-0000-000000000002', 'Jones Remodel',   '44 Oak Ave, Kelso, WA',  'active',   '#b5651d', current_date - 20, current_date + 70),
  ('10000000-0000-0000-0000-000000000003', 'Lee Spec House',  '9 Hill Rd, Castle Rock, WA', 'planning', '#5b8c3a', current_date + 30, current_date + 300);

insert into public.project_members (project_id, user_id) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000c2'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000c3');

insert into public.events (id, title, notes, starts_at, ends_at, all_day, category, client_visible, created_by) values
  ('20000000-0000-0000-0000-000000000001', 'Framing inspection', 'County inspector on site.',
     ((current_date + 2) + time '10:00') at time zone 'America/Los_Angeles', ((current_date + 2) + time '11:00') at time zone 'America/Los_Angeles', false, 'Inspection', true, '00000000-0000-0000-0000-00000000000b'),
  ('20000000-0000-0000-0000-000000000002', 'Kitchen demo', null,
     (current_date + 1)::timestamp at time zone 'UTC', null, true, 'Demolition', true, '00000000-0000-0000-0000-00000000000b'),
  ('20000000-0000-0000-0000-000000000003', 'Lumber delivery (shared truck)', 'One truck drops at both sites.',
     ((current_date + 4) + time '08:00') at time zone 'America/Los_Angeles', ((current_date + 4) + time '12:00') at time zone 'America/Los_Angeles', false, 'Delivery', true, '00000000-0000-0000-0000-00000000000b'),
  ('20000000-0000-0000-0000-000000000004', 'Call plumber re: rough-in pricing', 'Internal — do not show client.',
     ((current_date + 3) + time '09:00') at time zone 'America/Los_Angeles', null, false, 'Internal', false, '00000000-0000-0000-0000-00000000000b'),
  ('20000000-0000-0000-0000-000000000005', 'Office closed', null,
     (current_date + 7)::timestamp at time zone 'UTC', null, true, 'Office', true, '00000000-0000-0000-0000-00000000000b');

insert into public.event_projects (event_id, project_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003');

insert into public.selections (id, project_id, title, instructions, due_date, status, created_by) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Master bath floor tile',
     'Pick one of the options below, or upload a photo of something you like at the tile store.', current_date + 10, 'requested', '00000000-0000-0000-0000-00000000000a'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Kitchen cabinet color',
     'Let us know the paint color name/code.', current_date + 5, 'requested', '00000000-0000-0000-0000-00000000000a');

insert into public.selection_options (id, selection_id, label, description, sort_order) values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Gray porcelain 12x24', 'Matte finish, included in allowance', 1),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'White marble-look hex', 'Adds about $400', 2),
  ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'Wood-look plank', 'Warm oak tone, included in allowance', 3);

insert into public.quote_requests (name, email, phone, address, message, status, submitted_at) values
  ('Pat Example', 'pat@example.com', '360-555-0100', '1 Sample Ln, Longview, WA 98632',
   'Looking to build a 3 bed / 2 bath rambler next spring. Plans to follow.', 'new', now() - interval '1 day');
