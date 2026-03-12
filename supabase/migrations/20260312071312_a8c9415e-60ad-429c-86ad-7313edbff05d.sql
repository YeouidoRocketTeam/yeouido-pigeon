
-- Add memo column to insights
ALTER TABLE public.insights ADD COLUMN IF NOT EXISTS memo text;

-- Create subscriptions table for auto-fetch
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_name text NOT NULL,
  source_url text NOT NULL,
  source_domain text,
  favicon_url text,
  is_active boolean NOT NULL DEFAULT true,
  fetch_interval text NOT NULL DEFAULT 'daily',
  last_fetched_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON public.subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subscriptions" ON public.subscriptions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add realtime for subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
