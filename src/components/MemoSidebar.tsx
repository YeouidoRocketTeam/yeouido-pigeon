import { useState, useEffect, useCallback } from "react";
import { Check, Loader2, ChevronDown, ChevronUp, Save, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Insight = Database["public"]["Tables"]["insights"]["Row"];

interface MemoSidebarProps {
  insight: Insight;
  onUpdated?: () => void;
}

const MemoSidebar = ({ insight, onUpdated }: MemoSidebarProps) => {
  const [memo, setMemo] = useState(insight.memo || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Fetch latest memo from DB when insight changes
  useEffect(() => {
    let cancelled = false;
    const fetchMemo = async () => {
      const { data } = await supabase
        .from("insights")
        .select("memo")
        .eq("id", insight.id)
        .single();
      if (!cancelled && data) {
        setMemo(data.memo || "");
      }
    };
    fetchMemo();
    return () => { cancelled = true; };
  }, [insight.id]);

  const saveMemo = useCallback(async () => {
    setSaving(true);
    const { error } = await supabase
      .from("insights")
      .update({ memo })
      .eq("id", insight.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      onUpdated?.();
    }
  }, [memo, insight.id, onUpdated]);

  const formattedDate = new Date(insight.created_at).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
      {/* Header */}
      <div className="bg-[hsl(var(--brand))] px-5 py-4 flex items-center justify-between rounded-t-2xl">
        <h3 className="text-base font-bold text-primary-foreground tracking-wide">Memo</h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-md text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {!isCollapsed && (
        <div className="p-5 space-y-4">
          {/* Date row */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</span>
            <div className="h-5 w-px bg-border" />
            <span className="text-sm font-semibold text-foreground">{formattedDate}</span>
            <CalendarDays className="h-4 w-4 text-muted-foreground ml-auto" />
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Textarea with lines */}
          <div className="relative">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="투자 아이디어를 자유롭게 작성하세요"
              className="w-full h-48 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/60 leading-[2rem]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(transparent, transparent 1.9375rem, hsl(var(--border)) 1.9375rem, hsl(var(--border)) 2rem)",
                backgroundPositionY: "-1px",
              }}
            />
          </div>

          {/* Save button */}
          <div className="flex items-center justify-end gap-2">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {saved && (
              <span className="text-xs text-accent flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> 저장됨
              </span>
            )}
            <button
              onClick={saveMemo}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[hsl(var(--brand))] text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              저장
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemoSidebar;
