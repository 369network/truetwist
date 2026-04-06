# TrueTwist

AI-powered social media content automation SaaS platform.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Next.js API Routes (REST), Zod validation
- **Database:** PostgreSQL (Supabase) with Prisma ORM
- **Queue:** BullMQ + Redis (Upstash)
- **Auth:** JWT (access + refresh token rotation), Google OAuth, Apple Sign-In

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for local Postgres + Redis)

### Setup

```bash
# Clone and install
cd truetwist
npm install

# Start local services
docker-compose up -d

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Generate Prisma client & push schema
npm run db:generate
npm run db:push

# Seed development data
npm run db:seed

# Start development server
npm run dev
```

### Environment Variables

See `.env.example` for all required variables.

## API Endpoints

### Auth
- `POST /api/v1/auth/register` - Create account (email/password)
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password with token

### Users
- `GET /api/v1/users/me` - Get current user profile
- `PATCH /api/v1/users/me` - Update profile
- `PUT /api/v1/users/me/password` - Change password

### Businesses
- `GET /api/v1/businesses` - List user's businesses
- `POST /api/v1/businesses` - Create business
- `GET /api/v1/businesses/:id` - Get business detail
- `PATCH /api/v1/businesses/:id` - Update business
- `DELETE /api/v1/businesses/:id` - Delete business

### System
- `GET /api/v1/health` - Health check

## Project Structure

```
src/
├── app/
│   ├── api/v1/          # API route handlers
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
├── components/ui/       # shadcn/ui components
├── lib/
│   ├── auth.ts          # JWT, password hashing
│   ├── errors.ts        # Error handling
│   ├── prisma.ts        # Prisma client singleton
│   ├── redis.ts         # Redis client singleton
│   └── validations.ts   # Zod schemas
├── middleware/
│   ├── auth.ts          # Auth middleware
│   └── rate-limit.ts    # Rate limiting
├── queues/              # BullMQ queue definitions
├── services/            # Business logic
├── types/               # TypeScript types
└── utils/               # Utility functions
prisma/
├── schema.prisma        # Database schema
└── seed.ts              # Seed data
```

## Database

Schema defined in `prisma/schema.prisma` with tables for:
- Users, Sessions, Refresh Tokens
- Subscriptions, Teams, Team Members
- Businesses, Competitors
- Social Accounts
- Posts, Post Media, Post Schedules, Post Analytics
- AI Generations
- Viral Trends

## Queue System

Three BullMQ queues:
- `posting-queue` - Schedule and publish social media posts
- `content-generation-queue` - AI text/image/video generation
- `analytics-queue` - Fetch and aggregate post metrics
