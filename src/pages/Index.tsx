import { useState, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import InsightCard from "@/components/InsightCard";
import InsightDetail from "@/components/InsightDetail";
import AddInsightDialog from "@/components/AddInsightDialog";
import EmptyState from "@/components/EmptyState";
import SkeletonCard from "@/components/SkeletonCard";
import SubscriptionManager from "@/components/SubscriptionManager";
import type { Database } from "@/integrations/supabase/types";

type Insight = Database["public"]["Tables"]["insights"]["Row"];

const formatDateGroup = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const insightDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (insightDate.getTime() === today.getTime()) return "오늘";
  if (insightDate.getTime() === yesterday.getTime()) return "어제";

  const diffDays = Math.floor((today.getTime() - insightDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 7) return `${diffDays}일 전`;

  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
};

const Index = () => {
  const { user, signOut } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);

  const fetchInsights = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("insights")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setInsights(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchInsights();

    const channel = supabase
      .channel("insights-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "insights" },
        () => { fetchInsights(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchInsights]);

  // Group insights by date
  const groupedInsights = useMemo(() => {
    const groups: { label: string; items: Insight[] }[] = [];
    const map = new Map<string, Insight[]>();

    for (const insight of insights) {
      const label = formatDateGroup(insight.created_at);
      if (!map.has(label)) {
        map.set(label, []);
        groups.push({ label, items: map.get(label)! });
      }
      map.get(label)!.push(insight);
    }

    return groups;
  }, [insights]);

  if (selectedInsight) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            <InsightDetail
              insight={selectedInsight}
              onBack={() => setSelectedInsight(null)}
              onDeleted={() => {
                setSelectedInsight(null);
                fetchInsights();
              }}
            />
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Insight</h1>
          <div className="flex items-center gap-2">
            <SubscriptionManager />
            <AddInsightDialog onAdded={fetchInsights} />
            <button
              onClick={signOut}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : insights.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-8">
            {groupedInsights.map((group) => (
              <div key={group.label}>
                <h2 className="text-sm font-semibold text-muted-foreground mb-3 px-1">
                  {group.label}
                </h2>
                <div className="space-y-4">
                  {group.items.map((insight, i) => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      index={i}
                      onClick={() => setSelectedInsight(insight)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
