-- Create waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Foreign key constraint to ensure referred_by points to a valid referral_code
  CONSTRAINT fk_referred_by FOREIGN KEY (referred_by) REFERENCES waitlist(referral_code)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by ON waitlist(referred_by);

-- Enable Row Level Security
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Create policy: Allow anonymous users to insert into waitlist
CREATE POLICY "Allow anonymous insert" ON waitlist
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create policy: Deny anonymous users from selecting from waitlist
CREATE POLICY "Deny anonymous select" ON waitlist
  FOR SELECT
  TO anon
  USING (false);

-- Create policy: Allow authenticated users to select all rows
CREATE POLICY "Allow authenticated select" ON waitlist
  FOR SELECT
  TO authenticated
  USING (true);