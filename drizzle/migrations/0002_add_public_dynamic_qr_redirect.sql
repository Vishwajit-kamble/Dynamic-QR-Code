CREATE OR REPLACE FUNCTION public.resolve_qr_scan(p_code text, p_device_type text, p_referrer_host text)
RETURNS TABLE(destination_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code_id uuid;
  v_destination text;
  v_device text;
  v_referrer text;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[A-Za-z0-9_-]{8,32}$' THEN
    RETURN;
  END IF;

  SELECT q.id, q.destination_url
  INTO v_code_id, v_destination
  FROM public.qr_codes AS q
  WHERE q.code = p_code AND q.is_active = true
  LIMIT 1;

  IF v_code_id IS NULL THEN
    RETURN;
  END IF;

  v_device := CASE
    WHEN p_device_type IN ('mobile', 'tablet', 'desktop') THEN p_device_type
    ELSE 'unknown'
  END;
  v_referrer := CASE
    WHEN p_referrer_host IS NULL OR p_referrer_host = '' THEN NULL
    ELSE left(regexp_replace(p_referrer_host, '[^A-Za-z0-9.-]', '', 'g'), 253)
  END;

  INSERT INTO public.qr_scans (qr_code_id, device_type, referrer_host)
  VALUES (v_code_id, v_device, v_referrer);

  RETURN QUERY SELECT v_destination;
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_qr_scan(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_qr_scan(text, text, text) TO anon, authenticated;