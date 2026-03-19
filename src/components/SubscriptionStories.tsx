import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Subscription = {
  id: string;
  source_name: string;
  source_url: string;
  source_domain: string | null;
  favicon_url: string | null;
  is_active: boolean;
  last_fetched_at: string | null;
};

const SubscriptionStories = () => {
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [fetching, setFetching] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSubscriptions = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setSubscriptions(data as Subscription[]);
  };

  useEffect(() => {
    fetchSubscriptions();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim() || !user) return;
    setAdding(true);
    try {
      let domain = "";
      try { domain = new URL(url.trim()).hostname.replace("www.", ""); } catch {}
      const { error } = await supabase.from("subscriptions").insert({
        user_id: user.id,
        source_name: name.trim(),
        source_url: url.trim(),
        source_domain: domain,
        favicon_url: `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
      } as any);
      if (error) throw error;
      setName("");
      setUrl("");
      setShowAddForm(false);
      toast({ title: "구독 추가 완료" });
      fetchSubscriptions();
    } catch (error: any) {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("subscriptions").delete().eq("id", id);
    setSelectedSub(null);
    fetchSubscriptions();
  };

  const handleFetchNow = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-subscription");
      if (error) throw error;
      toast({ title: "가져오기 완료", description: `${data?.fetched || 0}개의 새 인사이트를 가져왔습니다.` });
    } catch (e: any) {
      toast({ title: "오류", description: e.message, variant: "destructive" });
    } finally {
      setFetching(false);
    }
  };

  const getInitials = (name: string) => {
    return name.slice(0, 2);
  };

  const storyColors = [
    "from-[hsl(221,83%,53%)] to-[hsl(262,83%,58%)]",
    "from-[hsl(142,76%,36%)] to-[hsl(172,66%,50%)]",
    "from-[hsl(25,95%,53%)] to-[hsl(350,80%,60%)]",
    "from-[hsl(280,70%,50%)] to-[hsl(320,80%,55%)]",
    "from-[hsl(190,80%,45%)] to-[hsl(221,83%,53%)]",
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4">
      <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {/* Add button */}
        <button
          onClick={() => setShowAddForm(true)}
          className="flex flex-col items-center gap-1.5 flex-shrink-0"
        >
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors">
            <Plus className="h-5 w-5 text-muted-foreground" />
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">추가</span>
        </button>

        {/* Fetch button */}
        {subscriptions.length > 0 && (
          <button
            onClick={handleFetchNow}
            disabled={fetching}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
          >
            <div className="w-14 h-14 rounded-full border-2 border-primary/30 flex items-center justify-center hover:border-primary/60 transition-colors bg-primary/5">
              {fetching ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                <RefreshCw className="h-5 w-5 text-primary" />
              )}
            </div>
            <span className="text-[11px] text-primary font-medium">새로고침</span>
          </button>
        )}

        {/* Subscription circles */}
        {subscriptions.map((sub, i) => (
          <button
            key={sub.id}
            onClick={() => setSelectedSub(sub)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0"
          >
            <div className={`p-[2.5px] rounded-full bg-gradient-to-br ${storyColors[i % storyColors.length]}`}>
              <div className="w-[52px] h-[52px] rounded-full bg-card flex items-center justify-center overflow-hidden border-2 border-card">
                {sub.favicon_url ? (
                  <img
                    src={sub.favicon_url}
                    alt={sub.source_name}
                    className="w-7 h-7 rounded-sm object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <span className="text-sm font-bold text-foreground">{getInitials(sub.source_name)}</span>
                )}
              </div>
            </div>
            <span className="text-[11px] text-foreground font-medium max-w-[60px] truncate">
              {sub.source_name}
            </span>
          </button>
        ))}
      </div>

      {/* Add form modal */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/20 backdrop-blur-sm p-4"
            onClick={() => setShowAddForm(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-xl p-6 card-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">구독 추가</h2>
                <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleAdd} className="space-y-3">
                <Input placeholder="이름 (예: 연합뉴스 경제)" value={name} onChange={(e) => setName(e.target.value)} required />
                <Input type="url" placeholder="URL (예: https://www.yna.co.kr/economy)" value={url} onChange={(e) => setUrl(e.target.value)} required />
                <Button type="submit" size="sm" className="w-full" disabled={adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  추가
                </Button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subscription detail modal */}
      <AnimatePresence>
        {selectedSub && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/20 backdrop-blur-sm p-4"
            onClick={() => setSelectedSub(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card rounded-xl p-6 card-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {selectedSub.favicon_url ? (
                    <img src={selectedSub.favicon_url} alt="" className="w-7 h-7 rounded-sm object-contain" />
                  ) : (
                    <span className="text-sm font-bold text-foreground">{getInitials(selectedSub.source_name)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{selectedSub.source_name}</p>
                  <a
                    href={selectedSub.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline truncate block"
                  >
                    {selectedSub.source_domain}
                  </a>
                </div>
                <button onClick={() => setSelectedSub(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <Button
                size="sm"
                className="w-full mb-3"
                onClick={() => {
                  if (onFilterByDomain) onFilterByDomain(selectedSub.source_domain || "");
                  setSelectedSub(null);
                }}
              >
                이 채널 뉴스만 보기
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                onClick={() => handleDelete(selectedSub.id)}
              >
                <Trash2 className="h-4 w-4" />
                구독 해제
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubscriptionStories;
