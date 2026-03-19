import { useState, useEffect, useCallback, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { FolderOpen, Bell, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
import WelcomeDialog from "@/components/WelcomeDialog";
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
  const navigate = useNavigate();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [domainFilter, setDomainFilter] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectSidebarOpen, setProjectSidebarOpen] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | null>(null);

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

  // Filter by search query and period
  const filteredInsights = useMemo(() => {
    let result = insights;

    if (showFavorites) {
      result = result.filter((ins) => (ins as any).is_favorited);
    }

    if (domainFilter) {
      result = result.filter((ins) => ins.source_domain?.includes(domainFilter) || domainFilter.includes(ins.source_domain || ""));
    }

    // Period filter
    if (periodFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let startDate: Date;

      if (periodFilter === "today") {
        startDate = today;
      } else if (periodFilter === "week") {
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() - 7);
      } else if (periodFilter === "month") {
        startDate = new Date(today);
        startDate.setMonth(startDate.getMonth() - 1);
      } else {
        startDate = new Date(0);
      }

      result = result.filter((ins) => new Date(ins.created_at) >= startDate);
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
  }, [insights, searchQuery, showFavorites, domainFilter, periodFilter]);

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
      <header className="sticky top-0 z-40 bg-brand text-brand-foreground">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setProjectSidebarOpen(true)}
              className="p-2 text-brand-foreground/70 hover:text-brand-foreground transition-colors rounded-lg hover:bg-brand-foreground/10"
            >
              <FolderOpen className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-brand-foreground">KITCH</h1>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate("/notifications")}
              className="p-2 text-brand-foreground/70 hover:text-brand-foreground transition-colors rounded-lg hover:bg-brand-foreground/10"
            >
              <Bell className="h-5 w-5" />
            </button>
            <SettingsDropdown />
          </div>
        </div>
      </header>

      {/* Sub-header banner */}
      <div className="bg-brand-light py-2">
        <div className="max-w-2xl mx-auto px-4">
          <p className="text-brand-foreground/90 text-sm font-medium flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-300" />
            AI 기반 투자 정보 분석 서비스
          </p>
        </div>
      </div>

      {/* Story-style subscriptions */}
      <SubscriptionStories onFilterByDomain={(domain) => { setDomainFilter(domain); setSearchQuery(""); }} />

      {/* Search */}
      <div className="max-w-2xl mx-auto px-4 pt-3 pb-2 space-y-2">
        {domainFilter && (
          <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-lg px-3 py-2">
            <span className="font-medium">{domainFilter}</span>
            <span className="text-muted-foreground">필터 적용 중</span>
            <button onClick={() => setDomainFilter(null)} className="ml-auto text-muted-foreground hover:text-foreground text-xs underline">해제</button>
          </div>
        )}
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      {/* Period Filter */}
      <div className="max-w-2xl mx-auto px-4 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {[
            { key: "all", label: "전체" },
            { key: "today", label: "오늘" },
            { key: "week", label: "이번 주" },
            { key: "month", label: "이번 달" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setPeriodFilter(item.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                periodFilter === item.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-4 pb-24">
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
                <div className="space-y-3">
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

      {/* Fixed bottom CTA + Drawer */}
      <AddInsightDialog onAdded={fetchInsights} projectId={selectedProjectId} />
      <WelcomeDialog />
    </div>
  );
};

export default Index;
