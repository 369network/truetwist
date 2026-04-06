import { Queue, Worker, FlowProducer, type Job } from 'bullmq';
import { redis } from '@/lib/redis';

function getConnection() {
  return {
    host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
    port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379'),
  };
}

// ============================================
// Queue Definitions (lazy to avoid build-time Redis connections)
// ============================================

function lazyQueue<T>(name: string, opts?: object): Queue<T> {
  let instance: Queue<T> | undefined;
  return new Proxy({} as Queue<T>, {
    get(_, prop) {
      if (!instance) instance = new Queue<T>(name, { connection: getConnection(), ...opts });
      const val = (instance as any)[prop];
      return typeof val === 'function' ? val.bind(instance) : val;
    },
  });
}

export const postingQueue = lazyQueue('posting-queue', {
  defaultJobOptions: {
    attempts: 4,
    backoff: { type: 'custom' },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export const contentGenerationQueue = lazyQueue('content-generation-queue');
export const analyticsQueue = lazyQueue('analytics-queue');
export const deadLetterQueue = lazyQueue('dead-letter-queue');
export const preflightQueue = lazyQueue('preflight-queue');

// Flow producer for multi-step workflows (preflight -> post -> analytics)
let _flowProducer: FlowProducer | undefined;
export const flowProducer = new Proxy({} as FlowProducer, {
  get(_, prop) {
    if (!_flowProducer) _flowProducer = new FlowProducer({ connection: getConnection() });
    const val = (_flowProducer as any)[prop];
    return typeof val === 'function' ? val.bind(_flowProducer) : val;
  },
});

// ============================================
// Job Data Interfaces
// ============================================

export interface PostingJobData {
  postScheduleId: string;
  postId: string;
  socialAccountId: string;
  platform: string;
  crossPostGroup?: string; // links multi-platform posts
}

export interface PreflightJobData {
  postScheduleId: string;
  postId: string;
  socialAccountId: string;
  platform: string;
  checks: ('token_validity' | 'rate_limit' | 'content_validation')[];
}

export interface FanOutJobData {
  postId: string;
  userId: string;
  scheduleIds: string[]; // all PostSchedule IDs for this cross-post
  crossPostGroup: string;
}

export interface ContentGenerationJobData {
  userId: string;
  prompt: string;
  type: 'text' | 'image' | 'video';
  model?: string;
}

export interface AnalyticsJobData {
  postScheduleId: string;
  platform: string;
  platformPostId: string;
}

export interface DeadLetterJobData {
  originalQueue: string;
  originalJobId: string;
  originalData: unknown;
  failedAt: string;
  errorMessage: string;
  attempts: number;
}

// ============================================
// Retry Delays (exponential: 1min, 5min, 15min, 1hr)
// ============================================

const POSTING_RETRY_DELAYS = [
  60 * 1000,       // 1 minute
  5 * 60 * 1000,   // 5 minutes
  15 * 60 * 1000,  // 15 minutes
  60 * 60 * 1000,  // 1 hour
];

// ============================================
// Job Helpers
// ============================================

export async function addPostingJob(data: PostingJobData, delay?: number) {
  return postingQueue.add('post', data, {
    delay,
    jobId: `post-${data.postScheduleId}`, // deterministic ID for cancellation
  });
}

export async function addPreflightJob(data: PreflightJobData) {
  return preflightQueue.add('preflight', data, {
    attempts: 1,
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  });
}

/**
 * Fan-out: schedule a single post to multiple platforms.
 * Creates a preflight check for each, then queues posting jobs.
 */
export async function addFanOutJobs(
  postId: string,
  userId: string,
  schedules: Array<{ id: string; socialAccountId: string; platform: string; scheduledAt: Date }>,
  crossPostGroup: string
) {
  const jobs = schedules.map((schedule) => {
    const delay = Math.max(0, schedule.scheduledAt.getTime() - Date.now());
    return addPostingJob(
      {
        postScheduleId: schedule.id,
        postId,
        socialAccountId: schedule.socialAccountId,
        platform: schedule.platform,
        crossPostGroup,
      },
      delay
    );
  });

  return Promise.all(jobs);
}

export async function addToDeadLetter(data: DeadLetterJobData) {
  return deadLetterQueue.add('dead-letter', data, {
    removeOnComplete: false, // keep dead letters for manual review
    removeOnFail: false,
  });
}

export async function addContentGenerationJob(data: ContentGenerationJobData) {
  return contentGenerationQueue.add('generate', data, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  });
}

export async function addAnalyticsJob(data: AnalyticsJobData, delay?: number) {
  return analyticsQueue.add('fetch-analytics', data, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
    delay: delay ?? 5 * 60 * 1000, // default: fetch analytics 5 min after posting
  });
}

/**
 * Cancel a scheduled posting job by PostSchedule ID.
 * Returns true if the job was found and removed.
 */
export async function cancelPostingJob(postScheduleId: string): Promise<boolean> {
  const jobId = `post-${postScheduleId}`;
  const job = await postingQueue.getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state === 'delayed' || state === 'waiting') {
    await job.remove();
    return true;
  }
  return false;
}

/**
 * Reschedule a posting job to a new time.
 */
export async function reschedulePostingJob(
  postScheduleId: string,
  newScheduledAt: Date,
  data: PostingJobData
): Promise<string | null> {
  const cancelled = await cancelPostingJob(postScheduleId);
  if (!cancelled) return null;

  const delay = Math.max(0, newScheduledAt.getTime() - Date.now());
  const job = await addPostingJob(data, delay);
  return job.id ?? null;
}

// ============================================
// Worker Factories
// ============================================

export function createPostingWorker(
  processor: (job: Job<PostingJobData>) => Promise<void>
) {
  return new Worker<PostingJobData>('posting-queue', processor, {
    connection: getConnection(),
    concurrency: 10,
    settings: {
      backoffStrategy: (attemptsMade: number) => {
        return POSTING_RETRY_DELAYS[Math.min(attemptsMade - 1, POSTING_RETRY_DELAYS.length - 1)];
      },
    },
  });
}

export function createPreflightWorker(
  processor: (job: Job<PreflightJobData>) => Promise<void>
) {
  return new Worker<PreflightJobData>('preflight-queue', processor, {
    connection: getConnection(),
    concurrency: 20,
  });
}

export function createContentGenerationWorker(
  processor: (job: Job<ContentGenerationJobData>) => Promise<void>
) {
  return new Worker<ContentGenerationJobData>('content-generation-queue', processor, {
    connection: getConnection(),
    concurrency: 5,
  });
}

export function createAnalyticsWorker(
  processor: (job: Job<AnalyticsJobData>) => Promise<void>
) {
  return new Worker<AnalyticsJobData>('analytics-queue', processor, {
    connection: getConnection(),
    concurrency: 3,
  });
}

// ============================================
// Queue Stats
// ============================================

export async function getQueueStats(queue: Queue) {
  const [waiting, active, delayed, failed, completed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
    queue.getFailedCount(),
    queue.getCompletedCount(),
  ]);
  return { waiting, active, delayed, failed, completed };
}

export async function getAllQueueStats() {
  const [posting, preflight, analytics, deadLetter, contentGen] = await Promise.all([
    getQueueStats(postingQueue),
    getQueueStats(preflightQueue),
    getQueueStats(analyticsQueue),
    getQueueStats(deadLetterQueue),
    getQueueStats(contentGenerationQueue),
  ]);
  return { posting, preflight, analytics, deadLetter, contentGen };
}
