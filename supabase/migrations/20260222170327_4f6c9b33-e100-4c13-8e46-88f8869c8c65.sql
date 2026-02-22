
-- Update the trigger function to use the anon key (publishable, safe to embed)
CREATE OR REPLACE FUNCTION public.notify_ticket_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  payload jsonb;
  supabase_url text := 'https://livaxhlywomfyrehokqc.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpdmF4aGx5d29tZnlyZWhva3FjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwMDY4NDQsImV4cCI6MjA4NjU4Mjg0NH0.sApPvjh799CGU0YVGApzmfPofhwOA9JTClVcpJNLuSo';
BEGIN
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END
  );

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/notify-ticket-change',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;
