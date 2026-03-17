import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, AlertTriangle, Check, RefreshCw, Trash2, Settings2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface StockChange {
  name: string;
  changePercent: number;
}

interface Notification {
  id: string;
  user_id: string;
  insight_id: string | null;
  title: string;
  message: string;
  stock_changes: StockChange[];
  is_read: boolean;
  created_at: string;
}

const formatTimeAgo = (dateStr: string): string => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}일 전`;
};

const Notifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [threshold, setThreshold] = useState(3);
  const [savingThreshold, setSavingThreshold] = useState(false);

  const fetchThreshold = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("stock_alert_threshold")
      .eq("user_id", user.id)
      .single();
    if (data && (data as any).stock_alert_threshold != null) {
      setThreshold(Number((data as any).stock_alert_threshold));
    }
  }, [user]);

  const saveThreshold = async (value: number) => {
    if (!user) return;
    setSavingThreshold(true);
    await supabase
      .from("profiles")
      .update({ stock_alert_threshold: value } as any)
      .eq("user_id", user.id);
    setSavingThreshold(false);
    toast({ title: `알림 기준이 ${value}%로 변경되었습니다` });
  };

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false }) as { data: Notification[] | null };
    if (data) setNotifications(data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    fetchThreshold();
  }, [fetchNotifications, fetchThreshold]);

  const checkStockPrices = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-stock-prices");
      if (error) throw error;
      toast({
        title: "주가 확인 완료",
        description: `${data.checkedStocks}개 종목 확인, ${data.significantChanges}개 변동 감지`,
      });
      fetchNotifications();
    } catch {
      toast({ title: "주가 확인 실패", variant: "destructive" });
    } finally {
      setChecking(false);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const deleteNotification = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read);
    if (unread.length === 0) return;
    for (const n of unread) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-bold tracking-tight text-foreground">알림</h1>
            {unreadCount > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs">
                  <Settings2 className="h-3.5 w-3.5 mr-1" />
                  {threshold}%
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">알림 기준 설정</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      종목 가격이 설정한 비율 이상 변동하면 알림을 받습니다
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">변동률</span>
                      <span className="text-sm font-bold text-foreground">{threshold}%</span>
                    </div>
                    <Slider
                      value={[threshold]}
                      onValueChange={([v]) => setThreshold(v)}
                      onValueCommit={([v]) => saveThreshold(v)}
                      min={1}
                      max={20}
                      step={0.5}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>1%</span>
                      <span>10%</span>
                      <span>20%</span>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
                <Check className="h-3.5 w-3.5 mr-1" />
                모두 읽음
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={checkStockPrices}
              disabled={checking}
              className="text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${checking ? "animate-spin" : ""}`} />
              주가 확인
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-card rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                <div className="h-3 bg-muted rounded w-1/2 mb-2" />
                <div className="h-3 bg-muted rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-20">
            <AlertTriangle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">알림이 없습니다</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              '주가 확인' 버튼을 눌러 관련 종목의 변동을 확인하세요
            </p>
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-3">
              {notifications.map((notification, i) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => markAsRead(notification.id)}
                  className={`relative bg-card rounded-xl p-5 card-shadow cursor-pointer transition-all ${
                    !notification.is_read ? "border-l-4 border-l-destructive" : ""
                  }`}
                >
                  {/* Time + delete */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Title */}
                  <p className="text-sm font-medium text-foreground mb-3">
                    {notification.title}
                  </p>

                  {/* Stock changes */}
                  {notification.stock_changes && notification.stock_changes.length > 0 && (
                    <div className="space-y-1.5 mb-3">
                      {notification.stock_changes.map((change, idx) => (
                        <div
                          key={idx}
                          className={`text-sm font-semibold ${
                            change.changePercent > 0
                              ? "text-destructive"
                              : "text-primary"
                          }`}
                        >
                          · {change.name}{" "}
                          {change.changePercent > 0 ? "+" : ""}
                          {change.changePercent.toFixed(1)}%{" "}
                          {change.changePercent > 0 ? "상승" : "하락"}!!
                        </div>
                      ))}
                    </div>
                  )}

                  {/* CTA */}
                  <p className="text-xs text-primary font-medium">관련 기사를 확인해보세요!</p>

                  {/* Unread dot */}
                  {!notification.is_read && (
                    <div className="absolute top-5 right-12 w-2 h-2 rounded-full bg-destructive" />
                  )}
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
};

export default Notifications;
