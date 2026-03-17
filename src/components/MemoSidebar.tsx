import { useState, useEffect, useCallback } from "react";
import { StickyNote, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Insight = Database["public"]["Tables"]["insights"]["Row"];

interface MemoSidebarProps {
  insight: Insight;
}

const MemoSidebar = ({ insight }: MemoSidebarProps) => {
  const [memo, setMemo] = useState((insight as any).memo || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setMemo((insight as any).memo || "");
  }, [insight.id]);

  const saveMemo = useCallback(async () => {
    setSaving(true);
    const { error } = await supabase
      .from("insights")
      .update({ memo } as any)
      .eq("id", insight.id);
    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }, [memo, insight.id]);

  const handleBlur = () => {
    if (memo !== ((insight as any).memo || "")) {
      saveMemo();
    }
  };

  return (
    <div className="bg-[hsl(48,96%,89%)] dark:bg-[hsl(48,40%,20%)] rounded-xl shadow-md overflow-hidden">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full flex items-center justify-between p-4 hover:bg-[hsl(48,90%,85%)] dark:hover:bg-[hsl(48,35%,24%)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-[hsl(40,80%,40%)] dark:text-[hsl(48,70%,60%)]" />
          <h3 className="text-sm font-semibold text-[hsl(40,50%,25%)] dark:text-[hsl(48,70%,70%)]">
            내 메모
          </h3>
          {saving && <Loader2 className="h-3 w-3 animate-spin text-[hsl(40,60%,50%)]" />}
          {saved && <Check className="h-3 w-3 text-[hsl(120,50%,40%)]" />}
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-4 w-4 text-[hsl(40,50%,45%)] dark:text-[hsl(48,50%,55%)]" />
        ) : (
          <ChevronUp className="h-4 w-4 text-[hsl(40,50%,45%)] dark:text-[hsl(48,50%,55%)]" />
        )}
      </button>
      {!isCollapsed && (
        <div className="px-4 pb-4">
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={handleBlur}
            placeholder="투자 아이디어, 메모, 생각을 자유롭게 적어보세요..."
            className="w-full h-32 bg-transparent border-none outline-none resize-none text-sm text-[hsl(40,30%,20%)] dark:text-[hsl(48,30%,80%)] placeholder:text-[hsl(40,30%,60%)] dark:placeholder:text-[hsl(48,20%,50%)] leading-relaxed"
          />
        </div>
      )}
    </div>
  );
};

export default MemoSidebar;
