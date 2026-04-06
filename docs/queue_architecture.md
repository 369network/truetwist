# TrueTwist Auto-Posting Queue Architecture
## Redis/Bull Queue System Design

### Overview
The TrueTwist queue system uses Redis with Bull (Node.js queue library) to manage reliable, scheduled social media posting across multiple platforms. The system handles retry logic, rate limiting, timezone-aware scheduling, and dead letter queues for failed posts.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QUEUE SYSTEM ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │         Redis Cluster               │
                    │  ┌─────────────────────────────┐    │
                    │  │         Bull Queues         │    │
                    │  │  ┌─────┐ ┌─────┐ ┌─────┐   │    │
                    │  │  │Post │ │Media│ │DLQ  │   │    │
                    │  │  │Queue│ │Proc │ │Queue│   │    │
                    │  │  └─────┘ └─────┘ └─────┘   │    │
                    │  └─────────────────────────────┘    │
                    └─────────────────────────────────────┘
                                │           │           │
                    ┌───────────┼───────────┼───────────┼───────────┐
                    │           │           │           │           │
            ┌───────▼─────┐ ┌───▼───┐ ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
            │   Posting   │ │ Media │ │  Failed   │ │ Rate  │ │  Metrics  │
            │   Workers   │ │Proc   │ │ Job       │ │Limit  │ │ Collector │
            │  (x5)       │ │Worker │ │ Processor │ │Service│ │           │
            └───────┬─────┘ └───┬───┘ └─────┬─────┘ └───┬───┘ └─────┬─────┘
                    │           │           │           │           │
            ┌───────▼───────────▼───────────▼───────────▼───────────▼───────┐
            │                    PostgreSQL Database                         │
            │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
            │  │queue_jobs│ │post_plat-│ │rate_limits│ │queue_    │         │
            │  │          │ │forms     │ │          │ │metrics   │         │
            │  └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
            └───────────────────────────────────────────────────────────────┘
                    │           │           │           │           │
            ┌───────▼───────────▼───────────▼───────────▼───────────▼───────┐
            │                    External APIs                              │
            │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
            │  │Insta-│ │TikTok│ │Twitter│ │Linked│ │Face- │ │You-  │      │
            │  │gram  │ │      │ │      │ │In    │ │book  │ │Tube  │      │
            │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘      │
            └───────────────────────────────────────────────────────────────┘
