-- Create default admin user for FileFlow
-- This migration creates an admin user in Supabase Auth and the fileflow.profiles table
-- Default credentials: admin@fileflow.local / FileFlow2024!

-- Step 1: Create the user in auth.users
-- Note: The password hash is for 'FileFlow2024!' using bcrypt
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'a0000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'admin@fileflow.local',
    crypt('FileFlow2024!', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{"display_name": "FileFlow Admin", "is_admin": true}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- Step 2: Create identity for the user
INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    jsonb_build_object(
        'sub', 'a0000000-0000-0000-0000-000000000001',
        'email', 'admin@fileflow.local',
        'email_verified', true
    ),
    'email',
    'a0000000-0000-0000-0000-000000000001',
    NOW(),
    NOW(),
    NOW()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Step 3: Create profile for the admin user
INSERT INTO fileflow.profiles (
    id,
    email,
    display_name,
    storage_quota_bytes,
    storage_used_bytes,
    created_at,
    updated_at
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@fileflow.local',
    'FileFlow Admin',
    107374182400, -- 100GB quota for admin
    0,
    NOW(),
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- Add admin role to metadata (for future admin features)
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "admin"}'::jsonb
WHERE id = 'a0000000-0000-0000-0000-000000000001';
