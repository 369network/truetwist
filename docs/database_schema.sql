-- TrueTwist Database Schema
-- Version: 1.0.0
-- Created: 2026-04-04

-- Enable UUID extension for PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_users_email (email),
    INDEX idx_users_plan (plan),
    INDEX idx_users_created_at (created_at)
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL CHECK (plan IN ('starter', 'pro', 'enterprise')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid')),
    stripe_customer_id VARCHAR(255) UNIQUE,
    stripe_subscription_id VARCHAR(255) UNIQUE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_subscriptions_user_id (user_id),
    INDEX idx_subscriptions_status (status),
    INDEX idx_subscriptions_current_period_end (current_period_end)
);

-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_teams_owner_id (owner_id)
);

-- Team members table
CREATE TABLE team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE,
    invited_by UUID REFERENCES users(id),
    
    PRIMARY KEY (team_id, user_id),
    
    -- Indexes
    INDEX idx_team_members_user_id (user_id),
    INDEX idx_team_members_role (role)
);

-- ============================================
-- BUSINESS PROFILES
-- ============================================

-- Businesses table
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    description TEXT,
    website VARCHAR(255),
    target_audience_json JSONB DEFAULT '{}',
    brand_voice TEXT,
    logo_url TEXT,
    colors_json JSONB DEFAULT '{"primary": "#3B82F6", "secondary": "#10B981", "accent": "#8B5CF6"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_businesses_user_id (user_id),
    INDEX idx_businesses_industry (industry)
);

-- Competitors table
CREATE TABLE competitors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'linkedin', 'facebook', 'youtube', 'threads')),
    handle VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    last_scraped_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_competitors_business_id (business_id),
    INDEX idx_competitors_platform (platform),
    UNIQUE (business_id, platform, handle)
);

-- Competitor posts table
CREATE TABLE competitor_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'linkedin', 'facebook', 'youtube', 'threads')),
    post_url TEXT NOT NULL,
    content TEXT,
    engagement_json JSONB DEFAULT '{"likes": 0, "comments": 0, "shares": 0, "saves": 0, "views": 0}',
    posted_at TIMESTAMP WITH TIME ZONE,
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_competitor_posts_competitor_id (competitor_id),
    INDEX idx_competitor_posts_platform (platform),
    INDEX idx_competitor_posts_posted_at (posted_at),
    UNIQUE (competitor_id, post_url)
);

-- ============================================
-- SOCIAL ACCOUNTS
-- ============================================

-- Social accounts table
CREATE TABLE social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'linkedin', 'facebook', 'youtube', 'threads')),
    account_id VARCHAR(255) NOT NULL,
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    account_name VARCHAR(255) NOT NULL,
    profile_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_social_accounts_user_id (user_id),
    INDEX idx_social_accounts_platform (platform),
    INDEX idx_social_accounts_is_active (is_active),
    UNIQUE (user_id, platform, account_id)
);

-- ============================================
-- CONTENT MANAGEMENT
-- ============================================

-- Posts table (master content)
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    content_text TEXT NOT NULL,
    content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('caption', 'article', 'script', 'hook', 'cta')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('draft', 'scheduled', 'queued', 'publishing', 'published', 'failed', 'archived')),
    ai_generated BOOLEAN DEFAULT FALSE,
    viral_score DECIMAL(3,2) CHECK (viral_score >= 0 AND viral_score <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scheduled_for TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    INDEX idx_posts_user_id (user_id),
    INDEX idx_posts_business_id (business_id),
    INDEX idx_posts_status (status),
    INDEX idx_posts_scheduled_for (scheduled_for),
    INDEX idx_posts_viral_score (viral_score DESC)
);

-- Post media table
CREATE TABLE post_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('image', 'video', 'audio', 'gif', 'document')),
    media_url TEXT NOT NULL,
    alt_text TEXT,
    platform_specs_json JSONB DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_post_media_post_id (post_id),
    INDEX idx_post_media_media_type (media_type)
);

