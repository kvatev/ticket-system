
-- Enable realtime for ticket_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;

-- Create trigger function for new messages
CREATE OR REPLACE FUNCTION public.notify_ticket_message()
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
    'type', 'INSERT',
    'table', 'ticket_messages',
    'schema', 'public',
    'record', row_to_json(NEW)
  );

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/notify-ticket-message',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_ticket_message_created
  AFTER INSERT ON public.ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_ticket_message();
