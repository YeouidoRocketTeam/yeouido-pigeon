import { useState, useEffect, useCallback } from "react";
import { TrendingUp, ChevronRight, RefreshCw, X, TrendingUp as ChartIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerClose } from "@/components/ui/drawer";

interface Stock {
  name: string;
  code: string;
  reason: string;
}

interface StockPrice {
  name: string;
  code: string;
  price: number;
  changePercent: number;
  changePrice: number;
  currency: string;
  marketStatus: string;
  previousClose?: number;
}

interface RelatedStocksProps {
  stocks: Stock[];
}

const RelatedStocks = ({ stocks }: RelatedStocksProps) => {
  const [prices, setPrices] = useState<Record<string, StockPrice>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedStock, setSelectedStock] = useState<{ stock: Stock; price: StockPrice | null } | null>(null);

  const fetchPrices = useCallback(async () => {
    if (stocks.length === 0) return;

    try {
      const { data, error } = await supabase.functions.invoke("fetch-stock-prices", {
        body: {
          stocks: stocks.map((s) => ({ name: s.name, code: s.code })),
        },
      });

      if (!error && data?.prices) {
        const priceMap: Record<string, StockPrice> = {};
        for (const p of data.prices) {
          priceMap[p.name] = p;
        }
        setPrices(priceMap);
        setLastUpdated(new Date());
      }
    } catch (e) {
      console.error("Failed to fetch stock prices:", e);
    } finally {
      setLoading(false);
    }
  }, [stocks]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const formatPrice = (price: number, currency: string) => {
    if (currency === "$") {
      return `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${price.toLocaleString("ko-KR")}원`;
  };

  const getRelevanceBadge = (reason: string) => {
    if (!reason) return null;
    const lower = reason.toLowerCase();
    if (lower.includes("높") || lower.includes("직접") || lower.includes("핵심") || lower.includes("주요")) {
      return { label: "관련도 높음", className: "bg-accent/10 text-accent" };
    }
    if (lower.includes("낮") || lower.includes("간접")) {
      return { label: "관련도 낮음", className: "bg-muted text-muted-foreground" };
    }
    return { label: "관련도 보통", className: "bg-primary/10 text-primary" };
  };

  const getMarketStatusText = (status: string) => {
    switch (status) {
      case "CLOSE": return "장 마감";
      case "AFTER_MARKET": return "시간외 거래";
      case "OPEN": return "장중";
      case "PRE_MARKET": return "장전";
      default: return "장 마감";
    }
  };

  const handleStockClick = (e: React.MouseEvent, stock: Stock) => {
    e.preventDefault();
    const priceData = prices[stock.name] || null;
    setSelectedStock({ stock, price: priceData });
  };

  if (stocks.length === 0) return null;

  const selected = selectedStock;
  const sp = selected?.price;
  const isPositiveSelected = sp && sp.changePercent > 0;
  const isNegativeSelected = sp && sp.changePercent < 0;
  const priceColorClass = isPositiveSelected
    ? "text-red-500"
    : isNegativeSelected
    ? "text-blue-500"
    : "text-foreground";
  const previousClose = sp ? sp.price - sp.changePrice : 0;

  return (
    <>
      <div className="mb-6 rounded-xl border bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">관련 종목</h2>
            {loading && (
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {lastUpdated
              ? `${lastUpdated.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 기준`
              : "탭하면 상세 시세·주문"}
          </span>
        </div>

        {/* Stock list */}
        <div className="divide-y divide-border">
          {stocks.map((stock) => {
            const priceData = prices[stock.name];
            const badge = getRelevanceBadge(stock.reason);
            const isPositive = priceData && priceData.changePercent > 0;
            const isNegative = priceData && priceData.changePercent < 0;

            return (
              <button
                key={stock.name}
                onClick={(e) => handleStockClick(e, stock)}
                className="flex items-center px-5 py-4 hover:bg-muted/50 transition-colors group w-full text-left"
              >
                {/* Left: dot + name/code */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isPositive
                        ? "bg-red-500"
                        : isNegative
                        ? "bg-blue-500"
                        : "bg-muted-foreground/40"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {stock.name}
                    </p>
                    {stock.code && (
                      <p className="text-xs text-muted-foreground">{stock.code}</p>
                    )}
                  </div>
                </div>

                {/* Center: relevance badge */}
                <div className="hidden sm:flex items-center mx-3">
                  {badge && (
                    <span
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  )}
                </div>

                {/* Right: price + change */}
                <div className="flex items-center gap-2 shrink-0">
                  {priceData ? (
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          isPositive
                            ? "text-red-500"
                            : isNegative
                            ? "text-blue-500"
                            : "text-foreground"
                        }`}
                      >
                        {formatPrice(priceData.price, priceData.currency)}
                      </p>
                      <p
                        className={`text-xs font-medium tabular-nums ${
                          isPositive
                            ? "text-red-500"
                            : isNegative
                            ? "text-blue-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {isPositive ? "▲" : isNegative ? "▼" : ""}{" "}
                        {Math.abs(priceData.changePercent).toFixed(2)}%
                      </p>
                    </div>
                  ) : loading ? (
                    <div className="w-20 space-y-1.5">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                      <div className="h-3 bg-muted rounded animate-pulse w-12 ml-auto" />
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stock Detail Drawer */}
      <Drawer open={!!selectedStock} onOpenChange={(open) => !open && setSelectedStock(null)}>
        <DrawerContent className="max-h-[85vh]">
          {selected && (
            <div className="px-6 pb-8 pt-2">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-lg font-bold text-foreground tabular-nums">
                    {selected.stock.code || "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">{selected.stock.name}</p>
                </div>
                <DrawerClose asChild>
                  <button className="p-2 rounded-lg hover:bg-muted transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </DrawerClose>
              </div>

              {sp ? (
                <>
                  {/* Price */}
                  <div className="mb-1">
                    <p className={`text-4xl font-bold tabular-nums ${priceColorClass}`}>
                      {formatPrice(sp.price, sp.currency)}
                    </p>
                  </div>

                  {/* Change info */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-base font-semibold tabular-nums ${priceColorClass}`}>
                      {isPositiveSelected ? "▲" : isNegativeSelected ? "▼" : ""}{" "}
                      {sp.currency === "$" ? "$" : ""}
                      {Math.abs(sp.changePrice).toLocaleString(sp.currency === "$" ? "en-US" : "ko-KR")}
                      {sp.currency !== "$" && "원"}
                    </span>
                    <span
                      className={`text-sm font-semibold px-2 py-0.5 rounded-md tabular-nums ${
                        isPositiveSelected
                          ? "bg-red-500/10 text-red-500"
                          : isNegativeSelected
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {sp.changePercent > 0 ? "+" : ""}
                      {sp.changePercent.toFixed(2)}%
                    </span>
                  </div>

                  {/* Market status */}
                  <p className="text-xs text-muted-foreground mb-6">
                    {getMarketStatusText(sp.marketStatus)}
                    {selected.stock.code && /^\d{6}$/.test(selected.stock.code)
                      ? " · KSE"
                      : ""}
                  </p>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 border rounded-xl overflow-hidden mb-6">
                    <div className="p-4 text-center border-r">
                      <p className="text-xs text-muted-foreground mb-1">전일 종가</p>
                      <p className="text-sm font-bold text-foreground tabular-nums">
                        {previousClose > 0 ? formatPrice(previousClose, sp.currency) : "—"}
                      </p>
                    </div>
                    <div className="p-4 text-center border-r">
                      <p className="text-xs text-muted-foreground mb-1">변동폭</p>
                      <p className={`text-sm font-bold tabular-nums ${priceColorClass}`}>
                        {isPositiveSelected ? "▲" : isNegativeSelected ? "▼" : ""}{" "}
                        {sp.currency === "$" ? "$" : ""}
                        {Math.abs(sp.changePrice).toLocaleString(sp.currency === "$" ? "en-US" : "ko-KR")}
                        {sp.currency !== "$" && "원"}
                      </p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-xs text-muted-foreground mb-1">변동률</p>
                      <p className={`text-sm font-bold tabular-nums ${priceColorClass}`}>
                        {sp.changePercent > 0 ? "+" : ""}
                        {sp.changePercent.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  가격 정보를 불러올 수 없습니다
                </div>
              )}

              {/* CTA Button */}
              <a
                href={
                  selected.stock.code
                    ? `https://m.stock.naver.com/domestic/stock/${selected.stock.code}/total`
                    : `https://search.naver.com/search.naver?query=${encodeURIComponent(selected.stock.name)}+주가`
                }
                className="flex items-center justify-center gap-2 w-full py-4 rounded-xl text-primary-foreground font-bold text-base transition-opacity hover:opacity-90"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--brand)) 0%, hsl(var(--primary)) 100%)",
                }}
              >
                <ChartIcon className="w-5 h-5" />
                주문하러가기
              </a>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default RelatedStocks;
