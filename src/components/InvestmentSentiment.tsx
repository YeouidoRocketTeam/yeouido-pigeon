import { useState } from "react";
import { TrendingUp, Minus, TrendingDown, Info, X } from "lucide-react";

const sentimentConfig = {
  positive: {
    label: "강세",
    icon: TrendingUp,
    badgeClass: "bg-green-100 text-green-700 border-green-200",
    iconClass: "text-green-600",
  },
  neutral: {
    label: "중립",
    icon: Minus,
    badgeClass: "bg-muted text-muted-foreground border-border",
    iconClass: "text-muted-foreground",
  },
  negative: {
    label: "약세",
    icon: TrendingDown,
    badgeClass: "bg-red-100 text-red-700 border-red-200",
    iconClass: "text-red-600",
  },
} as const;

type Sentiment = keyof typeof sentimentConfig;

interface InvestmentSentimentProps {
  sentiment: string | null;
}

const InvestmentSentiment = ({ sentiment }: InvestmentSentimentProps) => {
  const [showInfo, setShowInfo] = useState(false);

  if (!sentiment || !(sentiment in sentimentConfig)) return null;

  const config = sentimentConfig[sentiment as Sentiment];
  const Icon = config.icon;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-foreground">투자 심리</h2>
        <button
          onClick={() => setShowInfo(true)}
          className="w-5 h-5 rounded-full bg-brand text-brand-foreground flex items-center justify-center"
        >
          <Info className="w-3 h-3" />
        </button>
      </div>

      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold ${config.badgeClass}`}>
        <Icon className={`w-4 h-4 ${config.iconClass}`} />
        {config.label}
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        {sentiment === "positive" && "강세 신호가 포착됩니다."}
        {sentiment === "neutral" && "중립적인 신호입니다."}
        {sentiment === "negative" && "약세 신호가 포착됩니다."}
      </p>

      {/* Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowInfo(false)}>
          <div className="bg-card rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-brand text-brand-foreground flex items-center justify-center">
                  <Info className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-base font-bold text-foreground">투자 심리 판단 기준</h3>
              </div>
              <button onClick={() => setShowInfo(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-5">
              <div className="flex gap-3">
                <TrendingUp className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">강세 (Positive)</p>
                  <p className="text-xs text-muted-foreground">실적 개선, 수주·계약 체결, 목표주가 상향, 업황 회복, 정책 수혜, 신사업 모멘텀 등 투자에 긍정적인 신호.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Minus className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">중립 (Neutral)</p>
                  <p className="text-xs text-muted-foreground">단순 사실 전달, 긍정·부정 신호가 혼재되거나 방향성이 불명확한 경우, 현상 유지 의견.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <TrendingDown className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-foreground">약세 (Negative)</p>
                  <p className="text-xs text-muted-foreground">실적 부진·적자 전환, 목표주가 하향, 규제 리스크, 경쟁 심화, 대규모 손실·소송 등 투자에 부정적인 신호.</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg px-3 py-2.5 mb-5">
              <p className="text-xs text-muted-foreground flex gap-1.5">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                투자 심리는 콘텐츠 내용을 AI가 종합 판단한 결과이며, 실제 시장 상황과 다를 수 있습니다. 투자 판단의 보조 참고 자료로만 활용하시기 바랍니다.
              </p>
            </div>

            <button
              onClick={() => setShowInfo(false)}
              className="w-full py-3 rounded-2xl bg-brand text-brand-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestmentSentiment;
