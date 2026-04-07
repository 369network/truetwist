# TrueTwist Backend Setup Guide

## Environment Variables Required

### Supabase (PostgreSQL + Auth)
```
NEXT_PUBLIC_SUPABASE_URL="https://epvjonsvymxmryqwgrjn.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key-from-supabase-dashboard"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-from-supabase-dashboard"
DATABASE_URL="postgresql://postgres:[password]@db.epvjonsvymxmryqwgrjn.supabase.co:5432/postgres"
DIRECT_URL="postgresql://postgres:[password]@db.epvjonsvymxmryqwgrjn.supabase.co:5432/postgres"
```

### Authentication
```
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
JWT_SECRET="generate-with: openssl rand -base64 32"
JWT_REFRESH_SECRET="generate-with: openssl rand -base64 32"
```

### Redis (Rate Limiting & Caching)
```
REDIS_URL="redis://localhost:6379"  # or Upstash/Redis Cloud URL
```

### Email Service (Resend)
```
RESEND_API_KEY="your-resend-api-key"
```

### AI Services
```
OPENAI_API_KEY="your-openai-api-key"
RUNWAY_API_KEY="your-runway-api-key"
RUNWAY_API_URL="https://api.dev.runwayml.com/v1"
```

### File Storage (Cloudflare R2)
```
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key"
R2_SECRET_ACCESS_KEY="your-r2-secret-key"
R2_BUCKET_NAME="truetwist-media"
```

### Application
```
NEXT_PUBLIC_APP_URL="https://your-domain.com"
NODE_ENV="production"
```

## Database Setup Steps

1. **Apply Prisma Migrations:**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

2. **Apply Supabase Migrations:**
   - Run the SQL in `supabase/migrations/20250407150000_create_waitlist_table.sql` in Supabase SQL editor

3. **Verify Database Connection:**
   ```bash
   npx prisma studio  # Open Prisma Studio to verify data
   ```

## Security Checklist

- [ ] All API keys are stored in environment variables
- [ ] JWT secrets are cryptographically secure
- [ ] Rate limiting is enabled for all public endpoints
- [ ] CORS is properly configured
- [ ] SQL injection prevention (Prisma handles this)
- [ ] XSS protection headers are set
- [ ] HTTPS is enforced in production

## Monitoring Setup

1. **Error Tracking:** Sentry is already integrated
2. **Performance Monitoring:** Add Datadog/New Relic APM
3. **Logging:** Configure structured logging to CloudWatch/LogDNA
4. **Health Checks:** Implement `/api/v1/health` endpoint monitoring

## Backup Procedures

1. **Database Backups:**
   - Enable Supabase automated backups
   - Daily snapshots with 30-day retention
   - Test restore procedures quarterly

2. **File Storage Backups:**
   - Configure R2 versioning
   - Cross-region replication for critical assets

## Scaling Considerations

1. **Database:**
   - Monitor connection pool usage
   - Set up read replicas for analytics queries
   - Implement database connection pooling (PgBouncer)

2. **Redis:**
   - Use Redis Cluster for high availability
   - Monitor memory usage and eviction policies

3. **API Servers:**
   - Implement horizontal scaling
   - Use load balancer with health checks
   - Configure auto-scaling based on CPU/memory

## Troubleshooting Common Issues

1. **Database Connection Errors:**
   - Check firewall rules for Supabase
   - Verify connection string format
   - Test with `psql` command line

2. **Authentication Issues:**
   - Verify JWT secrets match across instances
   - Check token expiration times
   - Validate CORS settings for auth endpoints

3. **Rate Limiting Problems:**
   - Check Redis connection
   - Verify rate limit configuration per plan
   - Monitor for abuse patterns
