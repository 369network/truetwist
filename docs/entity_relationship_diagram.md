# TrueTwist Entity Relationship Diagram (ERD)
## Database Schema Documentation

### Overview
The TrueTwist database schema is designed to support a comprehensive social media automation platform with AI-powered content generation, multi-platform posting, competitor analysis, and viral trend tracking.

### Core Entities & Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE SCHEMA ERD                            │
└─────────────────────────────────────────────────────────────────────────────┘

                                    users
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                   │                  │
               subscriptions      businesses         social_accounts
                    │                   │                  │
               teams (owner)            │                  │
                    │              competitors            │
               team_members             │                  │
                    │              competitor_posts       │
                    │                   │                  │
                    │                   │                  │
                    │                   │                  │
                    └───────────────────┼──────────────────┘
                                        │
                                        ▼
                                      posts
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
               post_media          post_platforms      ai_generations
                                        │
                                  post_analytics
                                        │
                                  queue_jobs
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
               queue_metrics       rate_limits        audit_logs


               content_templates    viral_trends    viral_suggestions
                    (standalone)        │                   │
                                        └──────────┬────────┘
                                                   │
                                             (many-to-many)
```

### Detailed Entity Descriptions

#### 1. **Users & Authentication**
- **users**: Core user accounts with profile information and subscription tier
- **subscriptions**: Subscription management with Stripe integration
- **teams**: Collaborative workspaces for content management
- **team_members**: Team membership with role-based permissions

**Relationships:**
- `users 1───* subscriptions` (One user can have multiple subscription records)
- `users 1───* teams` (User can own multiple teams)
- `teams *───* users` through `team_members` (Many-to-many with roles)

#### 2. **Business Profiles**
- **businesses**: Business profiles for content generation (brand voice, target audience)
- **competitors**: Competitor tracking across social platforms
- **competitor_posts**: Scraped competitor content for analysis

**Relationships:**
- `users 1───* businesses` (User can manage multiple businesses)
- `businesses 1───* competitors` (Each business tracks multiple competitors)
- `competitors 1───* competitor_posts` (Competitor's historical posts)

#### 3. **Social Accounts**
- **social_accounts**: Connected social media accounts for auto-posting

**Relationships:**
- `users 1───* social_accounts` (User can connect multiple social accounts)
- `social_accounts` ──┐
                      │ (Used by post_platforms for publishing)
                      └─────────┘

#### 4. **Content Management**
- **posts**: Master content records (captions, articles, scripts)
- **post_media**: Media attachments (images, videos, audio)
- **post_platforms**: Cross-platform publishing status
- **post_analytics**: Performance metrics from social platforms

**Relationships:**
- `users 1───* posts` (User creates multiple posts)
- `businesses 0..1───* posts` (Posts optionally associated with a business)
- `posts 1───* post_media` (Post can have multiple media files)
- `posts 1───* post_platforms` (Post published to multiple platforms)
- `post_platforms 1───* post_analytics` (Analytics per platform publication)

#### 5. **AI Generation**
- **ai_generations**: Track AI model usage, costs, and outputs
- **content_templates**: Reusable content templates for different platforms

**Relationships:**
- `users 1───* ai_generations` (User's AI generation history)
- `content_templates` (Standalone, referenced by application logic)

#### 6. **Viral Research**
- **viral_trends**: Discovered viral trends from social platforms
- **viral_suggestions**: AI-generated content suggestions based on trends

**Relationships:**
- `viral_trends 1───* viral_suggestions` (Trend can inspire multiple suggestions)
- `users 1───* viral_suggestions` (User receives personalized suggestions)

#### 7. **Auto-Posting Queue System**
- **queue_jobs**: Bull queue job tracking and status
- **queue_metrics**: Queue performance monitoring
- **rate_limits**: API rate limit tracking per platform/user

**Relationships:**
- `post_platforms 0..1───* queue_jobs` (Queue jobs for publishing posts)
- `queue_jobs` → `queue_metrics` (Aggregated metrics)
- `users *───* rate_limits` (Rate limits per user per platform)

#### 8. **System Tables**
- **audit_logs**: Audit trail for all user actions
- **scheduled_jobs**: Cron job configurations
- **api_keys**: API key management for external integrations

### Key Foreign Key Relationships

```sql
-- Core user relationships
users.id → subscriptions.user_id
users.id → teams.owner_id
users.id → businesses.user_id
users.id → social_accounts.user_id
users.id → posts.user_id
users.id → ai_generations.user_id
users.id → viral_suggestions.user_id

