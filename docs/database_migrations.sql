-- TrueTwist Database Migrations
-- Version: 1.0.0
-- Created: 2026-04-04

-- ============================================
-- MIGRATION 001: INITIAL SCHEMA
-- ============================================

-- This file contains additional migrations and seed data

-- ============================================
-- SEED DATA: CONTENT TEMPLATES
-- ============================================

-- System content templates for different platforms
INSERT INTO content_templates (id, name, category, platform, template_json, is_system_template, created_at) VALUES
-- Instagram templates
(
    uuid_generate_v4(),
    'Product Launch Announcement',
    'announcement',
    'instagram',
    '{
        "structure": ["hook", "problem", "solution", "benefits", "cta"],
        "hook_variations": ["🚀 Big news!", "Introducing...", "The wait is over!", "We''re excited to announce..."],
        "cta_variations": ["Learn more in bio", "Swipe up for details", "Comment your thoughts", "Tag someone who needs this"],
        "hashtag_suggestions": ["#newproduct", "#launchday", "#innovation", "#tech"],
        "character_limit": 2200,
        "media_requirements": ["square_or_portrait", "high_quality", "brand_colors"]
    }',
    TRUE,
    NOW()
),
(
    uuid_generate_v4(),
    'Behind The Scenes',
    'engagement',
    'instagram',
    '{
        "structure": ["context", "process", "team", "value"],
        "hook_variations": ["Ever wondered how we...", "A peek behind the curtain", "How it''s made", "Our secret sauce"],
        "cta_variations": ["What should we show next?", "Ask us anything in comments", "Double tap if you want more BTS"],
        "hashtag_suggestions": ["#behindthescenes", "#bts", "#process", "#teamwork"],
        "character_limit": 2200,
        "media_requirements": ["casual", "authentic", "team_photos", "process_shots"]
    }',
    TRUE,
    NOW()
),

-- TikTok templates
(
    uuid_generate_v4(),
    'Problem-Solution Format',
    'educational',
    'tiktok',
    '{
        "structure": ["problem", "struggle", "solution", "result"],
        "hook_variations": ["Struggling with...?", "The mistake everyone makes", "I fixed this in 30 seconds", "Stop doing this..."],
        "cta_variations": ["Follow for more tips", "Save this for later", "Comment if this helped", "What should I cover next?"],
        "hashtag_suggestions": ["#tips", "#hack", "#learnontiktok", "#howto"],
        "character_limit": 150,
        "media_requirements": ["vertical_video", "text_overlay", "quick_cuts", "clear_audio"]
    }',
    TRUE,
    NOW()
),

-- LinkedIn templates
(
    uuid_generate_v4(),
    'Industry Insight',
    'thought_leadership',
    'linkedin',
    '{
        "structure": ["observation", "analysis", "implication", "recommendation"],
        "hook_variations": ["3 trends shaping our industry", "What most people miss about...", "The future of...", "Why I believe..."],
        "cta_variations": ["What are your thoughts?", "Agree or disagree?", "Share your experience", "Connect for more insights"],
        "hashtag_suggestions": ["#industryinsights", "#thoughtleadership", "#business", "#strategy"],
        "character_limit": 3000,
        "media_requirements": ["professional", "data_visualization", "clean_design", "brand_aligned"]
    }',
    TRUE,
    NOW()
),

-- Twitter templates
(
    uuid_generate_v4(),
    'Thread Starter',
    'engagement',
    'twitter',
    '{
        "structure": ["hook_tweet", "point_1", "point_2", "point_3", "conclusion"],
        "hook_variations": ["A thread on...", "Let''s talk about...", "You might not know this about...", "Breaking down..."],
        "cta_variations": ["Retweet if helpful", "Follow for more threads", "What would you add?", "Read the full thread below"],
        "hashtag_suggestions": ["#thread", "#twitterthread", "#knowledge", "#insights"],
        "character_limit": 280,
        "media_requirements": ["thread_format", "numbered_points", "visual_breaks", "engagement_hooks"]
    }',
    TRUE,
    NOW()
);

-- ============================================
-- MIGRATION 002: PERFORMANCE OPTIMIZATIONS
-- ============================================

-- Create materialized views for reporting

-- Monthly posting activity view
CREATE MATERIALIZED VIEW monthly_posting_activity AS
SELECT 
    DATE_TRUNC('month', p.created_at) AS month,
    u.id AS user_id,
    COUNT(DISTINCT p.id) AS total_posts,
    COUNT(DISTINCT CASE WHEN pp.status = 'published' THEN pp.id END) AS published_posts,
    COUNT(DISTINCT CASE WHEN pp.status = 'failed' THEN pp.id END) AS failed_posts,
    AVG(pa.engagement_rate) AS avg_engagement_rate
