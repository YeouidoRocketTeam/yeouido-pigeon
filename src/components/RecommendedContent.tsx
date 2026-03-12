import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Loader2, Newspaper, Youtube, FileText, MessageSquare, BookOpen, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Insight = Database["public"]["Tables"]["insights"]["Row"];

type Recommendation = {
  title: string;
  description: string;
  type: "news" | "youtube" | "report" | "blog" | "community";
  search_query: string;
};

const typeIcons: Record<string, React.ReactNode> = {
  news: <Newspaper className="h-4 w-4" />,
  youtube: <Youtube className="h-4 w-4" />,
  report: <FileText className="h-4 w-4" />,
  blog: <BookOpen className="h-4 w-4" />,
  community: <MessageSquare className="h-4 w-4" />,
};

const typeLabels: Record<string, string> = {
  news: "뉴스",
  youtube: "유튜브",
  report: "리포트",
  blog: "블로그",
  community: "커뮤니티",
};

const getSearchUrl = (rec: Recommendation) => {
  if (rec.type === "youtube") {
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(rec.search_query)}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(rec.search_query)}`;
};

interface RecommendedContentProps {
  insight: Insight;
}

const RecommendedContent = ({ insight }: RecommendedContentProps) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [reasoning, setReasoning] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchRecommendations = async () => {
    if (loaded || loading) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("recommend-content", {
        body: {
          title: insight.ai_title || insight.original_title,
          summary: insight.ai_summary,
          themes: insight.themes,
          stocks: insight.stocks,
        },
      });

      if (error) throw error;
      if (data?.recommendations) {
        setRecommendations(data.recommendations);
        setReasoning(data.reasoning || "");
      }
    } catch (e) {
      console.error("Failed to fetch recommendations:", e);
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  };

  useEffect(() => {
    if (insight.status === "completed") {
      fetchRecommendations();
    }
  }, [insight.id, insight.status]);

  if (insight.status !== "completed") return null;

  return (
    <div className="mt-8 pt-6 border-t">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">AI 추천 콘텐츠</h2>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">추천 콘텐츠를 찾고 있어요...</span>
        </div>
      )}

      {reasoning && (
        <p className="text-xs text-muted-foreground mb-4 italic">{reasoning}</p>
      )}

      <div className="space-y-3">
        {recommendations.map((rec, i) => (
          <motion.a
            key={i}
            href={getSearchUrl(rec)}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
          >
            <div className="mt-0.5 text-muted-foreground group-hover:text-primary transition-colors">
              {typeIcons[rec.type] || <Newspaper className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {typeLabels[rec.type] || rec.type}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground leading-snug">{rec.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
            </div>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors mt-1 shrink-0" />
          </motion.a>
        ))}
      </div>
    </div>
  );
};

export default RecommendedContent;