-- Business relationships
businesses.id → competitors.business_id
businesses.id → posts.business_id

-- Content relationships
posts.id → post_media.post_id
posts.id → post_platforms.post_id
post_platforms.id → post_analytics.post_platform_id
post_platforms.id → queue_jobs.post_platform_id

-- Competitor relationships
competitors.id → competitor_posts.competitor_id

-- Viral research relationships
viral_trends.id → viral_suggestions.trend_id

-- Queue relationships
queue_jobs.post_platform_id → post_platforms.id
rate_limits.user_id → users.id
```

### Index Strategy

#### Primary Indexes
- All tables have `id` as PRIMARY KEY (UUID)
- Foreign key columns are indexed for join performance

#### Performance Indexes
1. **User-centric queries:**
   - `idx_posts_user_status` (user_id, status)
   - `idx_posts_user_id` (user_id)
   - `idx_social_accounts_user_id` (user_id)

2. **Scheduling queries:**
   - `idx_posts_scheduled_for` (scheduled_for)
   - `idx_post_platforms_status_scheduled` (status, scheduled_at) WHERE status IN ('pending', 'scheduled')

3. **Analytics queries:**
   - `idx_post_analytics_fetched_at` (fetched_at DESC)
   - `idx_competitor_posts_competitor_posted` (competitor_id, posted_at DESC)

4. **Queue management:**
   - `idx_queue_jobs_status_created` (status, created_at)
   - `idx_queue_metrics_measured_at` (measured_at)

### Data Types & Constraints

#### UUID Primary Keys
- All tables use UUID v4 for primary keys
- Enables distributed systems and avoids sequential ID bottlenecks

#### JSONB for Flexible Data
- `target_audience_json`, `colors_json` in `businesses`
- `engagement_json` in `competitor_posts`
- `platform_specs_json` in `post_media`
- `template_json` in `content_templates`
- `engagement_metrics_json` in `viral_trends`
- `payload` in `queue_jobs`

#### Enumerated Types (CHECK constraints)
- `plan` in `users`: ('free', 'starter', 'pro', 'enterprise')
- `status` in `posts`: ('draft', 'scheduled', 'queued', 'publishing', 'published', 'failed', 'archived')
- `platform` in multiple tables: ('instagram', 'tiktok', 'twitter', 'linkedin', 'facebook', 'youtube', 'threads')

#### Temporal Columns
- `created_at`, `updated_at` on all main tables
- `scheduled_for` on `posts` for future publishing
- `posted_at`, `scraped_at` for timestamp tracking

### Materialized Views

#### `monthly_posting_activity`
- Aggregates posting metrics by user per month
- Used for reporting and analytics dashboards
- Refreshed every 6 hours via scheduled job

### Data Retention Policies

| Table | Retention Period | Cleanup Function |
|-------|-----------------|------------------|
| `audit_logs` | 90 days | `cleanup_old_audit_logs()` |
| `queue_metrics` | 30 days | `cleanup_old_queue_metrics()` |
| `competitor_posts` | 180 days | `cleanup_old_competitor_posts()` |

### Validation Rules

1. **Post Scheduling**: `scheduled_for` must be in the future
2. **Viral Scores**: Must be between 0 and 10 (inclusive)
3. **Retry Limits**: `max_retries` default is 3 for queue jobs
4. **Platform Constraints**: Only supported platforms allowed

### Notification Triggers

- `notify_post_failure()`: Creates audit log entry when post publication fails
- Automatic `updated_at` updates via triggers on all main tables

### Scalability Considerations

1. **Horizontal Scaling**: UUID keys enable sharding
2. **Read Replicas**: Materialized views optimized for reporting
3. **Queue Decoupling**: Bull/Redis queue separates publishing from web requests
4. **API Rate Limiting**: Built-in tracking prevents platform API throttling
5. **Data Partitioning**: Time-based partitioning possible for large tables (audit_logs, queue_metrics)

### Migration Strategy

The schema is deployed via two main files:
1. `database_schema.sql` - Core table definitions and indexes
2. `database_migrations.sql` - Seed data, functions, and incremental changes

This separation allows for:
- Zero-downtime deployments
- Rollback capability
- Versioned schema changes
- Automated migration tracking