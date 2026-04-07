import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST, GET } from "@/app/api/waitlist/route";
import { createServerClient } from "@/lib/supabase-server";
import { NextRequest } from "next/server";

// Mock Supabase client
vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
        single: vi.fn(),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
}));

describe("Waitlist API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/waitlist", () => {
    it("should return 400 for invalid email", async () => {
      const request = new NextRequest("http://localhost:3000/api/waitlist", {
        method: "POST",
        body: JSON.stringify({ email: "invalid-email" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Invalid request");
    });

    it("should return existing referral code for duplicate email", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { referral_code: "EXISTING123" },
                error: null,
              })),
            })),
          })),
        })),
      };

      (createServerClient as any).mockReturnValue(mockSupabase);

      const request = new NextRequest("http://localhost:3000/api/waitlist", {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.referralCode).toBe("EXISTING123");
    });

    it("should create new waitlist entry for new email", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: null,
                error: { code: "PGRST116" },
              })),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { referral_code: "NEWREF456" },
                error: null,
              })),
            })),
          })),
        })),
      };

      (createServerClient as any).mockReturnValue(mockSupabase);

      const request = new NextRequest("http://localhost:3000/api/waitlist", {
        method: "POST",
        body: JSON.stringify({ email: "new@example.com" }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.referralCode).toBe("NEWREF456");
    });
  });

  describe("GET /api/waitlist", () => {
    it("should return 400 if no email or referral code provided", async () => {
      const request = new NextRequest("http://localhost:3000/api/waitlist");

      const response = await GET(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Please provide email or referral code");
    });

    it("should check waitlist status by email", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  email: "test@example.com",
                  referral_code: "TEST123",
                  created_at: "2024-01-01T00:00:00Z",
                },
                error: null,
              })),
            })),
          })),
        })),
      };

      (createServerClient as any).mockReturnValue(mockSupabase);

      const request = new NextRequest(
        "http://localhost:3000/api/waitlist?email=test@example.com",
      );

      const response = await GET(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.exists).toBe(true);
      expect(data.email).toBe("test@example.com");
      expect(data.referralCode).toBe("TEST123");
    });
  });
});
