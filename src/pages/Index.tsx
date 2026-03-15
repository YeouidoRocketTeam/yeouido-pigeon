import { useState, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { FolderOpen, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import InsightCard from "@/components/InsightCard";
import InsightDetail from "@/components/InsightDetail";
import AddInsightDialog from "@/components/AddInsightDialog";
import EmptyState from "@/components/EmptyState";
import SkeletonCard from "@/components/SkeletonCard";
import SubscriptionStories from "@/components/SubscriptionStories";
import SearchBar from "@/components/SearchBar";
import ProjectSidebar from "@/components/ProjectSidebar";
import SettingsDropdown from "@/components/SettingsDropdown";
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
  const { user } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectSidebarOpen, setProjectSidebarOpen] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!user) return;
    let query = supabase
      .from("insights")
      .select("*")
      .order("created_at", { ascending: false });

    if (selectedProjectId) {
      query = query.eq("project_id", selectedProjectId);
    }

    const { data } = await query;
    if (data) setInsights(data);
    setLoading(false);
  }, [user, selectedProjectId]);

  useEffect(() => {
    setLoading(true);
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

  // Filter by search query
  const filteredInsights = useMemo(() => {
    let result = insights;
    console.log("showFavorites:", showFavorites, "insights count:", insights.length);

    // Filter favorites
    if (showFavorites) {
      result = result.filter((ins) => (ins as any).is_favorited);
      console.log("after favorites filter:", result.length);
    }

    if (!searchQuery.trim()) return result;
    const q = searchQuery.toLowerCase();
    return result.filter((ins) => {
      const fields = [
        ins.ai_title, ins.original_title, ins.ai_summary,
        ins.source_domain, ins.memo,
      ];
      if (fields.some((f) => f?.toLowerCase().includes(q))) return true;
      const themes = (ins.themes as string[]) || [];
      const stocks = (ins.stocks as string[]) || [];
      return [...themes, ...stocks].some((t) => t.toLowerCase().includes(q));
    });
  }, [insights, searchQuery, showFavorites]);

  // Group by date
  const groupedInsights = useMemo(() => {
    const groups: { label: string; items: Insight[] }[] = [];
    const map = new Map<string, Insight[]>();

    for (const insight of filteredInsights) {
      const label = formatDateGroup(insight.created_at);
      if (!map.has(label)) {
        map.set(label, []);
        groups.push({ label, items: map.get(label)! });
      }
      map.get(label)!.push(insight);
    }

    return groups;
  }, [filteredInsights]);

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
              onUpdated={fetchInsights}
            />
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Project Sidebar */}
      <ProjectSidebar
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => { setSelectedProjectId(id); if (id !== null) setShowFavorites(false); }}
        isOpen={projectSidebarOpen}
        onClose={() => setProjectSidebarOpen(false)}
        showFavorites={showFavorites}
        onToggleFavorites={(show) => { setShowFavorites(show); if (show) setSelectedProjectId(null); }}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setProjectSidebarOpen(true)}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
            >
              <FolderOpen className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-foreground">KITCH</h1>
          </div>
          <div className="flex items-center gap-1">
            <button className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted">
              <Bell className="h-5 w-5" />
            </button>
            <SettingsDropdown />
          </div>
        </div>
      </header>

      {/* Story-style subscriptions */}
      <SubscriptionStories />

      {/* Search + Add button */}
      <div className="max-w-2xl mx-auto px-4 pt-3 pb-2 flex items-center gap-2">
        <div className="flex-1">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>
        <AddInsightDialog onAdded={fetchInsights} projectId={selectedProjectId} />
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredInsights.length === 0 ? (
          searchQuery ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground">"{searchQuery}"에 대한 결과가 없습니다</p>
            </div>
          ) : (
            <EmptyState />
          )
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
                      onDeleted={fetchInsights}
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
