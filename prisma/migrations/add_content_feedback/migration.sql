-- CreateTable
CREATE TABLE "content_feedback" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "generation_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_feedback_user_id_idx" ON "content_feedback"("user_id");

-- CreateIndex
CREATE INDEX "content_feedback_generation_id_idx" ON "content_feedback"("generation_id");

-- CreateIndex
CREATE INDEX "content_feedback_action_idx" ON "content_feedback"("action");

-- AddForeignKey
ALTER TABLE "content_feedback" ADD CONSTRAINT "content_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_feedback" ADD CONSTRAINT "content_feedback_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "ai_generations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
