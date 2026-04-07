import { openai } from './openai-client';
import { AI_TEXT_MODEL, estimateModelCost } from './model-config';
import type {
  BrandContext,
  AdBudgetAllocationRequest,
  AdBudgetAllocationResult,
  PlatformAllocation,
  AdPerformanceMetric,
} from './types';

function summarizeMetrics(metrics: AdPerformanceMetric[]): string {
  if (metrics.length === 0) return 'No historical data available.';

  const byPlatform: Record<string, AdPerformanceMetric[]> = {};
  for (const m of metrics) {
    if (!byPlatform[m.platform]) byPlatform[m.platform] = [];
    byPlatform[m.platform].push(m);
  }

  const lines: string[] = [];
  for (const platform of Object.keys(byPlatform)) {
    const platformMetrics = byPlatform[platform];
    const totalSpend = platformMetrics.reduce((s: number, m: AdPerformanceMetric) => s + m.spend, 0);
    const totalRevenue = platformMetrics.reduce((s: number, m: AdPerformanceMetric) => s + m.revenue, 0);
    const totalClicks = platformMetrics.reduce((s: number, m: AdPerformanceMetric) => s + m.clicks, 0);
    const totalImpressions = platformMetrics.reduce((s: number, m: AdPerformanceMetric) => s + m.impressions, 0);
    const totalConversions = platformMetrics.reduce((s: number, m: AdPerformanceMetric) => s + m.conversions, 0);
    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

    lines.push(
      `${platform}: spend=$${totalSpend.toFixed(2)}, revenue=$${totalRevenue.toFixed(2)}, ` +
        `ROAS=${avgRoas.toFixed(2)}, CTR=${avgCtr.toFixed(2)}%, CPC=$${avgCpc.toFixed(2)}, ` +
        `conversions=${totalConversions}, periods=${platformMetrics.length}`
    );
  }

  return lines.join('\n');
}

function buildAllocationSystemPrompt(brand: BrandContext): string {
  let prompt =
    'You are an expert digital advertising strategist. You analyze ad performance data ' +
    'and recommend optimal budget allocations across platforms to maximize return on ad spend (ROAS).';

  if (brand.industry) {
    prompt += `\n\nIndustry: ${brand.industry}`;
  }
  if (brand.description) {
    prompt += `\nBusiness: ${brand.description}`;
  }
  if (brand.targetAudience && Object.keys(brand.targetAudience).length > 0) {
    prompt += `\nTarget Audience: ${JSON.stringify(brand.targetAudience)}`;
  }

  prompt += `\n\nRules:
- Base recommendations on actual performance data when available
- When no historical data exists for a platform, use industry benchmarks and be conservative
- Always provide a confidence score (0-1) reflecting data quality and certainty
- Include actionable insights the advertiser can act on immediately
- Consider seasonality, platform trends, and audience fit`;

  return prompt;
}

function buildAllocationUserPrompt(request: AdBudgetAllocationRequest): string {
  const metricsSummary = summarizeMetrics(request.historicalMetrics);

  let prompt =
    `Analyze the following ad performance data and recommend how to allocate a total budget of $${request.totalBudget.toFixed(2)} ` +
    `across these platforms: ${request.platforms.join(', ')}.\n\n` +
    `Campaign objective: ${request.objective}\n\n` +
    `Historical Performance:\n${metricsSummary}`;

  if (request.constraints) {
    if (request.constraints.minPerPlatformPct !== undefined) {
      prompt += `\n\nConstraint: Each platform must receive at least ${request.constraints.minPerPlatformPct}% of budget.`;
    }
    if (request.constraints.maxPerPlatformPct !== undefined) {
      prompt += `\nConstraint: No platform may exceed ${request.constraints.maxPerPlatformPct}% of budget.`;
    }
  }

  prompt += `\n\nRespond in JSON format:
{
  "allocations": [
    {
      "platform": "meta|google|tiktok",
      "campaignId": "optional existing campaign id or null",
      "recommendedBudgetPct": 45,
      "confidence": 0.82,
      "reasoning": "Brief explanation of why this allocation"
    }
  ],
  "totalProjectedRoas": 2.8,
  "insights": ["Actionable insight 1", "Actionable insight 2"]
}

Ensure allocations percentages sum to 100. Include 2-4 insights.`;

  return prompt;
}

export async function optimizeAdBudget(
  request: AdBudgetAllocationRequest,
  brand: BrandContext
): Promise<AdBudgetAllocationResult> {
  const startTime = Date.now();

  const systemPrompt = buildAllocationSystemPrompt(brand);
  const userPrompt = buildAllocationUserPrompt(request);

  const response = await openai.chat.completions.create({
    model: AI_TEXT_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 2048,
  });

  const durationMs = Date.now() - startTime;
  const tokensInput = response.usage?.prompt_tokens ?? 0;
  const tokensOutput = response.usage?.completion_tokens ?? 0;

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No content returned from budget allocation');
  }

  const parsed = JSON.parse(content) as {
    allocations: Array<{
      platform: string;
      campaignId?: string;
      recommendedBudgetPct: number;
      confidence: number;
      reasoning: string;
    }>;
    totalProjectedRoas: number;
    insights: string[];
  };

  const allocations: PlatformAllocation[] = parsed.allocations.map((a) => ({
    platform: a.platform as AdBudgetAllocationRequest['platforms'][number],
    campaignId: a.campaignId ?? undefined,
    recommendedBudgetPct: a.recommendedBudgetPct,
    recommendedBudgetAmount:
      Math.round(request.totalBudget * (a.recommendedBudgetPct / 100) * 100) / 100,
    confidence: a.confidence,
    reasoning: a.reasoning,
  }));

  return {
    allocations,
    totalProjectedRoas: parsed.totalProjectedRoas,
    insights: parsed.insights,
    model: AI_TEXT_MODEL,
    tokensInput,
    tokensOutput,
    costCents: estimateModelCost(AI_TEXT_MODEL, tokensInput, tokensOutput),
    durationMs,
  };
}
