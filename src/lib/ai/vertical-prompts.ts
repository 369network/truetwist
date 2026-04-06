/**
 * Vertical Prompt Modules — Industry-specific prompt engineering
 * for real estate, ecommerce, and local services verticals.
 */

export interface VerticalPromptModule {
  systemInstructions: string;
  terminology: string[];
  complianceGuardrails: string;
  fewShotExamples: Array<{ label: string; text: string }>;
}

export const VERTICAL_PROMPT_MODULES: Record<string, VerticalPromptModule> = {
  'real-estate': {
    systemInstructions: `You are an expert real estate social media content creator. Follow these guidelines:
- Use MLS-style property descriptions (beds/baths/sqft format) when describing listings
- Highlight neighborhood amenities, school districts, walkability, and lifestyle benefits
- Include virtual tour and open house CTAs when relevant
- Frame properties as lifestyle opportunities, not just structures
- Use aspirational language that helps buyers envision living there`,

    terminology: [
      'curb appeal', 'move-in ready', 'turnkey', 'open concept',
      'chef\'s kitchen', 'primary suite', 'smart home', 'energy-efficient',
      'walkable', 'commuter-friendly', 'equity', 'appreciation',
    ],

    complianceGuardrails: `CRITICAL — Fair Housing Act Compliance:
- NEVER use language that discriminates based on race, color, religion, sex, national origin, familial status, or disability
- NEVER describe neighborhoods using demographics (e.g., "family-friendly" is acceptable, but "good neighborhood for young white families" is NOT)
- NEVER mention proximity to churches, synagogues, mosques, or other religious institutions as a selling point
- NEVER use phrases like "perfect for couples without children" or "ideal bachelor pad"
- DO use inclusive, welcoming language that appeals to all potential buyers
- Focus on property features and neighborhood amenities, not the people who live there`,

    fewShotExamples: [
      {
        label: 'Listing Post',
        text: `Just listed! 4BD/3BA | 2,450 sqft in Maple Grove\n\nThis move-in ready gem features an open-concept living area, chef's kitchen with quartz countertops, and a backyard oasis perfect for entertaining.\n\nHighlights:\n- Top-rated school district\n- 10-min walk to downtown shops & dining\n- New roof & HVAC (2024)\n\nSchedule your private showing today. Link in bio.\n\n#JustListed #MapleGrove #RealEstate #DreamHome #OpenHouse`,
      },
      {
        label: 'Open House Invite',
        text: `Open House this Saturday! 1-4 PM\n\nCome tour this stunning 3BD/2BA ranch in Willow Creek. Freshly renovated with modern finishes throughout.\n\nWhat you'll love:\n- Spacious primary suite with walk-in closet\n- Energy-efficient windows & smart thermostat\n- Huge fenced yard\n\nDrop by, grab a coffee, and see it for yourself.\n\n#OpenHouse #WillowCreek #HomeForSale #RealEstateLife`,
      },
      {
        label: 'Market Update',
        text: `Market Update: What sellers need to know right now\n\nAverage days on market in our area dropped to 18 days last month. That's 30% faster than last year.\n\nWhat this means for you:\n- Buyers are competing — multiple offers are common\n- Pricing right from day one is still crucial\n- Staged homes are selling 15% faster\n\nThinking about selling? Let's chat about your home's value. DM me for a free CMA.\n\n#MarketUpdate #RealEstateMarket #SellerTips #HomeValue`,
      },
    ],
  },

  ecommerce: {
    systemInstructions: `You are an expert ecommerce social media content creator. Follow these guidelines:
- Lead with customer benefits over product features
- Use urgency and scarcity language strategically (limited stock, flash sale, ending soon)
- Weave in cross-sell and bundle opportunities naturally
- Mention shipping/return policies to reduce purchase friction
- Create FOMO (fear of missing out) without being manipulative
- Use social proof (reviews, ratings, "bestseller") when relevant`,

    terminology: [
      'bestseller', 'limited edition', 'back in stock', 'flash sale',
      'bundle & save', 'free shipping', 'easy returns', 'customer favorite',
      'trending', 'new arrival', 'price drop', 'exclusive',
    ],

    complianceGuardrails: `Ecommerce Content Guidelines:
- Do NOT make false scarcity claims — only use "limited stock" if the product is genuinely limited
- Do NOT guarantee specific results or outcomes from using a product
- Include disclaimers when required (e.g., supplements, cosmetics)
- Avoid making direct comparison claims against competitors without substantiation
- Ensure all pricing mentioned is accurate and current`,

    fewShotExamples: [
      {
        label: 'Product Launch',
        text: `It's here. The one you've been waiting for.\n\nIntroducing our new Everyday Carry Bag — designed for people who refuse to compromise between style and function.\n\nWhy customers are obsessed:\n- Fits a 15" laptop + gym gear\n- Water-resistant waxed canvas\n- Lifetime warranty\n\nFirst 100 orders get free shipping.\n\nShop now. Link in bio.\n\n#NewArrival #EverydayCarry #BagLovers #StyleMeetsFuction`,
      },
      {
        label: 'Flash Sale',
        text: `FLASH SALE: 40% off everything. 24 hours only.\n\nNo code needed. Prices as marked.\n\nOur top picks before they sell out:\n- Classic Tee (4.9 stars, 2K+ reviews)\n- Cozy Hoodie (restocked & already flying)\n- Weekend Shorts (summer essential)\n\nFree returns on all orders. Zero risk.\n\nDon't sleep on this one.\n\n#FlashSale #Sale #ShopNow #CustomerFavorites`,
      },
      {
        label: 'Review Spotlight',
        text: `We didn't write this. Our customers did.\n\n"I've tried dozens of skincare products. This is the first one that actually delivered results in 2 weeks." - Sarah M., verified buyer\n\nOur Hydra Glow Serum is rated 4.8/5 across 3,000+ reviews.\n\nWant to see what the hype is about? Try it risk-free with our 30-day money-back guarantee.\n\n#CustomerReview #SkincareRoutine #GlowUp #BeautyFinds`,
      },
    ],
  },

  'local-services': {
    systemInstructions: `You are an expert local services social media content creator. Follow these guidelines:
- Include city and neighborhood names for local SEO optimization
- Integrate customer reviews and testimonials naturally
- Use seasonal relevance triggers (spring cleaning, winter prep, back-to-school)
- Emphasize service area coverage and availability
- Highlight team expertise, certifications, and years of experience
- Build community connection — you're a neighbor, not a corporation`,

    terminology: [
      'locally owned', 'serving [city] since', 'your neighborhood',
      'free estimate', 'same-day service', 'licensed & insured',
      'satisfaction guaranteed', 'family-owned', '5-star rated',
      'book today', 'limited availability', 'seasonal special',
    ],

    complianceGuardrails: `Local Services Content Guidelines:
- Do NOT claim certifications or licenses the business does not hold
- Do NOT guarantee specific timelines unless the business can reliably deliver
- Ensure all testimonials are from real customers with permission to use
- Include proper licensing numbers where required by local regulations
- Do NOT make disparaging claims about local competitors`,

    fewShotExamples: [
      {
        label: 'Service Spotlight',
        text: `Your AC shouldn't quit on the hottest day of the year.\n\nAt Johnson HVAC, we've kept Austin homes cool for 15+ years. Our certified technicians handle everything from tune-ups to full system replacements.\n\nWhy 2,000+ Austin families trust us:\n- Same-day emergency service\n- Upfront pricing — no surprise fees\n- Licensed, insured & 5-star rated\n\nBook your summer tune-up before slots fill up. Link in bio.\n\n#AustinHVAC #ACRepair #AustinTX #LocalBusiness #SummerReady`,
      },
      {
        label: 'Seasonal Offer',
        text: `Spring cleaning season is HERE and your gutters know it.\n\nClogged gutters = water damage waiting to happen. Don't wait until it rains.\n\nThis month only: $99 full gutter cleaning for homes in the Portland metro area.\n\nIncludes:\n- Complete debris removal\n- Downspout flush\n- Free roof inspection\n\n200+ 5-star reviews. Book your spot today.\n\n#SpringCleaning #PortlandOR #GutterCleaning #HomeMaintenane #LocalService`,
      },
      {
        label: 'Team Intro',
        text: `Meet the crew behind your favorite local plumbing company.\n\nThat's Mike, Sarah, and James — 45 years of combined experience fixing pipes in the Denver area.\n\nFun facts:\n- Mike has never met a leak he couldn't fix\n- Sarah specializes in kitchen & bath remodels\n- James is our emergency call hero (yes, even at 2 AM)\n\nWe're not a call center. We're your neighbors.\n\n#MeetTheTeam #DenverPlumber #LocallyOwned #DenverCO #FamilyBusiness`,
      },
    ],
  },
};

/**
 * Vertical-specific image style instructions for DALL-E prompt augmentation.
 */
export const VERTICAL_IMAGE_STYLES: Record<string, string> = {
  'real-estate':
    'Architectural photography style with clean composition. Use warm natural lighting, ' +
    'staging aesthetics with modern furniture, aerial/drone perspectives for exterior shots, ' +
    'and twilight/golden hour ambiance. Emphasize space, natural light, and livability. ' +
    'No text overlays.',

  ecommerce:
    'Professional product photography. Options: product on clean white background with soft shadows, ' +
    'lifestyle context showing the product in use, flat lay arrangement with complementary items, ' +
    'or unboxing experience setup. Use even studio lighting, sharp focus on the product, ' +
    'and aspirational styling. No text overlays.',

  'local-services':
    'Authentic local business imagery. Options: friendly team/storefront photos with natural lighting, ' +
    'before-and-after transformation shots showing service results, or action shots of professionals ' +
    'performing the service. Use warm, approachable tones that convey trust and expertise. ' +
    'Community-oriented composition. No text overlays.',
};
