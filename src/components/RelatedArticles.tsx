import { useState, useEffect } from "react";
import { Newspaper, ExternalLink, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

type Insight = Database["public"]["Tables"]["insights"]["Row"];

interface RelatedArticlesProps {
  currentInsight: Insight;
  onSelectInsight: (insight: Insight) => void;
}

const RelatedArticles = ({ currentInsight, onSelectInsight }: RelatedArticlesProps) => {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRelated = async () => {
      if (!user) return;
      setLoading(true);

      const currentThemes = (currentInsight.themes as string[]) || [];
      const currentStocks = ((currentInsight.stocks as any[]) || []).map((s) =>
        typeof s === "string" ? s : s.name
      );

      // Fetch recent insights (exclude current)
      const { data } = await supabase
        .from("insights")
        .select("*")
        .neq("id", currentInsight.id)
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!data || data.length === 0) {
        setArticles([]);
        setLoading(false);
        return;
      }

      // Score by theme/stock overlap
      const scored = data.map((ins) => {
        const themes = (ins.themes as string[]) || [];
        const stocks = ((ins.stocks as any[]) || []).map((s) =>
          typeof s === "string" ? s : s.name
        );

        let score = 0;
        for (const t of themes) {
          if (currentThemes.includes(t)) score += 2;
        }
        for (const s of stocks) {
          if (currentStocks.includes(s)) score += 3;
        }
        return { insight: ins, score };
      });

      const top = scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map((s) => s.insight);

      setArticles(top);
      setLoading(false);
    };

    fetchRelated();
  }, [currentInsight.id, user]);

  if (loading) {
    return (
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          관련 기사 추천
        </h2>
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-primary" />
        관련 기사 추천
      </h2>
      <div className="space-y-2">
        {articles.map((article) => {
          const title = article.ai_title
            ? article.ai_title.includes(":")
              ? article.ai_title.split(":")[0]
              : article.ai_title
            : article.original_title || "제목 없음";

          const themes = (article.themes as string[]) || [];

          return (
            <button
              key={article.id}
              onClick={() => onSelectInsight(article)}
              className="w-full text-left rounded-xl border bg-card p-4 hover:shadow-md hover:border-primary/20 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  {article.favicon_url ? (
                    <img src={article.favicon_url} alt="" className="w-4 h-4 rounded-sm" />
                  ) : (
                    <Globe className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {article.source_domain && (
                      <span className="text-[11px] text-muted-foreground">{article.source_domain}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(article.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                  {themes.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {themes.slice(0, 3).map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default RelatedArticles;
