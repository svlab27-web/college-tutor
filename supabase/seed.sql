-- Тестовые данные для разработки. В прод не выполнять.
insert into groups (id, title, language) values
  ('00000000-0000-0000-0000-000000000001', 'Тестовая группа ПР-1', 'ru');

insert into invites (token, group_id, role) values
  ('test-student-001', '00000000-0000-0000-0000-000000000001', 'student'),
  ('test-teacher-001', '00000000-0000-0000-0000-000000000001', 'teacher');
