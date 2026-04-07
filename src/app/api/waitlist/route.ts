import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "../../../lib/supabase-server";
import { z } from "zod";

// Validation schema for waitlist submission
const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  referralCode: z.string().optional().nullable(),
});

// Helper function to generate a referral code
function generateReferralCode(email: string): string {
  // Generate a unique referral code based on email and timestamp
  const timestamp = Date.now().toString(36);
  const emailHash = Buffer.from(email)
    .toString("base64")
    .slice(0, 8)
    .replace(/[^a-zA-Z0-9]/g, "x");
  return `${emailHash}${timestamp}`.toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = waitlistSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validationResult.error.format() },
        { status: 400 },
      );
    }

    const { email, referralCode } = validationResult.data;
    const supabase = createServerClient();

    // Check if email already exists in waitlist
    const { data: existingEntry, error: checkError } = await supabase
      .from("waitlist")
      .select("referral_code")
      .eq("email", email)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      console.error("Error checking existing email:", checkError);
      return NextResponse.json(
        { error: "Failed to check waitlist status" },
        { status: 500 },
      );
    }

    // If email already exists, return existing referral code
    if (existingEntry) {
      return NextResponse.json({
        success: true,
        message: "Email already registered to waitlist",
        referralCode: existingEntry.referral_code,
        referralLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://truetwist.com"}?ref=${existingEntry.referral_code}`,
      });
    }

    // Generate new referral code
    const newReferralCode = generateReferralCode(email);

    // Validate referral code if provided
    if (referralCode) {
      const { data: referrer, error: referrerError } = await supabase
        .from("waitlist")
        .select("id")
        .eq("referral_code", referralCode)
        .single();

      if (referrerError || !referrer) {
        return NextResponse.json(
          { error: "Invalid referral code" },
          { status: 400 },
        );
      }
    }

    // Insert new waitlist entry
    const { data, error: insertError } = await supabase
      .from("waitlist")
      .insert({
        email,
        referral_code: newReferralCode,
        referred_by: referralCode || null,
      })
      .select("referral_code")
      .single();

    if (insertError) {
      console.error("Error inserting into waitlist:", insertError);
      return NextResponse.json(
        { error: "Failed to add to waitlist" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Successfully added to waitlist",
      referralCode: data.referral_code,
      referralLink: `${process.env.NEXT_PUBLIC_APP_URL || "https://truetwist.com"}?ref=${data.referral_code}`,
    });
  } catch (error) {
    console.error("Unexpected error in waitlist API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Optional: GET endpoint to check waitlist status (admin/authenticated only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");
    const referralCode = searchParams.get("ref");

    const supabase = createServerClient();

    if (email) {
      // Check by email
      const { data, error } = await supabase
        .from("waitlist")
        .select("email, referral_code, created_at")
        .eq("email", email)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return NextResponse.json({ exists: false });
        }
        throw error;
      }

      return NextResponse.json({
        exists: true,
        email: data.email,
        referralCode: data.referral_code,
        joinedAt: data.created_at,
      });
    } else if (referralCode) {
      // Check by referral code
      const { data, error } = await supabase
        .from("waitlist")
        .select("email, referral_code, created_at")
        .eq("referral_code", referralCode)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return NextResponse.json({ exists: false });
        }
        throw error;
      }

      return NextResponse.json({
        exists: true,
        email: data.email,
        referralCode: data.referral_code,
        joinedAt: data.created_at,
      });
    } else {
      return NextResponse.json(
        { error: "Please provide email or referral code" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Error checking waitlist status:", error);
    return NextResponse.json(
      { error: "Failed to check waitlist status" },
      { status: 500 },
    );
  }
}
