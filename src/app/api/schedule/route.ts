export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'

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

// GET: Fetch user's schedule_queue with joined post data, supports ?status=queued filter
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const statusFilter = url.searchParams.get('status')

    const supabase = createServerClient()

    let query = supabase
      .from('schedule_queue')
      .select(`
        id,
        user_id,
        post_id,
        platform,
        scheduled_for,
        ai_recommended,
        ai_reason,
        status,
        posts (
          id,
          content,
          title,
          platforms,
          status,
          viral_score,
          content_type,
          tone,
          topic,
          hashtags,
          ai_viral_factors,
          ai_improvements,
          alternative_hook
        )
      `)
      .eq('user_id', user.id)
      .order('scheduled_for', { ascending: true })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching schedule queue:', error)
      return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Unexpected error in GET /api/schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Add a post to queue and create calendar event
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { postId, platform, scheduledFor, aiRecommended = false, aiReason } = body

    if (!postId || !platform || !scheduledFor) {
      return NextResponse.json(
        { error: 'Missing required fields: postId, platform, scheduledFor' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Start a transaction by inserting queue item first
    const { data: queueItem, error: queueError } = await supabase
      .from('schedule_queue')
      .insert({
        user_id: user.id,
        post_id: postId,
        platform,
        scheduled_for: scheduledFor,
        ai_recommended: aiRecommended,
        ai_reason: aiReason || null,
        status: 'queued'
      })
      .select()
      .single()

    if (queueError) {
      console.error('Error inserting schedule queue item:', queueError)
      return NextResponse.json({ error: 'Failed to add to schedule' }, { status: 500 })
    }

    // Fetch the post to get title
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select('title')
      .eq('id', postId)
      .single()

    if (postError) {
      console.error('Error fetching post:', postError)
      return NextResponse.json({ error: 'Failed to fetch post details' }, { status: 500 })
    }

    // Create calendar event
    const scheduledDate = new Date(scheduledFor)
    const { data: calendarEvent, error: calendarError } = await supabase
      .from('calendar_events')
      .insert({
        user_id: user.id,
        post_id: postId,
        title: `Post: ${post.title || 'Untitled'}`,
        description: `Schedule to ${platform}`,
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        scheduled_time: scheduledDate.toISOString().split('T')[1].substring(0, 5),
        platforms: [platform],
        ai_recommended: aiRecommended,
        status: 'scheduled'
      })
      .select()
      .single()

    if (calendarError) {
      console.error('Error creating calendar event:', calendarError)
      // Don't fail the request if calendar event creation fails
    }

    return NextResponse.json(
      {
        queueItem,
        calendarEvent
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Unexpected error in POST /api/schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Remove from queue by id and associated calendar event
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { queueId } = body

    if (!queueId) {
      return NextResponse.json({ error: 'Missing required field: queueId' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Verify the queue item belongs to the user
    const { data: queueItem, error: fetchError } = await supabase
      .from('schedule_queue')
      .select('post_id')
      .eq('id', queueId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !queueItem) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
    }

    // Delete associated calendar event
    await supabase
      .from('calendar_events')
      .delete()
      .eq('post_id', queueItem.post_id)
      .eq('user_id', user.id)

    // Delete queue item
    const { error: deleteError } = await supabase
      .from('schedule_queue')
      .delete()
      .eq('id', queueId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting schedule queue item:', deleteError)
      return NextResponse.json({ error: 'Failed to remove from schedule' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unexpected error in DELETE /api/schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
