import { motion } from "framer-motion";
import { ExternalLink, Globe } from "lucide-react";
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
}

const InsightCard = ({ insight, index, onClick }: InsightCardProps) => {
  const themes = (insight.themes as string[]) || [];
  const stocks = (insight.stocks as string[]) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 30,
        delay: index * 0.06,
      }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="bg-card rounded-xl p-5 card-shadow hover:card-shadow-hover transition-shadow cursor-pointer"
    >
      {/* Source info */}
      <div className="flex items-center gap-2 mb-3">
        {insight.favicon_url ? (
          <img
            src={insight.favicon_url}
            alt=""
            className="w-4 h-4 rounded-sm"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Globe className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-sm text-muted-foreground truncate">
          {insight.source_domain || "알 수 없는 출처"}
        </span>
        {insight.source_type && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {sourceTypeLabels[insight.source_type] || insight.source_type}
          </span>
        )}
        {insight.reliability_score && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              reliabilityColors[insight.reliability_score] || "bg-muted text-muted-foreground"
            }`}
          >
            신뢰도 {insight.reliability_score}/5
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold tracking-tight text-foreground leading-snug mb-2">
        {insight.ai_title || insight.original_title || "분석 중..."}
      </h3>

      {/* Summary */}
      {insight.ai_summary && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-4">
          {insight.ai_summary}
        </p>
      )}

      {/* Processing state */}
      {insight.status === "processing" && (
        <div className="flex items-center gap-2 mb-4">
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-sm text-primary font-medium">AI 분석 중...</span>
        </div>
      )}

      {insight.status === "error" && (
        <p className="text-sm text-destructive mb-4">
          분석 실패: {insight.error_message || "알 수 없는 오류"}
        </p>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {themes.map((theme: string) => (
          <span
            key={theme}
            className="text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary"
          >
            {theme}
          </span>
        ))}
        {stocks.map((stock: string) => (
          <span
            key={stock}
            className="text-xs font-medium px-3 py-1 rounded-full bg-accent/10 text-accent tabular-nums"
          >
            {stock}
          </span>
        ))}
      </div>

      {/* URL link */}
      {insight.url && (
        <a
          href={insight.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          원문 보기
        </a>
      )}
    </motion.div>
  );
};

export default InsightCard;
