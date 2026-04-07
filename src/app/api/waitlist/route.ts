import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const supabase = createServerClient();
    const refCode = Buffer.from(email).toString("base64").slice(0, 12).replace(/[^a-zA-Z0-9]/g, "x");

    const { error } = await supabase.from("waitlist").upsert(
      { email: email.toLowerCase(), referral_code: refCode },
      { onConflict: "email" }
    );

    if (error) {
      console.error("Waitlist insert error:", error);
      return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
    }

    return NextResponse.json({ referralCode: refCode });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
