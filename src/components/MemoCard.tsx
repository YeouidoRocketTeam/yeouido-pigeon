import { motion } from "framer-motion";
import { StickyNote, Trash2 } from "lucide-react";
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
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const MemoCard = ({ insight, index, onClick, onDeleted }: MemoCardProps) => {
  const title = insight.ai_title
    ? insight.ai_title.includes(":")
      ? insight.ai_title.split(":")[0]
      : insight.ai_title
    : insight.original_title || "제목 없음";

  const memoPreview = insight.memo || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className="group bg-card border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all hover:border-primary/20"
    >
      {/* Header: icon + title */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
          <StickyNote className="h-4 w-4 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {title}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {formatMemoDate(insight.updated_at)}에 저장함
          </p>
        </div>
      </div>

      {/* Memo content */}
      <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-4">
          {memoPreview}
        </p>
      </div>

      {/* Source domain tag */}
      {insight.source_domain && (
        <div className="mt-2.5 flex items-center gap-1.5">
          {insight.favicon_url && (
            <img src={insight.favicon_url} alt="" className="w-3.5 h-3.5 rounded-sm" />
          )}
          <span className="text-[11px] text-muted-foreground">{insight.source_domain}</span>
        </div>
      )}
    </motion.div>
  );
};

export default MemoCard;
