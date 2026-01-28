-- Fix RLS policy for file uploads
-- The original policy was too restrictive and required users to exist in profiles table
-- with proper storage quota. This update makes it more permissive for development.

-- Drop the existing upload policy
DROP POLICY IF EXISTS "Users can upload files" ON fileflow.files;

-- Create a more permissive policy
-- Users can upload if:
-- 1. They are the owner (owner_id matches their auth.uid())
-- 2. Either no profile exists (allow for new users), or they have quota
CREATE POLICY "Users can upload files"
    ON fileflow.files FOR INSERT
    TO authenticated
    WITH CHECK (
        owner_id = auth.uid() AND (
            -- Either no profile exists (first-time upload, profile will be auto-created)
            NOT EXISTS (SELECT 1 FROM fileflow.profiles WHERE id = auth.uid())
            OR
            -- Or user has storage quota
            (SELECT COALESCE(storage_used_bytes, 0) + size_bytes <= COALESCE(storage_quota_bytes, 10737418240)
             FROM fileflow.profiles WHERE id = auth.uid())
        )
    );

-- Also ensure the profile auto-creation trigger works for authenticated users
-- who don't have a profile yet

-- Create or replace the profile creation function
CREATE OR REPLACE FUNCTION fileflow.ensure_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Create profile if it doesn't exist
    INSERT INTO fileflow.profiles (id, email, display_name, storage_quota_bytes)
    SELECT
        auth.uid(),
        COALESCE(
            (SELECT email FROM auth.users WHERE id = auth.uid()),
            'user@fileflow.app'
        ),
        COALESCE(
            (SELECT raw_user_meta_data->>'display_name' FROM auth.users WHERE id = auth.uid()),
            'User'
        ),
        10737418240 -- 10GB default
    WHERE NOT EXISTS (
        SELECT 1 FROM fileflow.profiles WHERE id = auth.uid()
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on files table to auto-create profile before insert
DROP TRIGGER IF EXISTS ensure_profile_on_file_upload ON fileflow.files;
CREATE TRIGGER ensure_profile_on_file_upload
    BEFORE INSERT ON fileflow.files
    FOR EACH ROW
    EXECUTE FUNCTION fileflow.ensure_user_profile();

-- Grant execute on the function
GRANT EXECUTE ON FUNCTION fileflow.ensure_user_profile() TO authenticated;

-- Also allow profiles insert for authenticated users (for self-registration)
DROP POLICY IF EXISTS "Users can create own profile" ON fileflow.profiles;
CREATE POLICY "Users can create own profile"
    ON fileflow.profiles FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

COMMENT ON POLICY "Users can upload files" ON fileflow.files IS
'Allows authenticated users to upload files. Auto-creates profile if missing.';
