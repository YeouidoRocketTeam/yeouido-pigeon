import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, Globe, Trash2, Star, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import MemoSidebar from "@/components/MemoSidebar";
import RecommendedContent from "@/components/RecommendedContent";
import MoveToProject from "@/components/MoveToProject";
import InvestmentSentiment from "@/components/InvestmentSentiment";
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
  onUpdated?: () => void;
}

const InsightDetail = ({ insight, onBack, onDeleted, onUpdated }: InsightDetailProps) => {
  const { toast } = useToast();
  const themes = (insight.themes as string[]) || [];
  const stocks = (insight.stocks as string[]) || [];
  const [isFavorited, setIsFavorited] = useState(insight.is_favorited ?? false);

  const toggleFavorite = async () => {
    const newValue = !isFavorited;
    setIsFavorited(newValue);
    const { error } = await supabase.from("insights").update({ is_favorited: newValue }).eq("id", insight.id);
    if (error) {
      setIsFavorited(!newValue);
      toast({ title: "즐겨찾기 실패", description: error.message, variant: "destructive" });
    } else {
      onUpdated?.();
    }
  };

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
          <Button variant="ghost" size="sm" onClick={toggleFavorite}>
            <Star className={`h-4 w-4 ${isFavorited ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
          </Button>
          <MoveToProject
            insightId={insight.id}
            currentProjectId={(insight as any).project_id ?? null}
          />
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

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

        {/* Sentiment + Themes + Stocks with Memo side-by-side */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 mb-6">
          <div>
            {/* Investment Sentiment */}
            <InvestmentSentiment sentiment={(insight as any).investment_sentiment} />

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
                      href={`https://finance.naver.com/search/searchList.naver?query=${encodeURIComponent(stock)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium px-4 py-1.5 rounded-full bg-accent/10 text-accent tabular-nums hover:bg-accent/20 transition-colors"
                    >
                      {stock}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Memo - right side on desktop */}
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <MemoSidebar insight={insight} />
            </div>
          </div>
        </div>

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

        {/* Disclaimer */}
        <div className="mt-6 flex items-start gap-2 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            본 분석은 AI가 생성한 교육 목적의 정보입니다. 투자 권유가 아니며, 실제 투자 결정 전에는 반드시 자체적인 조사와 전문가 상담을 진행하시기 바랍니다.
          </p>
        </div>

        {/* Meta */}
        <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
          추가일: {new Date(insight.created_at).toLocaleDateString("ko-KR")}
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
