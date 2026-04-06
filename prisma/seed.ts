import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo user
  const hashedPassword = await bcrypt.hash('Demo1234', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@truetwist.com' },
    update: {},
    create: {
      email: 'demo@truetwist.com',
      name: 'Demo User',
      hashedPassword,
      provider: 'email',
      plan: 'pro',
      onboardingCompleted: true,
    },
  });

  console.log(`Created user: ${user.email}`);

  // Create demo business
  const business = await prisma.business.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      userId: user.id,
      name: 'TrueTwist Demo Business',
      industry: 'Technology',
      description: 'A demo business for testing TrueTwist features.',
      website: 'https://truetwist.com',
      brandVoice: 'Professional, innovative, and approachable',
      targetAudience: {
        ageRange: '25-45',
        interests: ['social media', 'AI', 'marketing'],
        location: 'Global',
      },
      colors: {
        primary: '#3B82F6',
        secondary: '#10B981',
        accent: '#8B5CF6',
      },
    },
  });

  console.log(`Created business: ${business.name}`);

  // Create demo competitor
  const competitor = await prisma.competitor.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      businessId: business.id,
      name: 'Buffer',
      websiteUrl: 'https://buffer.com',
    },
  });

  console.log(`Created competitor: ${competitor.name}`);

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
