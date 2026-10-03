-- Generate the superadmin user for Ceylona Gems
DO $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  -- Delete the user if it was partially created earlier
  DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'superadmin-ceylona-gems@buildstart.io');
  DELETE FROM auth.users WHERE email = 'superadmin-ceylona-gems@buildstart.io';
  DELETE FROM "Ceylon_gems".staff_accounts WHERE staff_email = 'superadmin-ceylona-gems@buildstart.io';

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, recovery_sent_at, last_sign_in_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', 'superadmin-ceylona-gems@buildstart.io',
    crypt('RfP1T&onACDpLr', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), new_user_id, new_user_id::text, format('{"sub":"%s","email":"%s"}', new_user_id::text, 'superadmin-ceylona-gems@buildstart.io')::jsonb, 'email', now(), now(), now()
  );

  UPDATE "Ceylon_gems".user_roles SET role = 'super_admin' WHERE user_id = new_user_id;

  INSERT INTO "Ceylon_gems".staff_accounts (owner_id, staff_user_id, staff_email, permissions)
  VALUES (new_user_id, new_user_id, 'superadmin-ceylona-gems@buildstart.io', ARRAY['all']);
END $$;
