
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  insight_id uuid REFERENCES public.insights(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  stock_changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert notifications" ON public.notifications
  FOR INSERT TO public WITH CHECK (true);
