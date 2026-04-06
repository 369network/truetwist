import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Helper to get authenticated user from request
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return null
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  try {
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)
    return user
  } catch (error) {
    return null
  }
}

// Find the best available time slot from optimal_times for a platform
async function findBestTimeSlot(
  supabase: any,
  userId: string,
  platform: string,
  existingQueue: any[],
  hoursAhead: number = 24
): Promise<string | null> {
  // Fetch optimal times for this platform
  const { data: optimalTimes, error: optimalError } = await supabase
    .from('optimal_times')
    .select('day_of_week, hour, score')
    .eq('user_id', userId)
    .eq('platform', platform)
    .order('score', { ascending: false })

  if (optimalError || !optimalTimes || optimalTimes.length === 0) {
    console.error('Error fetching optimal times or no times found:', optimalError)
    return null
  }

  const now = new Date()
  const baseDate = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000)

  // Try to find the first available slot
  for (const optimalTime of optimalTimes) {
    // Calculate target date: find next occurrence of this day/hour
    const targetDate = new Date(baseDate)
    const daysUntilTarget = (optimalTime.day_of_week - targetDate.getDay() + 7) % 7
    const daysToAdd = daysUntilTarget === 0 ? 7 : daysUntilTarget

    targetDate.setDate(targetDate.getDate() + daysToAdd)
    targetDate.setHours(optimalTime.hour, 0, 0, 0)

    // Check if this slot conflicts with existing queue items (within 1 hour window)
    const slotStart = targetDate.getTime()
    const slotEnd = slotStart + 60 * 60 * 1000

    const hasConflict = existingQueue.some(item => {
      const itemTime = new Date(item.scheduled_for).getTime()
      return itemTime >= slotStart - 60 * 60 * 1000 && itemTime <= slotEnd + 60 * 60 * 1000
    })

    if (!hasConflict) {
      return targetDate.toISOString()
    }
  }

  // Fallback: use first available time + 24 hours
  const fallbackDate = new Date(baseDate)
  fallbackDate.setHours(9, 0, 0, 0)
  return fallbackDate.toISOString()
}

// Generate AI reasoning for why this time was chosen
async function generateAIReasoning(
  platform: string,
  postTitle: string,
  scheduledTime: Date
): Promise<string> {
  const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    scheduledTime.getDay()
  ]
  const hour = scheduledTime.getHours()

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a social media scheduling expert. Provide a brief, one-sentence explanation for why a specific posting time is optimal.'
        },
        {
          role: 'user',
          content: `Why is ${dayOfWeek} at ${hour}:00 a good time to post "${postTitle}" on ${platform}? Keep it under 100 characters.`
        }
      ],
      temperature: 0.7,
      max_tokens: 100,
    })

    const content = response.choices[0].message.content
    return content || 'Optimal time based on audience activity patterns'
  } catch (error) {
    console.error('Error generating AI reasoning:', error)
    return 'Optimal time based on audience activity patterns'
  }
}

// POST: Auto-schedule posts from draft status
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { postIds } = body

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid postIds array' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Fetch posts to schedule
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, title, platforms')
      .eq('user_id', user.id)
      .in('id', postIds)
      .eq('status', 'draft')

    if (postsError) {
      console.error('Error fetching posts:', postsError)
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json(
        { error: 'No draft posts found with provided IDs' },
        { status: 404 }
      )
    }

    // Fetch existing schedule queue items to avoid conflicts
    const { data: existingQueue, error: queueError } = await supabase
      .from('schedule_queue')
      .select('scheduled_for')
      .eq('user_id', user.id)
      .eq('status', 'queued')

    if (queueError) {
      console.error('Error fetching schedule queue:', queueError)
      return NextResponse.json({ error: 'Failed to check existing schedule' }, { status: 500 })
    }

    const scheduledItems = []
    const errors = []

    // Schedule each post
    for (const post of posts) {
      const platforms = Array.isArray(post.platforms) ? post.platforms : [post.platforms]

      for (const platform of platforms) {
        try {
          // Find best time slot for this platform
          const scheduledFor = await findBestTimeSlot(
            supabase,
            user.id,
            platform,
            existingQueue || []
          )

          if (!scheduledFor) {
            errors.push({
              postId: post.id,
              platform,
              error: 'Could not find optimal time slot'
            })
            continue
          }

          // Generate AI reasoning
          const scheduledDate = new Date(scheduledFor)
          const aiReason = await generateAIReasoning(
            platform,
            post.title || 'Untitled',
            scheduledDate
          )

          // Create schedule queue item
          const { data: queueItem, error: queueInsertError } = await supabase
            .from('schedule_queue')
            .insert({
              user_id: user.id,
              post_id: post.id,
              platform,
              scheduled_for: scheduledFor,
              ai_recommended: true,
              ai_reason: aiReason,
              status: 'queued'
            })
            .select()
            .single()

          if (queueInsertError) {
            errors.push({
              postId: post.id,
              platform,
              error: `Failed to create schedule item: ${queueInsertError.message}`
            })
            continue
          }

          // Create calendar event
          const { data: calendarEvent, error: calendarError } = await supabase
            .from('calendar_events')
            .insert({
              user_id: user.id,
              post_id: post.id,
              title: `Post: ${post.title || 'Untitled'}`,
              description: `Auto-scheduled for ${platform}. ${aiReason}`,
              scheduled_date: scheduledDate.toISOString().split('T')[0],
              scheduled_time: scheduledDate.toISOString().split('T')[1].substring(0, 5),
              platforms: [platform],
              ai_recommended: true,
              status: 'scheduled'
            })
            .select()
            .single()

          if (calendarError) {
            console.error('Error creating calendar event:', calendarError)
            // Don't fail the request if calendar event fails
          }

          // Add to existing queue to avoid future conflicts
          if (existingQueue) {
            existingQueue.push({ scheduled_for: scheduledFor })
          }

          scheduledItems.push({
            postId: post.id,
            platform,
            scheduledFor,
            queueItem,
            calendarEvent,
            aiReason
          })
        } catch (error) {
          errors.push({
            postId: post.id,
            platform,
            error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`
          })
        }
      }
    }

    // Update posts status to 'scheduled' if all platforms were scheduled
    const scheduledPostIds = new Set(scheduledItems.map(item => item.postId))
    for (const postId of scheduledPostIds) {
      const postSchedules = scheduledItems.filter(item => item.postId === postId)
      const postPlatforms = posts.find(p => p.id === postId)?.platforms || []

      if (postSchedules.length === postPlatforms.length) {
        await supabase
          .from('posts')
          .update({ status: 'scheduled' })
          .eq('id', postId)
          .eq('user_id', user.id)
      }
    }

    return NextResponse.json(
      {
        success: true,
        scheduledItems,
        errors,
        summary: {
          total: posts.length,
          scheduled: scheduledItems.length,
          failed: errors.length
        }
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error in POST /api/schedule/auto:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
