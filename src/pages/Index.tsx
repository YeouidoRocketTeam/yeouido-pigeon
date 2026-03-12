import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import InsightCard from "@/components/InsightCard";
import InsightDetail from "@/components/InsightDetail";
import AddInsightDialog from "@/components/AddInsightDialog";
import EmptyState from "@/components/EmptyState";
import SkeletonCard from "@/components/SkeletonCard";
import type { Database } from "@/integrations/supabase/types";

type Insight = Database["public"]["Tables"]["insights"]["Row"];

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

    // Subscribe to real-time updates
    const channel = supabase
      .channel("insights-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "insights" },
        () => {
          fetchInsights();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInsights]);

  if (selectedInsight) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 py-6">
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
          <div className="space-y-4">
            {insights.map((insight, i) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                index={i}
                onClick={() => setSelectedInsight(insight)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
