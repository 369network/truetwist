export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const PLATFORMS = ['twitter', 'instagram', 'facebook', 'linkedin', 'tiktok']
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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

// Default optimal times seeded if none exist
function generateDefaultOptimalTimes(userId: string): any[] {
  const defaults = [
    // Twitter: business hours & evening
    { platform: 'twitter', day_of_week: 1, hour: 9, score: 0.75 },   // Mon 9am
    { platform: 'twitter', day_of_week: 1, hour: 17, score: 0.72 },  // Mon 5pm
    { platform: 'twitter', day_of_week: 2, hour: 9, score: 0.78 },   // Tue 9am
    { platform: 'twitter', day_of_week: 2, hour: 17, score: 0.74 },  // Tue 5pm
    { platform: 'twitter', day_of_week: 3, hour: 9, score: 0.80 },   // Wed 9am (best day)
    { platform: 'twitter', day_of_week: 3, hour: 17, score: 0.76 },  // Wed 5pm
    { platform: 'twitter', day_of_week: 4, hour: 9, score: 0.77 },   // Thu 9am
    { platform: 'twitter', day_of_week: 4, hour: 17, score: 0.73 },  // Thu 5pm
    { platform: 'twitter', day_of_week: 5, hour: 9, score: 0.74 },   // Fri 9am
    { platform: 'twitter', day_of_week: 5, hour: 17, score: 0.71 },  // Fri 5pm

    // Instagram: lunch & evening
    { platform: 'instagram', day_of_week: 1, hour: 12, score: 0.68 }, // Mon noon
    { platform: 'instagram', day_of_week: 1, hour: 19, score: 0.72 }, // Mon 7pm
    { platform: 'instagram', day_of_week: 2, hour: 12, score: 0.70 }, // Tue noon
    { platform: 'instagram', day_of_week: 2, hour: 19, score: 0.74 }, // Tue 7pm
    { platform: 'instagram', day_of_week: 3, hour: 12, score: 0.72 }, // Wed noon
    { platform: 'instagram', day_of_week: 3, hour: 19, score: 0.76 }, // Wed 7pm
    { platform: 'instagram', day_of_week: 4, hour: 12, score: 0.71 }, // Thu noon
    { platform: 'instagram', day_of_week: 4, hour: 19, score: 0.75 }, // Thu 7pm
    { platform: 'instagram', day_of_week: 5, hour: 12, score: 0.69 }, // Fri noon
    { platform: 'instagram', day_of_week: 5, hour: 19, score: 0.73 }, // Fri 7pm

    // Facebook: morning & evening
    { platform: 'facebook', day_of_week: 1, hour: 8, score: 0.66 },   // Mon 8am
    { platform: 'facebook', day_of_week: 1, hour: 20, score: 0.71 },  // Mon 8pm
    { platform: 'facebook', day_of_week: 2, hour: 8, score: 0.68 },   // Tue 8am
    { platform: 'facebook', day_of_week: 2, hour: 20, score: 0.73 },  // Tue 8pm
    { platform: 'facebook', day_of_week: 3, hour: 8, score: 0.70 },   // Wed 8am
    { platform: 'facebook', day_of_week: 3, hour: 20, score: 0.75 },  // Wed 8pm
    { platform: 'facebook', day_of_week: 4, hour: 8, score: 0.69 },   // Thu 8am
    { platform: 'facebook', day_of_week: 4, hour: 20, score: 0.74 },  // Thu 8pm
    { platform: 'facebook', day_of_week: 5, hour: 8, score: 0.67 },   // Fri 8am
    { platform: 'facebook', day_of_week: 5, hour: 20, score: 0.72 },  // Fri 8pm

    // LinkedIn: morning commute & lunch
    { platform: 'linkedin', day_of_week: 1, hour: 7, score: 0.74 },   // Mon 7am
    { platform: 'linkedin', day_of_week: 1, hour: 12, score: 0.70 },  // Mon noon
    { platform: 'linkedin', day_of_week: 2, hour: 7, score: 0.76 },   // Tue 7am
    { platform: 'linkedin', day_of_week: 2, hour: 12, score: 0.72 },  // Tue noon
    { platform: 'linkedin', day_of_week: 3, hour: 7, score: 0.78 },   // Wed 7am (best day)
    { platform: 'linkedin', day_of_week: 3, hour: 12, score: 0.74 },  // Wed noon
    { platform: 'linkedin', day_of_week: 4, hour: 7, score: 0.77 },   // Thu 7am
    { platform: 'linkedin', day_of_week: 4, hour: 12, score: 0.73 },  // Thu noon
    { platform: 'linkedin', day_of_week: 5, hour: 7, score: 0.75 },   // Fri 7am
    { platform: 'linkedin', day_of_week: 5, hour: 12, score: 0.71 },  // Fri noon

    // TikTok: evening & night
    { platform: 'tiktok', day_of_week: 1, hour: 18, score: 0.75 },    // Mon 6pm
    { platform: 'tiktok', day_of_week: 1, hour: 21, score: 0.78 },    // Mon 9pm
    { platform: 'tiktok', day_of_week: 2, hour: 18, score: 0.77 },    // Tue 6pm
    { platform: 'tiktok', day_of_week: 2, hour: 21, score: 0.80 },    // Tue 9pm
    { platform: 'tiktok', day_of_week: 3, hour: 18, score: 0.79 },    // Wed 6pm
    { platform: 'tiktok', day_of_week: 3, hour: 21, score: 0.82 },    // Wed 9pm (best time)
    { platform: 'tiktok', day_of_week: 4, hour: 18, score: 0.78 },    // Thu 6pm
    { platform: 'tiktok', day_of_week: 4, hour: 21, score: 0.81 },    // Thu 9pm
    { platform: 'tiktok', day_of_week: 5, hour: 18, score: 0.76 },    // Fri 6pm
    { platform: 'tiktok', day_of_week: 5, hour: 21, score: 0.79 },    // Fri 9pm
  ]

  return defaults.map(item => ({
    ...item,
    user_id: userId,
    sample_size: 0, // AI-generated defaults have no sample size
  }))
}