```

### Queue Types & Purposes

#### 1. **Primary Queues**

| Queue Name | Purpose | Concurrency | Retry Strategy | Timeout |
|------------|---------|-------------|----------------|---------|
| `post-publishing` | Publish posts to social platforms | 5 workers | Exponential backoff (3 attempts) | 60s |
| `media-processing` | Process media (resize, format conversion) | 3 workers | Linear backoff (2 attempts) | 120s |
| `analytics-fetch` | Fetch post analytics from platforms | 2 workers | Fixed interval (3 attempts) | 30s |
| `competitor-scraping` | Scrape competitor posts | 1 worker | Exponential backoff (5 attempts) | 180s |

#### 2. **Special Queues**

| Queue Name | Purpose | Notes |
|------------|---------|-------|
| `dead-letter` | Failed jobs after max retries | Manual review required |
| `priority-posting` | Time-sensitive content | Higher priority, bypasses rate limits |
| `bulk-operations` | Batch operations (import/export) | Low priority, runs during off-peak |

### Job Data Structure

```typescript
interface PostPublishingJob {
  jobId: string;
  type: 'post-publishing';
  data: {
    postPlatformId: string;
    userId: string;
    platform: 'instagram' | 'tiktok' | 'twitter' | 'linkedin' | 'facebook' | 'youtube' | 'threads';
    content: {
      text: string;
      mediaUrls?: string[];
      hashtags?: string[];
      link?: string;
    };
    scheduleOptions: {
      scheduledFor: string; // ISO timestamp
      timezone: string;
      isPriority: boolean;
    };
    retryContext: {
      attempt: number;
      maxAttempts: number;
      lastError?: string;
    };
  };
  opts: {
    jobId: string;
    attempts: number;
    backoff: {
      type: 'exponential';
      delay: number;
    };
    timeout: number;
    priority: number;
    delay?: number; // For scheduled posts
  };
}
```

### Worker Implementation

#### Post Publishing Worker

```javascript
const PostPublishingWorker = {
  name: 'post-publishing-worker',
  concurrency: 5,
  
  async process(job) {
    const { postPlatformId, platform, content, scheduleOptions } = job.data;
    
    // 1. Check rate limits
    const canProceed = await rateLimitService.check(
      job.data.userId, 
      platform, 
      'publish'
    );
    
    if (!canProceed) {
      throw new RateLimitError(`Rate limit exceeded for ${platform}`);
    }
    
    // 2. Platform-specific API client
    const client = platformClients[platform];
    
    // 3. Upload media if present
    let mediaIds = [];
    if (content.mediaUrls?.length) {
      mediaIds = await mediaProcessor.uploadMedia(
        platform,
        content.mediaUrls,
        job.data.userId
      );
    }
    
    // 4. Publish to platform
    const result = await client.publish({
      text: content.text,
      mediaIds,
      hashtags: content.hashtags,
      link: content.link
    });
    
    // 5. Update database
    await PostPlatforms.update(postPlatformId, {
      status: 'published',
      platform_post_id: result.id,
      posted_at: new Date(),
      error_message: null
    });
    
    // 6. Record rate limit usage
    await rateLimitService.recordUsage(
      job.data.userId,
      platform,
      'publish'
    );
    
    // 7. Queue analytics fetch for later
    await analyticsQueue.add({
      postPlatformId,
      platform,
      platformPostId: result.id
    }, {
      delay: 5 * 60 * 1000, // 5 minutes delay
      attempts: 3
    });
    
    return result;
  },
  
  async onFailed(job, error) {
    // Update post status to failed
    await PostPlatforms.update(job.data.postPlatformId, {
      status: 'failed',
      error_message: error.message,
      retry_count: job.attemptsMade
    });
    
    // Log to audit trail
    await AuditLogs.create({
      userId: job.data.userId,
      action: 'post_publish_failed',
      resourceType: 'post_platform',
      resourceId: job.data.postPlatformId,
      changesJson: {
        error: error.message,
        attempt: job.attemptsMade,
        platform: job.data.platform
      }
    });
    
    // Move to dead letter queue if max attempts reached
    if (job.attemptsMade >= job.opts.attempts) {
      await deadLetterQueue.add(job.data, {
        jobId: `dlq-${job.id}`,
        timestamp: new Date()
      });
    }
  }
};
```

### Rate Limit Management

#### Rate Limit Service

```javascript
class RateLimitService {
  async check(userId, platform, action) {
    const key = `ratelimit:${userId}:${platform}:${action}`;
    const window = this.getWindow(platform, action);
    
    // Check Redis counter
    const current = await redis.get(key);
    if (current >= window.limit) {
      return false;
    }
    
    return true;
  }
  
  async recordUsage(userId, platform, action) {
    const key = `ratelimit:${userId}:${platform}:${action}`;
    const window = this.getWindow(platform, action);
    
    // Increment counter with expiry
    await redis.multi()
      .incr(key)
      .expire(key, window.windowSeconds)
      .exec();
    
    // Also record in PostgreSQL for analytics
    await RateLimits.create({
      userId,
      platform,
      actionType: action,
      windowStart: new Date(),
      windowEnd: new Date(Date.now() + window.windowSeconds * 1000)
    });
  }
  
