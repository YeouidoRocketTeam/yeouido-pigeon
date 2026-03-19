
-- Enable pgvector extension in public schema so types are accessible
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Create insight_embeddings table for vector store
CREATE TABLE public.insight_embeddings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_id uuid REFERENCES public.insights(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  content_text text NOT NULL,
  embedding vector(768),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(insight_id)
);

-- Enable RLS
ALTER TABLE public.insight_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own embeddings" ON public.insight_embeddings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own embeddings" ON public.insight_embeddings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own embeddings" ON public.insight_embeddings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.insight_embeddings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Similarity search function
CREATE OR REPLACE FUNCTION public.match_insights(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  insight_id uuid,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ie.insight_id,
    (1 - (ie.embedding <=> query_embedding))::float AS similarity
  FROM public.insight_embeddings ie
  WHERE
    (p_user_id IS NULL OR ie.user_id = p_user_id)
    AND (1 - (ie.embedding <=> query_embedding))::float > match_threshold
  ORDER BY ie.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
