CREATE TABLE public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Za-z0-9_-]{8,32}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  destination_url text NOT NULL CHECK (destination_url ~* '^https?://'),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_codes TO authenticated;
GRANT ALL ON public.qr_codes TO service_role;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can manage their QR codes" ON public.qr_codes FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX qr_codes_owner_created_idx ON public.qr_codes (owner_id, created_at DESC);

CREATE TABLE public.qr_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_code_id uuid NOT NULL REFERENCES public.qr_codes(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  device_type text NOT NULL DEFAULT 'unknown' CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown')),
  referrer_host text
);
GRANT SELECT ON public.qr_scans TO authenticated;
GRANT ALL ON public.qr_scans TO service_role;
ALTER TABLE public.qr_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners can read scans for their QR codes" ON public.qr_scans FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.qr_codes WHERE qr_codes.id = qr_scans.qr_code_id AND qr_codes.owner_id = auth.uid()));
CREATE INDEX qr_scans_code_time_idx ON public.qr_scans (qr_code_id, scanned_at DESC);