  getWindow(platform, action) {
    // Platform-specific rate limits
    const limits = {
      instagram: {
        publish: { limit: 25, windowSeconds: 3600 }, // 25/hour
        like: { limit: 100, windowSeconds: 3600 }
      },
      twitter: {
        publish: { limit: 50, windowSeconds: 900 }, // 50/15min
        retweet: { limit: 100, windowSeconds: 900 }
      },
      // ... other platforms
    };
    
    return limits[platform]?.[action] || { limit: 10, windowSeconds: 3600 };
  }
}
```

### Timezone-Aware Scheduling

```javascript
class TimezoneScheduler {
  async schedulePost(postId, scheduledFor, userTimezone) {
    // Convert scheduled time to UTC
    const utcTime = timezoneUtils.toUTC(scheduledFor, userTimezone);
    
    // Calculate delay in milliseconds
    const now = new Date();
    const delay = Math.max(0, utcTime.getTime() - now.getTime());
    
    // Add to queue with delay
    const job = await postQueue.add(
      { postId, scheduledFor: utcTime.toISOString() },
      { delay, jobId: `post-${postId}` }
    );
    
    // Store job reference in database
    await QueueJobs.create({
      jobId: job.id,
      queueName: 'post-publishing',
      jobType: 'post-publishing',
      postPlatformId: postId,
      status: 'waiting',
      payload: { scheduledFor: utcTime.toISOString(), userTimezone }
    });
    
    return job;
  }
  
  async rescheduleForTimezone(job, newTimezone) {
    // Extract original scheduled time
    const { scheduledFor } = job.data;
    
    // Recalculate for new timezone
    const newUTCTime = timezoneUtils.toUTC(scheduledFor, newTimezone);
    const newDelay = Math.max(0, newUTCTime.getTime() - Date.now());
    
    // Remove old job, add new one
    await job.remove();
    const newJob = await postQueue.add(
      { ...job.data, userTimezone: newTimezone },
      { delay: newDelay, jobId: job.opts.jobId }
    );
    
    // Update database record
    await QueueJobs.update(
      { jobId: job.id },
      { 
        jobId: newJob.id,
        payload: { ...job.data, userTimezone: newTimezone }
      }
    );
    
    return newJob;
  }
}
```

### Dead Letter Queue (DLQ) Management

```javascript
class DeadLetterQueueManager {
  async processDLQ() {
    const jobs = await deadLetterQueue.getJobs(['failed']);
    
    for (const job of jobs) {
      // Analyze failure reason
      const analysis = this.analyzeFailure(job);
      
      switch (analysis.category) {
        case 'rate_limit':
          await this.handleRateLimitFailure(job);
          break;
        case 'auth_error':
          await this.handleAuthFailure(job);
          break;
        case 'platform_error':
          await this.handlePlatformFailure(job);
          break;
        case 'content_error':
          await this.handleContentFailure(job);
          break;
        default:
          await this.handleUnknownFailure(job);
      }
      
      // Notify user/admin
      await this.notifyStakeholders(job, analysis);
    }
  }
  
  analyzeFailure(job) {
    const error = job.failedReason?.toLowerCase() || '';
    
    if (error.includes('rate limit') || error.includes('429')) {
      return { category: 'rate_limit', severity: 'medium' };
    }
    if (error.includes('auth') || error.includes('token') || error.includes('401') || error.includes('403')) {
      return { category: 'auth_error', severity: 'high' };
    }
    if (error.includes('platform') || error.includes('5xx')) {
      return { category: 'platform_error', severity: 'low' };
    }
    if (error.includes('content') || error.includes('policy') || error.includes('400')) {
      return { category: 'content_error', severity: 'high' };
    }
    
    return { category: 'unknown', severity: 'medium' };
  }
}
```

### Monitoring & Metrics

#### Queue Metrics Collection

```javascript
class QueueMetricsCollector {
  async collectMetrics() {
    const queues = ['post-publishing', 'media-processing', 'analytics-fetch'];
    
    for (const queueName of queues) {
      const queue = getQueue(queueName);
      
      const counts = await queue.getJobCounts();
      const metrics = {
        queueName,
        waiting: counts.waiting,
        active: counts.active,
        completed: counts.completed,
        failed: counts.failed,
        delayed: counts.delayed,
        timestamp: new Date()
      };
      
      // Store in PostgreSQL for historical analysis
      await QueueMetrics.create(metrics);
      
      // Alert if thresholds exceeded
      this.checkThresholds(metrics);
    }
  }
  
