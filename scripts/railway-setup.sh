#!/bin/bash

# FileFlow Railway Setup Script
# This script helps configure Railway deployment with all required variables

set -e

echo "=========================================="
echo "  FileFlow Railway Setup"
echo "=========================================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway if not already
echo "Checking Railway authentication..."
railway whoami || railway login

# Create or link project
echo ""
echo "Do you want to create a new Railway project or link to existing?"
echo "1) Create new project"
echo "2) Link to existing project"
read -p "Choice (1/2): " choice

if [ "$choice" = "1" ]; then
    echo ""
    read -p "Enter project name (e.g., fileflow): " project_name
    railway init --name "$project_name"
else
    railway link
fi

echo ""
echo "=========================================="
echo "  Environment Variables Setup"
echo "=========================================="
echo ""
echo "You'll need the following from your Supabase project:"
echo "  - Project URL (Settings > API > Project URL)"
echo "  - Anon Key (Settings > API > anon public)"
echo "  - Service Role Key (Settings > API > service_role secret)"
echo "  - Database URL (Settings > Database > Connection string)"
echo ""

# Collect Supabase credentials
read -p "Supabase Project URL: " supabase_url
read -p "Supabase Anon Key: " supabase_anon_key
read -p "Supabase Service Role Key: " supabase_service_key

# Generate JWT secret
jwt_secret=$(openssl rand -base64 32)
echo ""
echo "Generated JWT Secret: $jwt_secret"

# Set Railway variables
echo ""
echo "Setting Railway environment variables..."

railway variables set \
    NODE_ENV="production" \
    SUPABASE_URL="$supabase_url" \
    SUPABASE_SERVICE_KEY="$supabase_service_key" \
    JWT_SECRET="$jwt_secret" \
    VITE_API_URL="/api" \
    VITE_SUPABASE_URL="$supabase_url" \
    VITE_SUPABASE_ANON_KEY="$supabase_anon_key"

echo ""
echo "=========================================="
echo "  GitHub Secrets Setup"
echo "=========================================="
echo ""
echo "Add these secrets to your GitHub repository:"
echo "(Settings > Secrets and variables > Actions > New repository secret)"
echo ""
echo "RAILWAY_TOKEN       = $(railway whoami --json 2>/dev/null | grep -o '"token":"[^"]*' | cut -d'"' -f4 || echo '<run: railway login --browserless>')"
echo "SUPABASE_URL        = $supabase_url"
echo "SUPABASE_ANON_KEY   = $supabase_anon_key"
echo "SUPABASE_SERVICE_KEY = $supabase_service_key"
echo "JWT_SECRET          = $jwt_secret"
echo ""

# Ask about database URL for migrations
read -p "Do you want to set up automatic migrations? (y/n): " setup_migrations
if [ "$setup_migrations" = "y" ]; then
    echo ""
    echo "Get your database URL from Supabase:"
    echo "Settings > Database > Connection string > URI"
    read -p "Supabase Database URL: " supabase_db_url
    echo ""
    echo "Add this GitHub secret for migrations:"
    echo "SUPABASE_DB_URL = $supabase_db_url"
fi

echo ""
echo "=========================================="
echo "  Ready to Deploy!"
echo "=========================================="
echo ""
echo "Option 1: Deploy now"
echo "  railway up"
echo ""
echo "Option 2: Push to GitHub (auto-deploys)"
echo "  git add . && git commit -m 'Deploy to Railway' && git push"
echo ""
echo "Option 3: Deploy with migrations"
echo "  git commit -m 'Deploy [migrate]' && git push"
echo ""

read -p "Deploy now? (y/n): " deploy_now
if [ "$deploy_now" = "y" ]; then
    echo "Deploying to Railway..."
    railway up
    echo ""
    echo "Deployment started! Check Railway dashboard for status."
    railway open
fi
