'use client';

import { useState } from 'react';

const TABS = ['getting-started', 'api-explorer', 'rate-limits', 'webhooks', 'examples'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  'getting-started': 'Getting Started',
  'api-explorer': 'API Explorer',
  'rate-limits': 'Rate Limits',
  webhooks: 'Webhooks',
  examples: 'Code Examples',
};

export default function DeveloperDocsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('getting-started');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Developer Documentation</h1>
          <p className="mt-2 text-gray-600">
            Build integrations with the TrueTwist Public API
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`whitespace-nowrap border-b-2 px-1 py-3 text-sm font-medium ${
                  activeTab === tab
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="rounded-lg bg-white p-8 shadow-sm">
          {activeTab === 'getting-started' && <GettingStarted />}
          {activeTab === 'api-explorer' && <ApiExplorer />}
          {activeTab === 'rate-limits' && <RateLimits />}
          {activeTab === 'webhooks' && <WebhookDocs />}
          {activeTab === 'examples' && <CodeExamples />}
        </div>
      </div>
    </div>
  );
}

function GettingStarted() {
  return (
    <div className="prose max-w-none">
      <h2>Getting Started with the TrueTwist API</h2>

      <h3>1. Generate an API Key</h3>
      <p>
        Navigate to <strong>Settings → API Keys</strong> or use the management endpoint to create a
        key. Keys are prefixed with <code>tt_</code> and come in three scopes:
      </p>
      <ul>
        <li><strong>read</strong> — List posts, schedules, analytics, and accounts</li>
        <li><strong>write</strong> — Create/update/delete posts, schedule posts, trigger AI generation</li>
        <li><strong>admin</strong> — All write permissions plus webhook management</li>
      </ul>
      <div className="rounded-md bg-amber-50 p-4 text-amber-800 text-sm">
        <strong>Important:</strong> Your API key is shown only once at creation. Store it securely.
        API access requires a paid plan (Starter or above).
      </div>

      <h3>2. Authenticate Requests</h3>
      <p>Include your API key in every request using one of these methods:</p>
      <pre className="rounded-md bg-gray-900 p-4 text-sm text-green-300 overflow-x-auto">
{`# Option A: X-API-Key header (recommended)
curl -H "X-API-Key: tt_your_key_here" \\
  https://app.truetwist.com/api/v1/public/posts

