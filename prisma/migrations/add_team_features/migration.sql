-- Team Invites
CREATE TABLE IF NOT EXISTS "team_invites" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'viewer',
    "token" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "accepted_at" TIMESTAMPTZ,
    "revoked_at" TIMESTAMPTZ,
    "invited_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "team_invites_token_key" UNIQUE ("token"),
    CONSTRAINT "team_invites_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE,
    CONSTRAINT "team_invites_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "team_invites_team_id_idx" ON "team_invites"("team_id");
CREATE INDEX IF NOT EXISTS "team_invites_email_idx" ON "team_invites"("email");
CREATE INDEX IF NOT EXISTS "team_invites_token_idx" ON "team_invites"("token");

-- Activity Log
CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "activity_logs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE,
    CONSTRAINT "activity_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "activity_logs_team_id_idx" ON "activity_logs"("team_id");
CREATE INDEX IF NOT EXISTS "activity_logs_user_id_idx" ON "activity_logs"("user_id");
CREATE INDEX IF NOT EXISTS "activity_logs_created_at_idx" ON "activity_logs"("created_at");

-- Post Comments
CREATE TABLE IF NOT EXISTS "post_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "mentions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "post_comments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "post_comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE,
    CONSTRAINT "post_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id")
);
CREATE INDEX IF NOT EXISTS "post_comments_post_id_idx" ON "post_comments"("post_id");
CREATE INDEX IF NOT EXISTS "post_comments_user_id_idx" ON "post_comments"("user_id");

-- Add business_ids to team_members for per-business access control
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "business_ids" JSONB NOT NULL DEFAULT '[]';

-- Add team_id to businesses for multi-business per-team
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "team_id" UUID;
CREATE INDEX IF NOT EXISTS "businesses_team_id_idx" ON "businesses"("team_id");

-- Add approval workflow fields to posts
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "approved_by_id" UUID REFERENCES "users"("id");
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "rejected_by_id" UUID REFERENCES "users"("id");
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMPTZ;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;
