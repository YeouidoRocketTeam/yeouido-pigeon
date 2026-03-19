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
  const [lastEditedAt, setLastEditedAt] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [initialMemo, setInitialMemo] = useState(insight.memo || "");

  useEffect(() => {
    let cancelled = false;
    const fetchMemo = async () => {
      const { data } = await supabase
        .from("insights")
        .select("memo, updated_at")
        .eq("id", insight.id)
        .single();
      if (!cancelled && data) {
        setMemo(data.memo || "");
        setInitialMemo(data.memo || "");
        // Show edited date if memo exists and updated_at differs from created_at by > 1min
        if (data.memo && data.updated_at) {
          const updatedTime = new Date(data.updated_at).getTime();
          const createdTime = new Date(insight.created_at).getTime();
          if (updatedTime - createdTime > 60000) {
            setLastEditedAt(data.updated_at);
          }
        }
      }
    };
    fetchMemo();
    return () => { cancelled = true; };
  }, [insight.id, insight.created_at]);

  const saveMemo = useCallback(async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("insights")
      .update({ memo, updated_at: now })
      .eq("id", insight.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setLastEditedAt(now);
      setInitialMemo(memo);
      setIsDirty(false);
      setTimeout(() => setSaved(false), 1500);
      onUpdated?.();
    }
  }, [memo, insight.id, onUpdated]);

  const handleMemoChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMemo(val);
    setIsDirty(val !== initialMemo);
  };

  const formatEditedDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isEditToday = d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const datePart = isEditToday
      ? `오늘 ${d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`
      : d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" }) +
        ` ${d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
    return `${datePart}에 수정함`;
  };

  const createdDate = new Date(insight.created_at);
  const isToday = (() => {
    const now = new Date();
    return createdDate.getFullYear() === now.getFullYear() &&
      createdDate.getMonth() === now.getMonth() &&
      createdDate.getDate() === now.getDate();
  })();

  const formattedDate = `${isToday ? "오늘, " : ""}${createdDate.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;

  const LINE_HEIGHT = "2rem";

  return (
    <div className="bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
      {/* Header - gradient brand bar */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{
          background: "linear-gradient(135deg, hsl(var(--brand)) 0%, hsl(var(--brand-light)) 100%)",
        }}
      >
        <h3 className="text-base font-bold text-primary-foreground tracking-wide">Memo</h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
          aria-label={isCollapsed ? "메모 펼치기" : "메모 접기"}
        >
          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!isCollapsed && (
        <div className="px-5 pt-5 pb-4 space-y-0">
          {/* Date row */}
          <div className="flex items-center gap-3 pb-4">
            <span className="text-xs font-semibold text-muted-foreground tracking-wider shrink-0">Date</span>
            <div className="h-5 w-px bg-border" />
            <span className="text-sm font-semibold text-foreground">{formattedDate}</span>
            <CalendarDays className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
          </div>

          {/* Separator */}
          <div className="border-t border-border" />

          {/* Lined textarea area */}
          <div className="relative pt-4">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="투자 아이디어를 자유롭게 작성하세요"
              rows={8}
              className="w-full bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/50 p-0"
              style={{
                lineHeight: LINE_HEIGHT,
                backgroundImage:
                  `repeating-linear-gradient(transparent, transparent calc(${LINE_HEIGHT} - 1px), hsl(var(--border) / 0.6) calc(${LINE_HEIGHT} - 1px), hsl(var(--border) / 0.6) ${LINE_HEIGHT})`,
              }}
            />
          </div>

          {/* Save button row */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {saved && (
              <span className="text-xs text-accent flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> 저장됨
              </span>
            )}
            <button
              onClick={saveMemo}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-opacity disabled:opacity-50 text-primary-foreground hover:opacity-90"
              style={{ background: "hsl(var(--brand))" }}
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
