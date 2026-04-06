-- Viral Research Service Migration
-- Extends viral_trends, adds hashtag analysis, trend alerts, collection tracking

-- Add new columns to viral_trends
ALTER TABLE "viral_trends" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "viral_trends" ADD COLUMN IF NOT EXISTS "velocity" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "viral_trends" ADD COLUMN IF NOT EXISTS "acceleration" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "viral_trends" ADD COLUMN IF NOT EXISTS "sentiment" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "viral_trends" ADD COLUMN IF NOT EXISTS "lifecycle" TEXT NOT NULL DEFAULT 'emerging';
ALTER TABLE "viral_trends" ADD COLUMN IF NOT EXISTS "region" TEXT NOT NULL DEFAULT 'US';
ALTER TABLE "viral_trends" ADD COLUMN IF NOT EXISTS "raw_payload" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "viral_trends" ADD COLUMN IF NOT EXISTS "peaked_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "viral_trends" ADD COLUMN IF NOT EXISTS "last_updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- Add unique constraint for deduplication
CREATE UNIQUE INDEX IF NOT EXISTS "viral_trends_platform_source_title_region_key" ON "viral_trends"("platform", "source", "title", "region");
CREATE INDEX IF NOT EXISTS "viral_trends_source_idx" ON "viral_trends"("source");
CREATE INDEX IF NOT EXISTS "viral_trends_lifecycle_idx" ON "viral_trends"("lifecycle");
CREATE INDEX IF NOT EXISTS "viral_trends_discovered_at_idx" ON "viral_trends"("discovered_at");

-- Trend snapshots (time-series for lifecycle tracking)
CREATE TABLE IF NOT EXISTS "trend_snapshots" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "trend_id" UUID NOT NULL REFERENCES "viral_trends"("id") ON DELETE CASCADE,
    "viral_score" DOUBLE PRECISION NOT NULL,
    "velocity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume" INTEGER NOT NULL DEFAULT 0,
    "sentiment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "snapshot_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "trend_snapshots_trend_id_idx" ON "trend_snapshots"("trend_id");
CREATE INDEX IF NOT EXISTS "trend_snapshots_snapshot_at_idx" ON "trend_snapshots"("snapshot_at");

-- Viral suggestions
CREATE TABLE IF NOT EXISTS "viral_suggestions" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "trend_id" UUID REFERENCES "viral_trends"("id") ON DELETE SET NULL,
    "suggested_content" TEXT NOT NULL,
    "viral_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "accepted_at" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "viral_suggestions_user_id_idx" ON "viral_suggestions"("user_id");
CREATE INDEX IF NOT EXISTS "viral_suggestions_trend_id_idx" ON "viral_suggestions"("trend_id");
CREATE INDEX IF NOT EXISTS "viral_suggestions_status_idx" ON "viral_suggestions"("status");

-- Hashtags
CREATE TABLE IF NOT EXISTS "hashtags" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "tag" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "competition_level" TEXT NOT NULL DEFAULT 'medium',
    "trend_direction" TEXT NOT NULL DEFAULT 'stable',
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "related_tags" JSONB NOT NULL DEFAULT '[]',
    "last_updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "hashtags_tag_platform_key" ON "hashtags"("tag", "platform");
CREATE INDEX IF NOT EXISTS "hashtags_platform_idx" ON "hashtags"("platform");
CREATE INDEX IF NOT EXISTS "hashtags_competition_level_idx" ON "hashtags"("competition_level");
CREATE INDEX IF NOT EXISTS "hashtags_trend_direction_idx" ON "hashtags"("trend_direction");
CREATE INDEX IF NOT EXISTS "hashtags_is_banned_idx" ON "hashtags"("is_banned");

-- Trend-hashtag join table
CREATE TABLE IF NOT EXISTS "trend_hashtags" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "trend_id" UUID NOT NULL REFERENCES "viral_trends"("id") ON DELETE CASCADE,
    "hashtag_id" UUID NOT NULL REFERENCES "hashtags"("id") ON DELETE CASCADE,
    "relevance" DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "trend_hashtags_trend_id_hashtag_id_key" ON "trend_hashtags"("trend_id", "hashtag_id");

-- Trend alerts
CREATE TABLE IF NOT EXISTS "trend_alerts" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "trend_id" UUID REFERENCES "viral_trends"("id") ON DELETE SET NULL,
    "alert_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "trend_alerts_user_id_idx" ON "trend_alerts"("user_id");
CREATE INDEX IF NOT EXISTS "trend_alerts_alert_type_idx" ON "trend_alerts"("alert_type");
CREATE INDEX IF NOT EXISTS "trend_alerts_created_at_idx" ON "trend_alerts"("created_at");
CREATE INDEX IF NOT EXISTS "trend_alerts_read_at_idx" ON "trend_alerts"("read_at");

-- Trend alert preferences
CREATE TABLE IF NOT EXISTS "trend_alert_preferences" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "business_id" UUID,
    "niche_keywords" JSONB NOT NULL DEFAULT '[]',
    "platforms" JSONB NOT NULL DEFAULT '[]',
    "min_viral_score" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "alert_types" JSONB NOT NULL DEFAULT '["trend_emerging","niche_match"]',
    "digest_frequency" TEXT NOT NULL DEFAULT 'daily',
    "webhook_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "trend_alert_preferences_user_id_business_id_key" ON "trend_alert_preferences"("user_id", "business_id");
CREATE INDEX IF NOT EXISTS "trend_alert_preferences_user_id_idx" ON "trend_alert_preferences"("user_id");
CREATE INDEX IF NOT EXISTS "trend_alert_preferences_is_active_idx" ON "trend_alert_preferences"("is_active");

-- Trend collection job tracking
CREATE TABLE IF NOT EXISTS "trend_collection_jobs" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "source" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'US',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "trends_found" INTEGER NOT NULL DEFAULT 0,
    "trends_updated" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP WITH TIME ZONE,
    "completed_at" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "trend_collection_jobs_source_idx" ON "trend_collection_jobs"("source");
CREATE INDEX IF NOT EXISTS "trend_collection_jobs_status_idx" ON "trend_collection_jobs"("status");
CREATE INDEX IF NOT EXISTS "trend_collection_jobs_created_at_idx" ON "trend_collection_jobs"("created_at");