// GET: Return user's optimal times by platform. If none exist, seed with AI-generated defaults.
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Check if user has optimal times
    const { data: existingTimes, error: fetchError } = await supabase
      .from('optimal_times')
      .select('*')
      .eq('user_id', user.id)

    if (fetchError) {
      console.error('Error fetching optimal times:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch optimal times' }, { status: 500 })
    }

    // If times exist, return them
    if (existingTimes && existingTimes.length > 0) {
      return NextResponse.json(existingTimes)
    }

    // Otherwise, seed with defaults
    const defaultTimes = generateDefaultOptimalTimes(user.id)

    const { data: seededTimes, error: seedError } = await supabase
      .from('optimal_times')
      .insert(defaultTimes)
      .select()

    if (seedError) {
      console.error('Error seeding optimal times:', seedError)
      return NextResponse.json({ error: 'Failed to create optimal times' }, { status: 500 })
    }

    return NextResponse.json(seededTimes)
  } catch (error) {
    console.error('Unexpected error in GET /api/schedule/optimal-times:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Analyze posting history and generate AI recommendations
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Fetch user's published posts with engagement data
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, platforms, viral_score, scheduled_at, ai_viral_factors')
      .eq('user_id', user.id)
      .eq('status', 'published')
      .limit(100)

    if (postsError) {
      console.error('Error fetching user posts:', postsError)
      return NextResponse.json({ error: 'Failed to fetch posting history' }, { status: 500 })
    }

    // Prepare data for AI analysis
    const postAnalysis = posts.map(post => {
      const scheduledDate = new Date(post.scheduled_at)
      const dayOfWeek = scheduledDate.getDay()
      const hour = scheduledDate.getHours()

      return {
        day: DAYS[dayOfWeek],
        hour,
        platforms: post.platforms,
        engagement: post.viral_score || 0,
        factors: post.ai_viral_factors || []
      }
    })

    // Call OpenAI to analyze and recommend optimal times
    const analysisPrompt = `You are a social media scheduling expert. Analyze this user's posting history and recommend optimal posting times for each platform.

User's recent posts:
${JSON.stringify(postAnalysis, null, 2)}

Analyze the data and provide recommendations for optimal posting times (hour of day, day of week) for each platform: twitter, instagram, facebook, linkedin, tiktok.

For each platform and day-hour combination, provide:
- day_of_week (0-6, where 0=Sunday, 1=Monday, etc.)
- hour (0-23 in user's local timezone, assume Eastern Time)
- platform name
- engagement_score (0-1 scale)
- reasoning

Return as JSON array with structure:
[
  {
    "platform": "twitter",
    "day_of_week": 3,
    "hour": 9,
    "engagement_score": 0.85,
    "reasoning": "..."
  }
]

Provide at least 10 recommendations total, prioritizing the most impactful times.`

    let aiRecommendations = []

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a social media scheduling expert who analyzes user engagement patterns and recommends optimal posting times. Always return valid JSON in the specified format.'
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      })

      const content = response.choices[0].message.content
      if (content) {
        try {
          const parsed = JSON.parse(content)
          aiRecommendations = Array.isArray(parsed) ? parsed : parsed.recommendations || []
        } catch (e) {
          console.error('Error parsing AI response:', e)
          // Fall back to default times if parsing fails
          aiRecommendations = []
        }
      }
    } catch (error) {
      console.error('Error calling OpenAI:', error)
      // Don't fail the request, just return empty recommendations
    }

    // If AI analysis failed, return default optimal times
    if (aiRecommendations.length === 0) {
      const defaultTimes = generateDefaultOptimalTimes(user.id)

      const { data: seededTimes, error: seedError } = await supabase
        .from('optimal_times')
        .insert(defaultTimes)
        .select()

      if (seedError) {
        console.error('Error seeding default times:', seedError)
        return NextResponse.json({ error: 'Failed to generate recommendations' }, { status: 500 })
      }

      return NextResponse.json({
        recommendations: seededTimes,
        source: 'defaults',
        message: 'AI analysis not available, returning default recommendations'
      })
    }

    // Transform AI recommendations to database format
    const timesToInsert = aiRecommendations.map((rec: any) => ({
      user_id: user.id,
      platform: rec.platform,
      day_of_week: rec.day_of_week,
      hour: rec.hour,
      score: rec.engagement_score || 0.75,
      sample_size: posts.length,
    }))

    // Delete existing optimal times and insert new ones
    await supabase
      .from('optimal_times')
      .delete()
      .eq('user_id', user.id)

    const { data: insertedTimes, error: insertError } = await supabase
      .from('optimal_times')
      .insert(timesToInsert)
      .select()

    if (insertError) {
      console.error('Error inserting AI recommendations:', insertError)
      return NextResponse.json({ error: 'Failed to save recommendations' }, { status: 500 })
    }

    return NextResponse.json({
      recommendations: insertedTimes,
      source: 'ai_analysis',
      message: 'AI recommendations generated based on posting history'
    })
  } catch (error) {
    console.error('Unexpected error in POST /api/schedule/optimal-times:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