# Option B: Bearer token
curl -H "Authorization: Bearer tt_your_key_here" \\
  https://app.truetwist.com/api/v1/public/posts`}
      </pre>

      <h3>3. Make Your First Request</h3>
      <pre className="rounded-md bg-gray-900 p-4 text-sm text-green-300 overflow-x-auto">
{`curl -X POST https://app.truetwist.com/api/v1/public/posts \\
  -H "X-API-Key: tt_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "businessId": "your-business-id",
    "content": "Hello from the TrueTwist API! 🚀",
    "contentType": "text",
    "platforms": ["twitter", "linkedin"],
    "hashtags": ["automation", "socialmedia"]
  }'`}
      </pre>

      <h3>4. Base URL</h3>
      <table className="text-sm">
        <thead>
          <tr>
            <th>Endpoint Group</th>
            <th>Base URL</th>
            <th>Auth</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Public API</td>
            <td><code>/api/v1/public/*</code></td>
            <td>API Key</td>
          </tr>
          <tr>
            <td>Developer Management</td>
            <td><code>/api/v1/developer/*</code></td>
            <td>JWT (session)</td>
          </tr>
          <tr>
            <td>OpenAPI Spec</td>
            <td><code>/api/v1/openapi</code></td>
            <td>None</td>
          </tr>
        </tbody>
      </table>

      <h3>5. Error Handling</h3>
      <p>All errors follow a consistent format:</p>
      <pre className="rounded-md bg-gray-900 p-4 text-sm text-green-300 overflow-x-auto">
{`{
  "error": {
    "error": "Human-readable message",
    "code": "MACHINE_CODE",
    "details": null
  }
}`}
      </pre>
      <table className="text-sm">
        <thead>
          <tr><th>Code</th><th>Status</th><th>Meaning</th></tr>
        </thead>
        <tbody>
          <tr><td><code>UNAUTHORIZED</code></td><td>401</td><td>Invalid or missing API key</td></tr>
          <tr><td><code>FORBIDDEN</code></td><td>403</td><td>Insufficient scope or free plan</td></tr>
          <tr><td><code>NOT_FOUND</code></td><td>404</td><td>Resource not found</td></tr>
          <tr><td><code>VALIDATION_ERROR</code></td><td>422</td><td>Invalid request body</td></tr>
          <tr><td><code>RATE_LIMITED</code></td><td>429</td><td>Too many requests</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function ApiExplorer() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Interactive API Explorer</h2>
        <a
          href="/api/v1/openapi"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-indigo-50 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-100"
        >
          Download OpenAPI Spec (JSON)
        </a>
      </div>
      <iframe
        src={`https://petstore.swagger.io/?url=${encodeURIComponent(
          typeof window !== 'undefined'
            ? `${window.location.origin}/api/v1/openapi`
            : '/api/v1/openapi'
        )}`}
        className="h-[800px] w-full rounded-md border"
        title="Swagger UI"
      />
    </div>
  );
}

function RateLimits() {
  return (
    <div className="prose max-w-none">
      <h2>Rate Limits</h2>
      <p>
        Rate limits are enforced per API key using a sliding window. Limits are based on your
        subscription tier:
      </p>

      <table>
        <thead>
          <tr>
            <th>Plan</th>
            <th>Rate Limit</th>
            <th>Window</th>
            <th>Monthly Price</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Free</td><td colSpan={2}>API access not available</td><td>$0</td></tr>
          <tr><td>Starter</td><td>100 requests</td><td>1 hour</td><td>$29</td></tr>
          <tr><td>Pro</td><td>1,000 requests</td><td>1 hour</td><td>$79</td></tr>
          <tr><td>Business/Enterprise</td><td>5,000 requests</td><td>1 hour</td><td>Custom</td></tr>
        </tbody>
      </table>

      <h3>Rate Limit Headers</h3>
      <p>When rate limited, you receive a <code>429 Too Many Requests</code> response:</p>
      <pre className="rounded-md bg-gray-900 p-4 text-sm text-green-300">
{`HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": {
    "error": "Too many requests",
    "code": "RATE_LIMITED"
  }
}`}
      </pre>

      <h3>Best Practices</h3>
      <ul>
        <li>Cache responses where possible to reduce API calls</li>
        <li>Use exponential backoff when retrying after 429 responses</li>
        <li>Batch operations where the API supports it</li>
        <li>Monitor your usage via the API key dashboard</li>
      </ul>
    </div>
  );
}

function WebhookDocs() {
  return (
    <div className="prose max-w-none">
      <h2>Webhook Events</h2>
      <p>
        Configure webhooks to receive real-time notifications when events occur. All webhook
        URLs must use HTTPS.
      </p>

      <h3>Event Types</h3>
      <table>
        <thead>
          <tr><th>Event</th><th>Description</th><th>Trigger</th></tr>
        </thead>
        <tbody>
          <tr><td><code>post.published</code></td><td>Post successfully published</td><td>After posting to social platform</td></tr>
          <tr><td><code>post.failed</code></td><td>Post failed to publish</td><td>After all retry attempts exhausted</td></tr>
          <tr><td><code>analytics.threshold</code></td><td>Engagement threshold reached</td><td>When a post exceeds engagement targets</td></tr>
          <tr><td><code>trend.viral</code></td><td>Viral trend detected</td><td>When a trend matches your niche keywords</td></tr>
        </tbody>
      </table>

      <h3>Payload Format</h3>
      <pre className="rounded-md bg-gray-900 p-4 text-sm text-green-300 overflow-x-auto">
{`{
  "event": "post.published",
  "timestamp": "2026-04-05T10:30:00.000Z",
  "data": {
    "postId": "uuid",
    "scheduleId": "uuid",
    "platform": "twitter",
    "platformPostUrl": "https://twitter.com/...",
    "publishedAt": "2026-04-05T10:30:00.000Z"
  }
}`}
      </pre>

      <h3>Signature Verification</h3>
      <p>
        Every webhook delivery includes an <code>X-TrueTwist-Signature</code> header with an
        HMAC-SHA256 signature. Verify it to ensure the payload is authentic:
      </p>
      <pre className="rounded-md bg-gray-900 p-4 text-sm text-green-300 overflow-x-auto">
{`// Node.js verification
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return signature === \`sha256=\${expected}\`;
}

// Express middleware
app.post('/webhook', (req, res) => {
  const signature = req.headers['x-truetwist-signature'];
  const isValid = verifyWebhook(
    JSON.stringify(req.body),
    signature,
    process.env.TRUETWIST_WEBHOOK_SECRET
  );

  if (!isValid) return res.status(401).send('Invalid signature');

  // Process the event
  console.log(req.body.event, req.body.data);
  res.status(200).send('OK');
});`}
      </pre>

      <h3>Retry Policy</h3>
      <p>Failed deliveries are retried with exponential backoff:</p>
      <table>
        <thead>
          <tr><th>Attempt</th><th>Delay</th></tr>
        </thead>
        <tbody>
          <tr><td>1st retry</td><td>1 minute</td></tr>
          <tr><td>2nd retry</td><td>5 minutes</td></tr>
          <tr><td>3rd retry</td><td>15 minutes</td></tr>
          <tr><td>4th retry</td><td>1 hour</td></tr>
        </tbody>
      </table>
      <p>
        After 5 failed attempts, the delivery is marked as failed. After 10 consecutive endpoint
        failures, the endpoint is automatically disabled.
      </p>

      <h3>Additional Headers</h3>
      <table>
        <thead>
          <tr><th>Header</th><th>Description</th></tr>
        </thead>
        <tbody>
          <tr><td><code>X-TrueTwist-Signature</code></td><td>HMAC-SHA256 signature (<code>sha256=hex</code>)</td></tr>
          <tr><td><code>X-TrueTwist-Event</code></td><td>Event type (e.g. <code>post.published</code>)</td></tr>
          <tr><td><code>X-TrueTwist-Delivery</code></td><td>Unique delivery ID for deduplication</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function CodeExamples() {
  return (
    <div className="prose max-w-none">
      <h2>Code Examples</h2>

      <h3>JavaScript / Node.js</h3>
      <pre className="rounded-md bg-gray-900 p-4 text-sm text-green-300 overflow-x-auto">
{`const API_KEY = 'tt_your_key_here';
const BASE_URL = 'https://app.truetwist.com/api/v1/public';

async function truetwist(path, options = {}) {
  const res = await fetch(\`\${BASE_URL}\${path}\`, {
    ...options,
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(\`\${res.status}: \${err.error?.error}\`);
  }
  return res.json();
}

// List posts
const posts = await truetwist('/posts?page=1&pageSize=10');
console.log(posts.data);

// Create a post
const newPost = await truetwist('/posts', {
  method: 'POST',
  body: {
    businessId: 'your-business-id',
    content: 'Excited to announce our new feature! 🎉',
    platforms: ['twitter', 'linkedin'],
    hashtags: ['launch', 'product'],
  },
});

// Schedule the post
const schedule = await truetwist('/schedules', {
  method: 'POST',
  body: {
    postId: newPost.data.id,
    socialAccountId: 'your-account-id',
    platform: 'twitter',
    scheduledAt: '2026-04-10T14:00:00Z',
  },
});

// Get analytics
const analytics = await truetwist('/analytics?period=weekly&platform=twitter');
console.log(analytics.data.rollups);

// Trigger AI content generation
const generation = await truetwist('/generate', {
  method: 'POST',
  body: {
    type: 'text',
    prompt: 'Write an engaging tweet about our product launch',
    businessId: 'your-business-id',
  },
});
console.log('Generation queued:', generation.data.id);`}
      </pre>

      <h3>Python</h3>
      <pre className="rounded-md bg-gray-900 p-4 text-sm text-green-300 overflow-x-auto">
{`import requests

API_KEY = "tt_your_key_here"
BASE_URL = "https://app.truetwist.com/api/v1/public"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
}

# List posts
response = requests.get(f"{BASE_URL}/posts", headers=headers)
posts = response.json()["data"]
print(f"Found {len(posts)} posts")

# Create a post
new_post = requests.post(f"{BASE_URL}/posts", headers=headers, json={
    "businessId": "your-business-id",
    "content": "Hello from Python! 🐍",
    "contentType": "text",
    "platforms": ["twitter"],
    "hashtags": ["python", "automation"],
}).json()

print(f"Created post: {new_post['data']['id']}")

# Schedule it
schedule = requests.post(f"{BASE_URL}/schedules", headers=headers, json={
    "postId": new_post["data"]["id"],
    "socialAccountId": "your-account-id",
    "platform": "twitter",
    "scheduledAt": "2026-04-10T14:00:00Z",
}).json()

# Get analytics
analytics = requests.get(
    f"{BASE_URL}/analytics",
    headers=headers,
    params={"period": "daily", "platform": "twitter"},
).json()

for rollup in analytics["data"]["rollups"]:
    print(f"{rollup['periodStart']}: {rollup['engagements']} engagements")

# AI content generation
gen = requests.post(f"{BASE_URL}/generate", headers=headers, json={
    "type": "text",
    "prompt": "Write a LinkedIn post about AI in marketing",
    "businessId": "your-business-id",
}).json()

print(f"Generation queued: {gen['data']['id']}")`}
      </pre>

      <h3>cURL</h3>
      <pre className="rounded-md bg-gray-900 p-4 text-sm text-green-300 overflow-x-auto">
{`# List posts
curl -H "X-API-Key: tt_your_key_here" \\
  "https://app.truetwist.com/api/v1/public/posts"

# Create a post
curl -X POST "https://app.truetwist.com/api/v1/public/posts" \\
  -H "X-API-Key: tt_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"businessId":"your-id","content":"Hello!","platforms":["twitter"]}'

# Schedule a post
curl -X POST "https://app.truetwist.com/api/v1/public/schedules" \\
  -H "X-API-Key: tt_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"postId":"post-id","socialAccountId":"acct-id","platform":"twitter","scheduledAt":"2026-04-10T14:00:00Z"}'

# Get analytics
curl -H "X-API-Key: tt_your_key_here" \\
  "https://app.truetwist.com/api/v1/public/analytics?period=weekly"

# List connected accounts
curl -H "X-API-Key: tt_your_key_here" \\
  "https://app.truetwist.com/api/v1/public/accounts"

# Generate AI content
curl -X POST "https://app.truetwist.com/api/v1/public/generate" \\
  -H "X-API-Key: tt_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"text","prompt":"Write a viral tweet","businessId":"your-id"}'

# Create a webhook
curl -X POST "https://app.truetwist.com/api/v1/public/webhooks" \\
  -H "X-API-Key: tt_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://your-server.com/webhook","events":["post.published","post.failed"]}'`}
      </pre>
    </div>
  );
}
