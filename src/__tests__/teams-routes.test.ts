/**
 * Tests for /api/v1/teams — team creation and listing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TEST_USER,
  buildAuthRequest,
  createPrismaMock,
  parseResponse,
} from './helpers';
import { generateAccessToken } from '@/lib/auth';
import type { PlanTier } from '@/types';

const prismaMock = createPrismaMock();
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/audit', () => ({
  auditFromRequest: vi.fn(),
  auditLog: vi.fn(),
  AuditActions: {},
}));

const { GET, POST } = await import('@/app/api/v1/teams/route');

const token = generateAccessToken(TEST_USER.id, TEST_USER.email, TEST_USER.plan as PlanTier);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/teams', () => {
  it('should return 401 without auth', async () => {
    const req = new (await import('next/server')).NextRequest(
      new URL('http://localhost:3000/api/v1/teams'),
      { method: 'GET' }
    );
    const res = await GET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it('should list owned and member teams', async () => {
    prismaMock.team.findMany.mockResolvedValue([
      {
        id: 'team-1',
        name: 'My Team',
        ownerId: TEST_USER.id,
        _count: { members: 3, invites: 1 },
        createdAt: new Date(),
      },
    ]);
    prismaMock.teamMember.findMany.mockResolvedValue([
      {
        userId: TEST_USER.id,
        role: 'editor',
        team: {
          id: 'team-2',
          name: 'Other Team',
          _count: { members: 5 },
          owner: { id: 'other-user', name: 'Other', email: 'other@test.com', avatarUrl: null },
        },
      },
    ]);

    const req = buildAuthRequest('GET', '/api/v1/teams', token);
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].myRole).toBe('owner');
    expect(body.data[1].myRole).toBe('editor');
  });
});

describe('POST /api/v1/teams', () => {
  it('should return 401 without auth', async () => {
    const req = new (await import('next/server')).NextRequest(
      new URL('http://localhost:3000/api/v1/teams'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      }
    );
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it('should return 422 for invalid team name', async () => {
    const req = buildAuthRequest('POST', '/api/v1/teams', token, {
      body: { name: '' },
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(422);
  });

  it('should create team successfully', async () => {
    const createdTeam = {
      id: 'team-new',
      name: 'New Team',
      ownerId: TEST_USER.id,
      _count: { members: 1 },
      createdAt: new Date(),
    };
    prismaMock.team.create.mockResolvedValue(createdTeam);

    const req = buildAuthRequest('POST', '/api/v1/teams', token, {
      body: { name: 'New Team' },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(201);
    expect(body.data.name).toBe('New Team');
    expect(body.data.id).toBe('team-new');
  });
});