-- Post platforms table (cross-posting to different platforms)
CREATE TABLE post_platforms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'linkedin', 'facebook', 'youtube', 'threads')),
    platform_post_id VARCHAR(255),
    scheduled_at TIMESTAMP WITH TIME ZONE,
    posted_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'scheduled', 'publishing', 'published', 'failed', 'canceled')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_post_platforms_post_id (post_id),
    INDEX idx_post_platforms_platform (platform),
    INDEX idx_post_platforms_status (status),
    INDEX idx_post_platforms_scheduled_at (scheduled_at),
    UNIQUE (post_id, platform)
);

-- Post analytics table
CREATE TABLE post_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_platform_id UUID NOT NULL REFERENCES post_platforms(id) ON DELETE CASCADE,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    engagement_rate DECIMAL(5,4),
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_post_analytics_post_platform_id (post_platform_id),
    INDEX idx_post_analytics_fetched_at (fetched_at)
);

-- ============================================
-- AI GENERATION
-- ============================================

-- AI generations table
CREATE TABLE ai_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    model_used VARCHAR(100) NOT NULL,
    output_text TEXT,
    output_media_url TEXT,
    tokens_used INTEGER,
    cost_cents INTEGER,
    generation_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_ai_generations_user_id (user_id),
    INDEX idx_ai_generations_model_used (model_used),
    INDEX idx_ai_generations_created_at (created_at DESC)
);

-- Content templates table
CREATE TABLE content_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'linkedin', 'facebook', 'youtube', 'threads', 'all')),
    template_json JSONB NOT NULL,
    is_system_template BOOLEAN DEFAULT FALSE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_content_templates_category (category),
    INDEX idx_content_templates_platform (platform),
    INDEX idx_content_templates_is_system_template (is_system_template)
);

-- ============================================
-- VIRAL RESEARCH
-- ============================================

-- Viral trends table
CREATE TABLE viral_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'linkedin', 'facebook', 'youtube', 'threads')),
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    example_url TEXT,
    engagement_metrics_json JSONB DEFAULT '{}',
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    trend_score DECIMAL(3,2) CHECK (trend_score >= 0 AND trend_score <= 10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_viral_trends_platform (platform),
    INDEX idx_viral_trends_category (category),
    INDEX idx_viral_trends_trend_score (trend_score DESC),
    INDEX idx_viral_trends_discovered_at (discovered_at DESC)
);

-- Viral suggestions table
CREATE TABLE viral_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trend_id UUID REFERENCES viral_trends(id) ON DELETE SET NULL,
    suggested_content TEXT NOT NULL,
    viral_score DECIMAL(3,2) CHECK (viral_score >= 0 AND viral_score <= 10),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'implemented')),
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_viral_suggestions_user_id (user_id),
    INDEX idx_viral_suggestions_trend_id (trend_id),
    INDEX idx_viral_suggestions_status (status),
    INDEX idx_viral_suggestions_viral_score (viral_score DESC)
);

-- ============================================
-- AUTO-POSTING QUEUE TABLES
-- ============================================

-- Queue jobs table (for tracking Bull jobs)
CREATE TABLE queue_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id VARCHAR(255) NOT NULL UNIQUE, -- Bull job ID
    queue_name VARCHAR(100) NOT NULL,
    job_type VARCHAR(100) NOT NULL,
    post_platform_id UUID REFERENCES post_platforms(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('waiting', 'active', 'completed', 'failed', 'delayed', 'stuck')),
    payload JSONB NOT NULL,
    attempts_made INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    failed_reason TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_queue_jobs_job_id (job_id),
    INDEX idx_queue_jobs_queue_name (queue_name),
    INDEX idx_queue_jobs_status (status),
    INDEX idx_queue_jobs_post_platform_id (post_platform_id),
    INDEX idx_queue_jobs_created_at (created_at)
);