FROM users u
LEFT JOIN posts p ON p.user_id = u.id
LEFT JOIN post_platforms pp ON pp.post_id = p.id
LEFT JOIN post_analytics pa ON pa.post_platform_id = pp.id
GROUP BY DATE_TRUNC('month', p.created_at), u.id;

CREATE UNIQUE INDEX idx_monthly_posting_activity_month_user ON monthly_posting_activity(month, user_id);
CREATE INDEX idx_monthly_posting_activity_month ON monthly_posting_activity(month);

-- Refresh function for materialized views
CREATE OR REPLACE FUNCTION refresh_reporting_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_posting_activity;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION 003: DATA RETENTION POLICIES
-- ============================================

-- Create cleanup functions for old data

-- Cleanup old audit logs (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old queue metrics (keep 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_queue_metrics()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM queue_metrics 
    WHERE measured_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old competitor posts (keep 180 days)
CREATE OR REPLACE FUNCTION cleanup_old_competitor_posts()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM competitor_posts 
    WHERE posted_at < NOW() - INTERVAL '180 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION 004: DATA VALIDATION FUNCTIONS
-- ============================================

-- Validate post scheduling time (must be in future)
CREATE OR REPLACE FUNCTION validate_post_schedule()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.scheduled_for IS NOT NULL AND NEW.scheduled_for <= NOW() THEN
        RAISE EXCEPTION 'Scheduled time must be in the future';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_post_schedule_trigger 
BEFORE INSERT OR UPDATE ON posts 
FOR EACH ROW EXECUTE FUNCTION validate_post_schedule();

-- Validate viral score range
CREATE OR REPLACE FUNCTION validate_viral_score()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.viral_score IS NOT NULL AND (NEW.viral_score < 0 OR NEW.viral_score > 10) THEN
        RAISE EXCEPTION 'Viral score must be between 0 and 10';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_viral_score_trigger 
BEFORE INSERT OR UPDATE ON posts 
FOR EACH ROW EXECUTE FUNCTION validate_viral_score();

CREATE TRIGGER validate_viral_suggestion_score_trigger 
BEFORE INSERT OR UPDATE ON viral_suggestions 
FOR EACH ROW EXECUTE FUNCTION validate_viral_score();

-- ============================================
-- MIGRATION 005: NOTIFICATION FUNCTIONS
-- ============================================

-- Function to notify when post fails
CREATE OR REPLACE FUNCTION notify_post_failure()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'failed' AND OLD.status != 'failed' THEN
        -- In a real system, this would call a notification service
        -- For now, we log to audit_logs
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes_json)
        SELECT 
            p.user_id,
            'post_failed',
            'post_platform',
            NEW.id,
            jsonb_build_object(
                'post_id', NEW.post_id,
                'platform', NEW.platform,
                'error_message', NEW.error_message,
                'retry_count', NEW.retry_count
            )
        FROM posts p
        WHERE p.id = NEW.post_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_post_failure_trigger 
AFTER UPDATE ON post_platforms 
FOR EACH ROW EXECUTE FUNCTION notify_post_failure();

-- ============================================
-- MIGRATION 006: SCHEDULED JOBS CONFIGURATION
-- ============================================

-- Table for scheduled job configurations
CREATE TABLE scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    cron_expression VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed scheduled jobs
INSERT INTO scheduled_jobs (job_name, description, cron_expression, is_active) VALUES
('cleanup_old_data', 'Cleanup old audit logs and metrics', '0 2 * * *', TRUE), -- Daily at 2 AM
('refresh_materialized_views', 'Refresh reporting materialized views', '0 */6 * * *', TRUE), -- Every 6 hours
('scrape_competitor_posts', 'Scrape competitor posts from social platforms', '0 */4 * * *', TRUE), -- Every 4 hours
('process_viral_trends', 'Process and score viral trends', '0 */3 * * *', TRUE), -- Every 3 hours
('retry_failed_posts', 'Retry failed post publications', '*/15 * * * *', TRUE); -- Every 15 minutes

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_jobs_updated_at BEFORE UPDATE ON scheduled_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION 007: API KEY MANAGEMENT
-- ============================================

-- API keys for external integrations
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    scopes JSONB NOT NULL DEFAULT '[]',
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- Trigger for updated_at
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Record migration completion
INSERT INTO audit_logs (action, resource_type, changes_json) VALUES
('migration_completed', 'database', '{"version": "1.0.0", "migrations": ["001_initial_schema", "002_performance_optimizations", "003_data_retention", "004_data_validation", "005_notifications", "006_scheduled_jobs", "007_api_keys"]}');