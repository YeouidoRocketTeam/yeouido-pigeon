import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rss, Plus, X, Trash2, RefreshCw, Loader2 } from "lucide-react";
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

const SubscriptionManager = () => {
  const [isOpen, setIsOpen] = useState(false);
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
        favicon_url: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
      } as any);

      if (error) throw error;
      setName("");
      setUrl("");
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

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
        title="자동 구독 관리"
      >
        <Rss className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/20 backdrop-blur-sm p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-card rounded-xl p-6 card-shadow max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Rss className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">자동 구독</h2>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-4">
                관심 있는 소스를 등록하면 자동으로 새 콘텐츠를 가져옵니다.
              </p>

              {/* Add form */}
              <form onSubmit={handleAdd} className="space-y-3 mb-6">
                <Input
                  placeholder="이름 (예: 연합뉴스 경제)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  type="url"
                  placeholder="URL (예: https://www.yna.co.kr/economy)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
                <Button type="submit" size="sm" className="w-full" disabled={adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  구독 추가
                </Button>
              </form>

              {/* Fetch now button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full mb-4"
                onClick={handleFetchNow}
                disabled={fetching || subscriptions.length === 0}
              >
                {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                지금 가져오기
              </Button>

              {/* Subscription list */}
              <div className="space-y-2">
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    {sub.favicon_url && (
                      <img src={sub.favicon_url} alt="" className="w-4 h-4 rounded-sm" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{sub.source_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{sub.source_domain}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(sub.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {subscriptions.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    아직 구독이 없습니다
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SubscriptionManager;
