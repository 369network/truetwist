import { Queue, Worker, type Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import type { TrendCollectionJobData, TrendSource } from './types';
import { runCollectionPipeline } from './collection-pipeline';
import { evaluateAndCreateAlerts } from './alert-service';
import { refreshHashtagMetrics, detectBannedHashtags } from './hashtag-engine';
import { getAvailableSources } from './collectors';

const QUEUE_NAME = 'trend-collection';

const connection = {
  host: new URL(process.env.REDIS_URL || 'redis://localhost:6379').hostname,
  port: parseInt(new URL(process.env.REDIS_URL || 'redis://localhost:6379').port || '6379'),
};

export const trendCollectionQueue = new Queue<TrendCollectionJobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 60000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 1000 },
  },
});

// Polling cadence per source (in milliseconds)
const COLLECTION_INTERVALS: Record<string, number> = {
  youtube: 15 * 60 * 1000,       // 15 minutes
  google_trends: 5 * 60 * 1000,  // 5 minutes
  twitter: 2 * 60 * 1000,        // 2 minutes
  tiktok: 15 * 60 * 1000,        // 15 minutes
  instagram: 15 * 60 * 1000,     // 15 minutes
};

/**
 * Schedules collection jobs for all available trend sources.
 * Each source runs on its own cadence.
 */
export async function scheduleTrendCollection(region: string = 'US'): Promise<number> {
  const sources = getAvailableSources();
  let queued = 0;

  for (const source of sources) {
    const jobDbRecord = await prisma.trendCollectionJob.create({
      data: { source, region, status: 'pending' },
    });

    await trendCollectionQueue.add(
      'collect',
      { source, region, jobDbId: jobDbRecord.id },
      {
        jobId: `trend:${source}:${region}:${Date.now()}`,
      }
    );
    queued++;
  }

  return queued;
}

/**
 * Schedules repeating collection jobs using BullMQ repeatable jobs.
 */
export async function startRepeatingCollections(region: string = 'US'): Promise<void> {
  const sources = getAvailableSources();

  for (const source of sources) {
    const interval = COLLECTION_INTERVALS[source] ?? 15 * 60 * 1000;

    await trendCollectionQueue.add(
      'collect-repeating',
      { source, region, jobDbId: '' }, // jobDbId created per run in worker
      {
        repeat: { every: interval },
        jobId: `trend-repeat:${source}:${region}`,
      }
    );
  }
}

/**
 * Processes trend collection jobs.
 */
async function processTrendCollectionJob(job: Job<TrendCollectionJobData>): Promise<void> {
  let { source, region, jobDbId } = job.data;

  // For repeating jobs, create a new DB record per run
  if (!jobDbId) {
    const dbRecord = await prisma.trendCollectionJob.create({
      data: { source, region, status: 'pending' },
    });
    jobDbId = dbRecord.id;
  }

  // Run the collection pipeline
  await runCollectionPipeline(source as TrendSource, region, jobDbId);

  // Post-collection: evaluate alerts and refresh hashtag metrics
  await evaluateAndCreateAlerts();
  await refreshHashtagMetrics(source === 'google_trends' ? 'google' : source);
  await detectBannedHashtags(source === 'google_trends' ? 'google' : source);
}

export function createTrendCollectionWorker() {
  return new Worker<TrendCollectionJobData>(QUEUE_NAME, processTrendCollectionJob, {
    connection,
    concurrency: 3,
  });
}

/**
 * Gets stats for the trend collection queue.
 */
export async function getTrendQueueStats() {
  const [waiting, active, delayed, failed, completed] = await Promise.all([
    trendCollectionQueue.getWaitingCount(),
    trendCollectionQueue.getActiveCount(),
    trendCollectionQueue.getDelayedCount(),
    trendCollectionQueue.getFailedCount(),
    trendCollectionQueue.getCompletedCount(),
  ]);
  return { waiting, active, delayed, failed, completed };
}
