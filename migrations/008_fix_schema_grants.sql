-- Migration: Fix schema grants for all roles
-- Description: Ensures service_role, authenticated, and anon have proper access to fileflow schema

-- Grant schema usage
GRANT USAGE ON SCHEMA fileflow TO service_role;
GRANT USAGE ON SCHEMA fileflow TO authenticated;
GRANT USAGE ON SCHEMA fileflow TO anon;

-- Grant service_role full access to all tables and sequences
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA fileflow TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA fileflow TO service_role;

-- Grant authenticated role full access to tables and sequences (RLS handles row-level permissions)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA fileflow TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA fileflow TO authenticated;

-- Grant anon role select access for public endpoints
GRANT SELECT ON ALL TABLES IN SCHEMA fileflow TO anon;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA fileflow
  GRANT ALL PRIVILEGES ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA fileflow
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA fileflow
  GRANT ALL PRIVILEGES ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA fileflow
  GRANT ALL PRIVILEGES ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA fileflow
  GRANT SELECT ON TABLES TO anon;