-- Queue metrics table
CREATE TABLE queue_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    queue_name VARCHAR(100) NOT NULL,
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('waiting', 'active', 'completed', 'failed', 'delayed', 'stuck')),
    count INTEGER NOT NULL,
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_queue_metrics_queue_name (queue_name),
    INDEX idx_queue_metrics_metric_type (metric_type),
    INDEX idx_queue_metrics_measured_at (measured_at)
);

-- Rate limit tracking table
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'linkedin', 'facebook', 'youtube', 'threads')),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    count INTEGER DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    window_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_rate_limits_platform (platform),
    INDEX idx_rate_limits_user_id (user_id),
    INDEX idx_rate_limits_action_type (action_type),
    INDEX idx_rate_limits_window_start (window_start),
    UNIQUE (platform, user_id, action_type, window_start)
);

-- ============================================
-- AUDIT LOGS
-- ============================================

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    changes_json JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Indexes
    INDEX idx_audit_logs_user_id (user_id),
    INDEX idx_audit_logs_action (action),
    INDEX idx_audit_logs_resource_type (resource_type),
    INDEX idx_audit_logs_created_at (created_at DESC)
);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_competitors_updated_at BEFORE UPDATE ON competitors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_social_accounts_updated_at BEFORE UPDATE ON social_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_post_platforms_updated_at BEFORE UPDATE ON post_platforms FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_templates_updated_at BEFORE UPDATE ON content_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_viral_trends_updated_at BEFORE UPDATE ON viral_trends FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_viral_suggestions_updated_at BEFORE UPDATE ON viral_suggestions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INDEX OPTIMIZATION
-- ============================================

-- Additional composite indexes for common queries
CREATE INDEX idx_posts_user_status ON posts(user_id, status);
CREATE INDEX idx_posts_business_status ON posts(business_id, status);
CREATE INDEX idx_post_platforms_status_scheduled ON post_platforms(status, scheduled_at) WHERE status IN ('pending', 'scheduled');
CREATE INDEX idx_queue_jobs_status_created ON queue_jobs(status, created_at);
CREATE INDEX idx_competitor_posts_competitor_posted ON competitor_posts(competitor_id, posted_at DESC);
CREATE INDEX idx_post_analytics_platform_fetched ON post_analytics(fetched_at DESC);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE users IS 'User accounts for TrueTwist platform';
COMMENT ON TABLE subscriptions IS 'User subscription plans and billing information';
COMMENT ON TABLE teams IS 'Teams for collaborative content management';
COMMENT ON TABLE team_members IS 'Team membership and roles';
COMMENT ON TABLE businesses IS 'Business profiles for content generation';
COMMENT ON TABLE competitors IS 'Competitor tracking for social media';
COMMENT ON TABLE competitor_posts IS 'Competitor posts scraped from social platforms';
COMMENT ON TABLE social_accounts IS 'User social media accounts for auto-posting';
COMMENT ON TABLE posts IS 'Master content posts for scheduling and publishing';
COMMENT ON TABLE post_media IS 'Media attachments for posts';
COMMENT ON TABLE post_platforms IS 'Cross-platform posting status and scheduling';
COMMENT ON TABLE post_analytics IS 'Post performance analytics from social platforms';
COMMENT ON TABLE ai_generations IS 'AI model usage tracking and cost management';
COMMENT ON TABLE content_templates IS 'Content templates for different platforms and categories';
COMMENT ON TABLE viral_trends IS 'Viral trends discovered from social platforms';
COMMENT ON TABLE viral_suggestions IS 'AI-generated viral content suggestions for users';
COMMENT ON TABLE queue_jobs IS 'Bull queue job tracking and monitoring';
COMMENT ON TABLE queue_metrics IS 'Queue performance metrics for monitoring';
COMMENT ON TABLE rate_limits IS 'Rate limit tracking for social platform APIs';
COMMENT ON TABLE audit_logs IS 'Audit trail for user actions and system changes';