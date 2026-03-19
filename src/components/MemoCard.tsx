import { motion } from "framer-motion";
import { Calendar, Share2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Insight = Database["public"]["Tables"]["insights"]["Row"];

interface MemoCardProps {
  insight: Insight;
  index: number;
  onClick: () => void;
  onDeleted: () => void;
}

const formatMemoDate = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const insightDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const isToday = insightDate.getTime() === today.getTime();
  const dateFormatted = date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  return isToday ? `오늘, ${dateFormatted}` : dateFormatted;
};

const MemoCard = ({ insight, index, onClick }: MemoCardProps) => {
  const title = insight.ai_title
    ? insight.ai_title.includes(":")
      ? insight.ai_title.split(":")[0]
      : insight.ai_title
    : insight.original_title || "제목 없음";

  const memoLines = (insight.memo || "").split("\n").filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="group cursor-pointer rounded-2xl overflow-hidden bg-card border shadow-sm hover:shadow-lg transition-all hover:border-primary/20"
    >
      {/* Header bar */}
      <div className="bg-brand px-5 py-3 flex items-center justify-between">
        <span className="text-brand-foreground font-bold text-base tracking-wide">Memo</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (navigator.share) {
              navigator.share({ title, text: insight.memo || "" });
            }
          }}
          className="text-brand-foreground/70 hover:text-brand-foreground transition-colors"
        >
          <Share2 className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        {/* Date row */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground text-xs font-medium">날짜</span>
          <span className="font-semibold text-foreground text-sm">
            {formatMemoDate(insight.updated_at)}
          </span>
          <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-0.5" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-foreground leading-snug line-clamp-2">
          {title}
        </h3>

        {/* Memo content as lined note */}
        <div className="space-y-0">
          {memoLines.length > 0 ? (
            memoLines.slice(0, 4).map((line, i) => (
              <div
                key={i}
                className="py-1.5 border-b border-border/40 text-sm text-foreground/70 leading-relaxed truncate"
              >
                · {line}
              </div>
            ))
          ) : (
            <>
              <div className="py-1.5 border-b border-border/40 text-sm text-muted-foreground">
                · 메모 내용을 입력해주세요
              </div>
              <div className="py-1.5 border-b border-border/40" />
            </>
          )}
          {/* Extra empty lines for the notepad look */}
          {memoLines.length > 0 && memoLines.length < 3 && (
            <div className="py-1.5 border-b border-border/40" />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MemoCard;
