CREATE OR REPLACE FUNCTION public.get_qr_analytics(p_days integer DEFAULT 30)
RETURNS TABLE (
  qr_code_id uuid,
  scan_day date,
  device_type text,
  device_count bigint,
  total_scans bigint,
  latest_scan timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
  SELECT
    q.id AS qr_code_id,
    s.scanned_at::date AS scan_day,
    COALESCE(s.device_type, 'unknown') AS device_type,
    count(s.id)::bigint AS device_count,
    (
      SELECT count(*)::bigint
      FROM public.qr_scans AS all_scans
      WHERE all_scans.qr_code_id = q.id
    ) AS total_scans,
    max(s.scanned_at) AS latest_scan
  FROM public.qr_codes AS q
  LEFT JOIN public.qr_scans AS s
    ON s.qr_code_id = q.id
    AND s.scanned_at >= now() - make_interval(days => GREATEST(1, LEAST(COALESCE(p_days, 30), 90)))
  WHERE q.owner_id = auth.uid()
  GROUP BY q.id, s.scanned_at::date, COALESCE(s.device_type, 'unknown')
  ORDER BY q.id, s.scanned_at::date;
$function$;
REVOKE ALL ON FUNCTION public.get_qr_analytics(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_qr_analytics(integer) TO authenticated;