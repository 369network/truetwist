-- Content feedback table for AI recommendation feedback loop (TRUA-66)
-- Records user actions on AI-generated content to improve future generation quality.

CREATE TABLE IF NOT EXISTS "content_feedbacks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "generation_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "platform" TEXT,
    "edit_distance" DOUBLE PRECISION,
    "post_id" UUID,
    "signal_weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "content_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "content_feedbacks_user_id_idx" ON "content_feedbacks"("user_id");
CREATE INDEX IF NOT EXISTS "content_feedbacks_generation_id_idx" ON "content_feedbacks"("generation_id");
CREATE INDEX IF NOT EXISTS "content_feedbacks_action_idx" ON "content_feedbacks"("action");
CREATE INDEX IF NOT EXISTS "content_feedbacks_created_at_idx" ON "content_feedbacks"("created_at");

ALTER TABLE "content_feedbacks"
    ADD CONSTRAINT "content_feedbacks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_feedbacks"
    ADD CONSTRAINT "content_feedbacks_generation_id_fkey"
    FOREIGN KEY ("generation_id") REFERENCES "ai_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
