import { useState } from "react";
import { Info, Building2, BarChart3, TrendingUp, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ReliabilityScoreProps {
  score: number; // 1-5 legacy or 1-100 new
}

const getScoreLabel = (score: number): string => {
  if (score >= 80) return "신뢰도 높음";
  if (score >= 60) return "신뢰도 보통";
  if (score >= 40) return "신뢰도 낮음";
  return "신뢰도 매우 낮음";
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return "text-accent";
  if (score >= 60) return "text-amber-500";
  if (score >= 40) return "text-orange-500";
  return "text-destructive";
};

const getBarColor = (score: number): string => {
  if (score >= 80) return "bg-accent";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-destructive";
};

const ReliabilityScore = ({ score }: ReliabilityScoreProps) => {
  const [showModal, setShowModal] = useState(false);

  // Normalize legacy 1-5 scores to 1-100
  const normalizedScore = score <= 5 ? score * 20 : score;

  return (
    <>
      <div className="rounded-xl border bg-card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">신뢰도 점수</h2>
            <button
              onClick={() => setShowModal(true)}
              className="text-primary hover:text-primary/80 transition-colors"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-baseline gap-0.5">
            <span className={`text-3xl font-bold tabular-nums ${getScoreColor(normalizedScore)}`}>
              {normalizedScore}
            </span>
            <span className="text-sm text-muted-foreground">/100</span>
          </div>
        </div>

        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted mb-2">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getBarColor(normalizedScore)}`}
            style={{ width: `${normalizedScore}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${getScoreColor(normalizedScore)}`}>
            {getScoreLabel(normalizedScore)}
          </span>
          <span className="text-xs text-muted-foreground">출처 품질 및 내용 분석 기반</span>
        </div>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              신뢰도 점수 산출 방식
            </DialogTitle>
            <DialogDescription className="sr-only">신뢰도 점수가 어떻게 계산되는지 설명합니다.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Formula */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                🏷️ 신뢰도 공식
              </h3>
              <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  신뢰도 = 출처점수(40%) + 구체성점수(35%) + 시장관련성(25%)
                </p>
              </div>
            </div>

            {/* Categories */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">출처 신뢰도 (40점)</p>
                  <p className="text-sm text-muted-foreground">
                    주요 언론사·공식 IR·규제기관 자료 여부, 작성자 전문성 등을 반영합니다.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">정보 구체성 (35점)</p>
                  <p className="text-sm text-muted-foreground">
                    수치·날짜·출처 인용 등 검증 가능한 데이터의 밀도를 측정합니다.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-foreground">시장 관련성 (25점)</p>
                  <p className="text-sm text-muted-foreground">
                    언급된 종목·지표가 현재 시장 상황과 얼마나 직결되는지 평가합니다.
                  </p>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-muted">
              <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                해당 지표는 참고용이며 투자 판단의 근거로 단독 활용하지 않도록 권고합니다. 산출 공식은 추후 개선될 수 있습니다.
              </p>
            </div>

            <Button onClick={() => setShowModal(false)} className="w-full">
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReliabilityScore;
