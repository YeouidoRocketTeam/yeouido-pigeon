import { useState, forwardRef } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Globe, Trash2, Star } from "lucide-react";
import MoveToProject from "@/components/MoveToProject";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type Insight = Database["public"]["Tables"]["insights"]["Row"];

const sourceTypeLabels: Record<string, string> = {
  news: "뉴스",
  report: "증권사 리포트",
  youtube: "유튜브",
  sns: "SNS",
  community: "커뮤니티",
  other: "기타",
};

const reliabilityColors: Record<number, string> = {
  1: "bg-destructive/10 text-destructive",
  2: "bg-destructive/10 text-destructive",
  3: "bg-muted text-muted-foreground",
  4: "bg-accent/10 text-accent",
  5: "bg-accent/10 text-accent",
};

interface InsightCardProps {
  insight: Insight;
  index: number;
  onClick?: () => void;
  onDeleted?: () => void;
}

const InsightCard = forwardRef<HTMLDivElement, InsightCardProps>(({ insight, index, onClick, onDeleted }, ref) => {
  const { toast } = useToast();
  const themes = (insight.themes as string[]) || [];
  const rawStocks = (insight.stocks as any[]) || [];
  const stocks = rawStocks.map((s) => typeof s === "string" ? { name: s, code: "", reason: "" } : { name: s.name, code: s.code || "", reason: s.reason || "" });
  const [isFavorited, setIsFavorited] = useState(insight.is_favorited ?? false);

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = !isFavorited;
    setIsFavorited(newValue);
    const { error } = await supabase.from("insights").update({ is_favorited: newValue }).eq("id", insight.id);
    if (error) {
      setIsFavorited(!newValue);
      toast({ title: "즐겨찾기 실패", variant: "destructive" });
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("insights").delete().eq("id", insight.id);
    if (error) {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "삭제 완료" });
      onDeleted?.();
    }
  };

  const timeAgo = (() => {
    const diff = Date.now() - new Date(insight.created_at).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30, delay: index * 0.06 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="bg-card rounded-xl card-shadow hover:card-shadow-hover transition-shadow cursor-pointer flex overflow-hidden"
    >
      {/* Left accent bar - color by sentiment */}
      <div className={`w-1 shrink-0 ${
        (insight.investment_sentiment === "bullish" || insight.investment_sentiment === "positive") ? "bg-green-500" :
        (insight.investment_sentiment === "bearish" || insight.investment_sentiment === "negative") ? "bg-red-500" :
        "bg-yellow-400"
      }`} />

      <div className="flex-1 px-4 py-3 min-w-0">
        {/* Top row: source type + time */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            {insight.favicon_url ? (
              <img src={insight.favicon_url} alt="" className="w-3.5 h-3.5 rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            {insight.source_type && (
              <span className="text-xs font-medium text-muted-foreground">
                {sourceTypeLabels[insight.source_type] || insight.source_type}
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground shrink-0">{timeAgo}</span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-1 mb-0.5">
          {(insight.original_title || insight.ai_title || "분석 중...").split(":")[0].trim()}
        </h3>

        {/* Summary */}
        {insight.ai_summary && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1 mb-2">
            {insight.ai_summary}
          </p>
        )}

        {/* Processing state */}
        {insight.status === "processing" && (
          <div className="flex items-center gap-1.5 mb-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-xs text-primary font-medium">AI 분석 중...</span>
          </div>
        )}

        {insight.status === "error" && (
          <p className="text-xs text-destructive mb-2 line-clamp-1">
            분석 실패: {insight.error_message || "알 수 없는 오류"}
          </p>
        )}

        {/* Memo preview */}
        {insight.memo && (
          <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1.5 italic">
            📝 {insight.memo}
          </p>
        )}

        {/* Bottom row: reliability + stocks + actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {insight.reliability_score != null && (() => {
              const details = insight.reliability_details as Record<string, { score: number }> | null;
              const belowCount = details
                ? Object.values(details).filter((d) => d.score < 40).length
                : 0;
              return belowCount >= 4 ? (
                <span className="text-xs font-bold text-destructive shrink-0">
                  ⚠️ 신뢰성 주의
                </span>
              ) : (
                <span className="text-xs font-bold text-amber-500 tabular-nums shrink-0">
                  {insight.reliability_score}
                  <span className="text-[10px] font-normal text-muted-foreground ml-0.5">신뢰도</span>
                </span>
              );
            })()}
            {stocks.map((stock) => (
              <a
                key={stock.name}
                href={stock.code ? `https://m.stock.naver.com/domestic/stock/${stock.code}/total` : `https://search.naver.com/search.naver?query=${encodeURIComponent(stock.name)}+주가`}
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums transition-colors border border-accent/30 text-accent hover:bg-accent/10"
              >
                {stock.name}
              </a>
            ))}
            {themes.slice(0, 2).map((theme: string) => (
              <span key={theme} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {theme}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={toggleFavorite} className="p-1 transition-colors rounded hover:bg-muted">
              <Star className={`w-3.5 h-3.5 ${isFavorited ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground hover:text-foreground"}`} />
            </button>
            <button onClick={handleDelete} className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded hover:bg-destructive/10">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
InsightCard.displayName = "InsightCard";

export default InsightCard;
