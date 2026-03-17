
DROP POLICY "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert own notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
