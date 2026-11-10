CREATE OR REPLACE FUNCTION public.enforce_qr_code_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.owner_id::text, 0));
  SELECT count(*) INTO existing_count
  FROM public.qr_codes
  WHERE owner_id = NEW.owner_id;
  IF existing_count >= 50 THEN
    RAISE EXCEPTION 'A workspace can have up to 50 QR codes'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER qr_codes_enforce_limit
BEFORE INSERT ON public.qr_codes
FOR EACH ROW EXECUTE FUNCTION public.enforce_qr_code_limit();