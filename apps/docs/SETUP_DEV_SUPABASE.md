# Setup Development Supabase Database

## 1. Create Project

1. Go to [database.new](https://database.new)
2. Create new project: `fitnudge-dev`
3. Choose region (same as production)
4. Set database password

## 2. Get Credentials

**Settings** → **API**:

- Copy **Project URL**
- Copy **anon/public key**

## 3. Link Supabase CLI to Dev Project

```bash
cd apps/api

# Login to Supabase (if not already)
supabase login

# Link to your dev project
supabase link --project-ref YOUR_PROJECT_REF

# Get project ref from URL: https://[PROJECT_REF].supabase.co
```

## 4. Push Database Schema

```bash
cd apps/api

# Push all migrations to dev database
supabase db push

# Verify migrations ran
supabase db diff
```

This will:

- Create all tables
- Enable Realtime on 20 tables
- Set up RLS policies
- Apply all schema changes

## 5. Seed Development Data (Optional)

```bash
# If you have seed data
supabase db reset --db-url postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

Or manually insert test data via Supabase Dashboard.

## 6. Update Mobile App

Edit `apps/mobile/.env`:

```env
# Development Supabase (hosted)
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# Enable Realtime
# EXPO_PUBLIC_ENABLE_REALTIME=false  # Remove or set to true
```

## 7. Restart Metro

```bash
cd apps/mobile
yarn start --clear
```

## 8. Verify Realtime Works

Check logs for:

```
[Realtime] Channel created for users, state: joined
[Realtime] users subscription status: SUBSCRIBED
✅ Successful: 20/20
```

## 9. Test Live Updates

1. Open Supabase Dashboard → Table Editor
2. Update a row in any table
3. See if app updates instantly!

---

## Environment Setup Summary

Now you have:

**Local Supabase** (for API development):

- Backend API connects here
- Fast, no network latency
- Good for API testing

**Hosted Dev Supabase** (for mobile development):

- Mobile app connects here
- Realtime works properly
- Mirrors production setup

**Production Supabase** (for production):

- Production deployments only

---

## Troubleshooting

### Can't Link Project

If `supabase link` fails:

```bash
# Get project ref from dashboard URL
# Manual link:
supabase link --project-ref abc123xyz
```

### Migrations Fail

```bash
# Check what's already applied
supabase migration list --linked

# Apply specific migration
supabase migration up --db-url "postgresql://..."
```

### Realtime Still Not Working

1. Verify migration ran: `20251203000000_enable_realtime_for_core_tables.sql`
2. Check Supabase Dashboard → Database → Replication
3. Ensure tables are in `supabase_realtime` publication
4. Check app uses correct credentials

---

## Next Steps

1. **Create dev project** on Supabase
2. **Run migrations** (`supabase db push`)
3. **Update mobile `.env`** with dev credentials
4. **Test Realtime** - should work now!
5. **Continue development** with confidence
