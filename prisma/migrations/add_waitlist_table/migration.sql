-- Create waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  referral_code TEXT UNIQUE NOT NULL,
  referred_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_referral_code ON waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_waitlist_referred_by ON waitlist(referred_by);

-- Set up Row Level Security (RLS)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous users to insert into waitlist
CREATE POLICY "Allow anonymous insert" ON waitlist
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Deny anonymous users from selecting from waitlist (protects privacy)
CREATE POLICY "Deny anonymous select" ON waitlist
  FOR SELECT
  TO anon
  USING (false);

-- Policy: Allow authenticated users to select all rows
CREATE POLICY "Allow authenticated select" ON waitlist
  FOR SELECT
  TO authenticated
  USING (true);

-- Add foreign key constraint if referred_by should reference another waitlist entry
-- Note: This is commented out because it creates a circular reference issue during initial insert
-- ALTER TABLE waitlist ADD CONSTRAINT fk_waitlist_referred_by 
--   FOREIGN KEY (referred_by) REFERENCES waitlist(referral_code);