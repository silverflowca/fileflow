# FileFlow Railway Deployment Guide

## Quick Deploy (Automated)

### Option 1: Interactive Setup Script
```bash
chmod +x scripts/railway-setup.sh
./scripts/railway-setup.sh
```

This script will:
- Install Railway CLI if needed
- Create/link Railway project
- Prompt for Supabase credentials
- Configure all environment variables
- Generate secure JWT secret
- Show GitHub secrets to add
- Optionally deploy immediately

### Option 2: GitHub Actions (CI/CD)

Push to `main` branch and it auto-deploys. First, add these **GitHub Secrets**:

| Secret | Description | Where to get it |
|--------|-------------|-----------------|
| `RAILWAY_TOKEN` | Railway API token | [Railway Tokens](https://railway.app/account/tokens) |
| `SUPABASE_URL` | Project URL | Supabase > Settings > API |
| `SUPABASE_ANON_KEY` | Public anon key | Supabase > Settings > API |
| `SUPABASE_SERVICE_KEY` | Service role key | Supabase > Settings > API |
| `JWT_SECRET` | Auth secret | Generate: `openssl rand -base64 32` |
| `SUPABASE_DB_URL` | Database connection | Supabase > Settings > Database > URI |

Then push:
```bash
git push origin main
```

### Trigger Migrations
Include `[migrate]` in your commit message:
```bash
git commit -m "Add new feature [migrate]"
git push
```

Or manually trigger via GitHub Actions UI with "Run database migrations" checked.

---

## Manual Deploy

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

### 2. Create Project
```bash
cd fileflow
railway init --name fileflow
```

### 3. Set Environment Variables
```bash
railway variables set \
  NODE_ENV="production" \
  SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  SUPABASE_SERVICE_KEY="your-service-role-key" \
  JWT_SECRET="$(openssl rand -base64 32)" \
  VITE_API_URL="/api" \
  VITE_SUPABASE_URL="https://YOUR_PROJECT.supabase.co" \
  VITE_SUPABASE_ANON_KEY="your-anon-key"
```

### 4. Run Migrations
```bash
# Connect to Supabase and run each migration
psql "postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres" \
  -f migrations/001_fileflow_schema.sql
# Repeat for 002-009...
```

### 5. Deploy
```bash
railway up
```

---

## Environment Variables Reference

### Build-time (Vite)
| Variable | Example | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `/api` | API base path |
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Supabase public key |

### Runtime (Server)
| Variable | Example | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode |
| `PORT` | `8680` | Server port (Railway sets automatically) |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | Supabase service role key |
| `JWT_SECRET` | `random-32-chars` | JWT signing secret |

---

## Troubleshooting

### Deployment fails at build
- Check build logs: `railway logs`
- Verify VITE_* variables are set as build args

### "Invalid schema" error
- Migrations haven't run
- Run migrations manually or push with `[migrate]` tag

### Auth not working
- Verify JWT_SECRET matches between builds
- Check SUPABASE_SERVICE_KEY is correct

### View logs
```bash
railway logs -f
```

### Open dashboard
```bash
railway open
```
