import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Globe, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import MemoSidebar from "@/components/MemoSidebar";
import RecommendedContent from "@/components/RecommendedContent";
import MoveToProject from "@/components/MoveToProject";
import type { Database } from "@/integrations/supabase/types";

type Insight = Database["public"]["Tables"]["insights"]["Row"];

const sourceTypeLabels: Record<string, string> = {
  news: "뉴스 미디어",
  report: "증권사 리포트",
  youtube: "유튜브",
  sns: "소셜 미디어",
  community: "커뮤니티",
  other: "기타",
};

interface InsightDetailProps {
  insight: Insight;
  onBack: () => void;
  onDeleted: () => void;
}

const InsightDetail = ({ insight, onBack, onDeleted }: InsightDetailProps) => {
  const { toast } = useToast();
  const themes = (insight.themes as string[]) || [];
  const stocks = (insight.stocks as string[]) || [];

  const handleDelete = async () => {
    const { error } = await supabase.from("insights").delete().eq("id", insight.id);
    if (error) {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "삭제 완료" });
      onDeleted();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          돌아가기
        </button>
        <div className="flex items-center gap-1">
          <MoveToProject
            insightId={insight.id}
            currentProjectId={(insight as any).project_id ?? null}
          />
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        {/* Main content */}
        <div>
          {/* Source */}
          <div className="flex items-center gap-2 mb-4">
            {insight.favicon_url ? (
              <img src={insight.favicon_url} alt="" className="w-5 h-5 rounded-sm" />
            ) : (
              <Globe className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">{insight.source_domain}</span>
            {insight.source_type && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {sourceTypeLabels[insight.source_type] || insight.source_type}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            {insight.ai_title || insight.original_title || "제목 없음"}
          </h1>

          {/* Reliability */}
          {insight.reliability_score && (
            <div className="flex items-center gap-2 mb-6">
              <span className="text-sm text-muted-foreground">신뢰도</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-2 w-6 rounded-full ${
                      i <= insight.reliability_score! ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {insight.ai_summary && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-foreground mb-3">AI 요약</h2>
              <p className="text-base text-muted-foreground leading-relaxed">{insight.ai_summary}</p>
            </div>
          )}

          {/* Themes */}
          {themes.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">관련 테마</h2>
              <div className="flex flex-wrap gap-2">
                {themes.map((theme: string) => (
                  <span key={theme} className="text-sm font-medium px-4 py-1.5 rounded-full bg-primary/10 text-primary">
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stocks */}
          {stocks.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-foreground mb-3">관련 종목</h2>
              <div className="flex flex-wrap gap-2">
                {stocks.map((stock: string) => (
                  <a
                    key={stock}
                    href={`kiwoomhero://stock?name=${encodeURIComponent(stock)}`}
                    className="text-sm font-medium px-4 py-1.5 rounded-full bg-accent/10 text-accent tabular-nums hover:bg-accent/20 transition-colors"
                  >
                    {stock}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Link */}
          {insight.url && (
            <a
              href={insight.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              원문 보기
            </a>
          )}

          {/* Recommended Content */}
          <RecommendedContent insight={insight} />

          {/* Meta */}
          <div className="mt-8 pt-4 border-t text-xs text-muted-foreground">
            추가일: {new Date(insight.created_at).toLocaleDateString("ko-KR")}
          </div>
        </div>

        {/* Right sidebar - Yellow memo */}
        <div className="hidden lg:block">
          <div className="sticky top-20">
            <MemoSidebar insight={insight} />
          </div>
        </div>
      </div>

      {/* Mobile memo - shown below content */}
      <div className="mt-6 lg:hidden">
        <MemoSidebar insight={insight} />
      </div>
    </motion.div>
  );
};

export default InsightDetail;
