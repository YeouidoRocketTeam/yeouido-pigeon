import { useState, useEffect } from "react";
import { Newspaper, ExternalLink, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Insight = Database["public"]["Tables"]["insights"]["Row"];

interface RelatedArticle {
  title: string;
  description: string;
  url: string;
  domain: string;
  pubDate: string;
}

interface RelatedArticlesProps {
  currentInsight: Insight;
  onSelectInsight?: (insight: Insight) => void;
}

const formatPubDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
};

const RelatedArticles = ({ currentInsight }: RelatedArticlesProps) => {
  const [articles, setArticles] = useState<RelatedArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRelated = async () => {
      setLoading(true);

      const themes = (currentInsight.themes as string[]) || [];
      const keywords = currentInsight.ai_keywords || "";

      if (!keywords && themes.length === 0) {
        setArticles([]);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("fetch-related-articles", {
          body: { keywords, themes },
        });

        if (error) {
          console.error("Error fetching related articles:", error);
          setArticles([]);
        } else if (data?.success && data.articles) {
          setArticles(data.articles);
        } else {
          setArticles([]);
        }
      } catch (err) {
        console.error("Error:", err);
        setArticles([]);
      }

      setLoading(false);
    };

    fetchRelated();
  }, [currentInsight.id]);

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
        {articles.map((article, i) => (
          <a
            key={i}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-left rounded-xl border bg-card p-4 hover:shadow-md hover:border-primary/20 transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                  {article.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {article.description}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[11px] text-muted-foreground">{article.domain}</span>
                  {article.pubDate && (
                    <span className="text-[11px] text-muted-foreground">
                      {formatPubDate(article.pubDate)}
                    </span>
                  )}
                </div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default RelatedArticles;
