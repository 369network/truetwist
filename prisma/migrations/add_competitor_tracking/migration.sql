-- Add new columns to competitor_accounts
ALTER TABLE "competitor_accounts" ADD COLUMN "following_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "competitor_accounts" ADD COLUMN "post_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "competitor_accounts" ADD COLUMN "engagement_rate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "competitor_accounts" ADD COLUMN "avg_likes" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "competitor_accounts" ADD COLUMN "avg_comments" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "competitor_accounts" ADD COLUMN "posting_frequency" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "competitor_accounts" ADD COLUMN "top_hashtags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "competitor_accounts" ADD COLUMN "content_mix" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "competitor_accounts" ADD COLUMN "peak_posting_hours" JSONB NOT NULL DEFAULT '[]';

-- Add new columns to competitor_posts
ALTER TABLE "competitor_posts" ADD COLUMN "content_type" TEXT NOT NULL DEFAULT 'text';
ALTER TABLE "competitor_posts" ADD COLUMN "hashtags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "competitor_posts" ADD COLUMN "engagement_rate" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "competitor_posts" ADD COLUMN "is_viral" BOOLEAN NOT NULL DEFAULT false;

-- Make platform_post_id unique
ALTER TABLE "competitor_posts" ADD CONSTRAINT "competitor_posts_platform_post_id_key" UNIQUE ("platform_post_id");

-- Add indexes on competitor_posts
CREATE INDEX "competitor_posts_posted_at_idx" ON "competitor_posts"("posted_at");
CREATE INDEX "competitor_posts_is_viral_idx" ON "competitor_posts"("is_viral");

-- Create competitor_account_snapshots table
CREATE TABLE "competitor_account_snapshots" (
    "id" TEXT NOT NULL,
    "competitor_account_id" TEXT NOT NULL,
    "follower_count" INTEGER NOT NULL,
    "following_count" INTEGER NOT NULL DEFAULT 0,
    "post_count" INTEGER NOT NULL DEFAULT 0,
    "engagement_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posting_frequency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_account_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "competitor_account_snapshots_competitor_account_id_idx" ON "competitor_account_snapshots"("competitor_account_id");
CREATE INDEX "competitor_account_snapshots_snapshot_at_idx" ON "competitor_account_snapshots"("snapshot_at");

ALTER TABLE "competitor_account_snapshots"
    ADD CONSTRAINT "competitor_account_snapshots_competitor_account_id_fkey"
    FOREIGN KEY ("competitor_account_id") REFERENCES "competitor_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Create competitor_alerts table
CREATE TABLE "competitor_alerts" (
    "id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "competitor_id" TEXT,
    "competitor_account_id" TEXT,
    "alert_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "competitor_alerts_business_id_idx" ON "competitor_alerts"("business_id");
CREATE INDEX "competitor_alerts_alert_type_idx" ON "competitor_alerts"("alert_type");
CREATE INDEX "competitor_alerts_created_at_idx" ON "competitor_alerts"("created_at");
