-- Fix infinite recursion in RLS policies
-- The issue: folders policy references permissions, permissions policy references folders
-- Solution: Break the cycle by simplifying the policies

-- ============ Fix Permissions Table Policies ============

-- Drop existing policies
DROP POLICY IF EXISTS "Owners can manage permissions" ON fileflow.permissions;
DROP POLICY IF EXISTS "Users can view permissions for accessible resources" ON fileflow.permissions;

-- Create simpler policies that don't reference folders/files with complex subqueries
-- For permissions, we just need to check if the user is the grantor or grantee

-- Policy: Users can view permissions where they are the grantee
CREATE POLICY "Users can view their permissions"
    ON fileflow.permissions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policy: Users can view/manage permissions for files they own (direct ownership check)
CREATE POLICY "Owners can view file permissions"
    ON fileflow.permissions FOR SELECT
    TO authenticated
    USING (
        file_id IS NOT NULL AND
        file_id IN (SELECT id FROM fileflow.files WHERE owner_id = auth.uid())
    );

-- Policy: Owners can manage permissions on their files
CREATE POLICY "Owners can manage file permissions"
    ON fileflow.permissions FOR ALL
    TO authenticated
    USING (
        file_id IS NOT NULL AND
        file_id IN (SELECT id FROM fileflow.files WHERE owner_id = auth.uid())
    )
    WITH CHECK (
        file_id IS NOT NULL AND
        file_id IN (SELECT id FROM fileflow.files WHERE owner_id = auth.uid())
    );

-- Policy: Owners can manage permissions on their folders (direct ownership check)
CREATE POLICY "Owners can manage folder permissions"
    ON fileflow.permissions FOR ALL
    TO authenticated
    USING (
        folder_id IS NOT NULL AND
        folder_id IN (SELECT id FROM fileflow.folders WHERE owner_id = auth.uid())
    )
    WITH CHECK (
        folder_id IS NOT NULL AND
        folder_id IN (SELECT id FROM fileflow.folders WHERE owner_id = auth.uid())
    );

-- ============ Fix Folders Table Policies ============

-- Drop the problematic policies that reference permissions
DROP POLICY IF EXISTS "Users can update own folders" ON fileflow.folders;
DROP POLICY IF EXISTS "Users can view accessible folders" ON fileflow.folders;

-- Recreate with simpler logic that doesn't cause recursion
-- For viewing: owner can always see, others need explicit permission check
-- But we need to avoid the recursion, so we use a different approach

-- Simple owner-based SELECT policy
CREATE POLICY "Owners can view own folders"
    ON fileflow.folders FOR SELECT
    TO authenticated
    USING (deleted_at IS NULL AND owner_id = auth.uid());

-- Shared folders policy - uses a function to break the recursion
CREATE OR REPLACE FUNCTION fileflow.user_can_access_folder(folder_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = fileflow, public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM fileflow.permissions p
        WHERE p.folder_id = $1
        AND p.user_id = auth.uid()
    );
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION fileflow.user_can_access_folder(uuid) TO authenticated;

-- Policy for shared folders (uses SECURITY DEFINER function to break cycle)
CREATE POLICY "Users can view shared folders"
    ON fileflow.folders FOR SELECT
    TO authenticated
    USING (deleted_at IS NULL AND fileflow.user_can_access_folder(id));

-- Simple UPDATE policy - only owners
CREATE POLICY "Owners can update own folders"
    ON fileflow.folders FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- ============ Ensure files policies are also fixed ============

-- Check and fix files policies similarly
DROP POLICY IF EXISTS "Users can view accessible files" ON fileflow.files;

CREATE POLICY "Owners can view own files"
    ON fileflow.files FOR SELECT
    TO authenticated
    USING (deleted_at IS NULL AND owner_id = auth.uid());

-- Function for shared files
CREATE OR REPLACE FUNCTION fileflow.user_can_access_file(file_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = fileflow, public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM fileflow.permissions p
        WHERE p.file_id = $1
        AND p.user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION fileflow.user_can_access_file(uuid) TO authenticated;

CREATE POLICY "Users can view shared files"
    ON fileflow.files FOR SELECT
    TO authenticated
    USING (deleted_at IS NULL AND fileflow.user_can_access_file(id));

-- ============ Add comments ============
COMMENT ON POLICY "Users can view their permissions" ON fileflow.permissions IS
'Allows users to see permissions granted to them';

COMMENT ON POLICY "Owners can view own folders" ON fileflow.folders IS
'Allows folder owners to view their folders';

COMMENT ON POLICY "Users can view shared folders" ON fileflow.folders IS
'Allows users to view folders shared with them via permissions';