  checkThresholds(metrics) {
    const thresholds = {
      'post-publishing': {
        failed: { warn: 10, critical: 50 },
        waiting: { warn: 100, critical: 500 }
      },
      'media-processing': {
        failed: { warn: 5, critical: 20 }
      }
    };
    
    const queueThresholds = thresholds[metrics.queueName];
    if (!queueThresholds) return;
    
    for (const [metric, value] of Object.entries(metrics)) {
      if (metric === 'queueName' || metric === 'timestamp') continue;
      
      const threshold = queueThresholds[metric];
      if (threshold && value >= threshold.critical) {
        this.sendAlert(`${metrics.queueName} ${metric} CRITICAL: ${value}`);
      } else if (threshold && value >= threshold.warn) {
        this.sendAlert(`${metrics.queueName} ${metric} WARNING: ${value}`);
      }
    }
  }
}
```

### Webhook Handling

```javascript
class WebhookHandler {
  async handlePlatformWebhook(platform, event) {
    switch (event.type) {
      case 'post_published':
        await this.handlePostPublished(platform, event);
        break;
      case 'post_failed':
        await this.handlePostFailed(platform, event);
        break;
      case 'analytics_updated':
        await this.handleAnalyticsUpdated(platform, event);
        break;
      case 'rate_limit_warning':
        await this.handleRateLimitWarning(platform, event);
        break;
    }
    
    // Acknowledge webhook
    return { received: true };
  }
  
  async handlePostPublished(platform, event) {
    // Update post status
    await PostPlatforms.update(
      { platform_post_id: event.postId },
      { status: 'published', posted_at: new Date() }
    );
    
    // Queue analytics fetch
    await analyticsQueue.add({
      postPlatformId: event.metadata.postPlatformId,
      platform,
      platformPostId: event.postId
    }, { delay: 10000 }); // 10 second delay
  }
}
```

### Deployment & Scaling

#### Redis Configuration
```yaml
# redis-config.yaml
cluster:
  enabled: true
  nodes: 3
persistence:
  enabled: true
  snapshot: every-hour
resources:
  memory: 4Gi
  cpu: 2
monitoring:
  prometheus: true
  metricsPort: 9121
```

#### Worker Auto-scaling
```javascript
// Based on queue depth
const scalingPolicy = {
  'post-publishing': {
    minWorkers: 2,
    maxWorkers: 10,
    scaleUpThreshold: 50, // jobs waiting
    scaleDownThreshold: 5,
    cooldownSeconds: 300
  },
  'media-processing': {
    minWorkers: 1,
    maxWorkers: 5,
    scaleUpThreshold: 20,
    scaleDownThreshold: 2,
    cooldownSeconds: 300
  }
};
```

### Failure Recovery Procedures

1. **Redis Failure**: 
   - Failover to replica
   - Replay from PostgreSQL `queue_jobs` table
   - Manual intervention if both primary and replica fail

2. **Worker Failure**:
   - Automatic restart via process manager (PM2)
   - Job timeouts prevent hanging
   - Failed jobs retried according to policy

3. **Platform API Failure**:
   - Exponential backoff retry
   - Circuit breaker pattern
   - Fallback to alternative actions

4. **Database Connection Loss**:
   - Retry with exponential backoff
   - Queue jobs in memory temporarily
   - Bulk replay when connection restored

### Testing Strategy

1. **Unit Tests**: Individual worker functions
2. **Integration Tests**: Full job processing flow
3. **Load Tests**: Simulate peak posting times
4. **Failure Tests**: Network partitions, API failures
5. **Recovery Tests**: System restart scenarios