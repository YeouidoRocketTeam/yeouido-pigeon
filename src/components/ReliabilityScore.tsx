import { useState } from "react";
import {
  Info, Shield, Eye, Database, GitBranch, Clock, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, X, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ReliabilityRadar from "@/components/ReliabilityRadar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CriterionDetail {
  flags: boolean[];
  score: number;
}

interface ReliabilityScoreProps {
  score: number;
  details?: Record<string, CriterionDetail> | null;
}

const GROUPS = [
  {
    key: "source",
    label: "Source Credibility",
    subtitle: "정보 제공자 신뢰 — 출처, 투명성",
    criteria: [
      {
        key: "source_authority",
        label: "출처 권위도",
        weight: 0.408,
        icon: Shield,
        checklist: [
          "실명/법인명 등 법적 책임 주체를 확인할 수 없는 완전 익명",
          "전문 자격(애널리스트, FP 등)이나 공인 기관 프로필 인증 없음",
          "채널/계정이 생성된 지 6개월 미만",
          "과거 허위 사실 유포나 오보로 신고/경고 기록 있음",
          "제도권 검토를 거치지 않은 개인의 주관적 의견",
        ],
      },
      {
        key: "interest_transparency",
        label: "이해관계 투명성",
        weight: 0.103,
        icon: Eye,
        checklist: [
          "유료 리딩방/개인 톡방 등 폐쇄적 공간으로 유인",
          "종목 보유 여부 미공개 또는 유료 광고/협찬 은폐",
          "반응 유도로 정보의 핵심 내용을 감춤",
          "리스크 배제, 특정 기업 장점만 나열하는 홍보성",
          "무관한 인기 종목 해시태그 남발 또는 팔로우 낚시",
        ],
      },
    ],
  },
  {
    key: "content",
    label: "Content Credibility",
    subtitle: "내용 신뢰성 — 근거 데이터, 논리 구조",
    criteria: [
      {
        key: "data_specificity",
        label: "데이터 구체성",
        weight: 0.061,
        icon: Database,
        checklist: [
          "현재가/목표주가/상승률/실적 중 숫자 데이터 전무",
          "주가 차트, 재무제표 등 시각적 증거 없음",
          "경쟁사나 시장 지수와 비교 수치 없음",
          "기자 이름 없거나 참고 문헌/데이터 출처 미언급",
          "분석 없이 단순 사실 1~2줄 나열",
        ],
      },
      {
        key: "logical_completeness",
        label: "논리적 완결성",
        weight: 0.158,
        icon: GitBranch,
        checklist: [
          "원인과 결과 사이 상관관계 없거나 중간 설명 생략",
          '"무조건", "확정" 등 투자 결과를 장담하는 단정적 선동',
          "주가 변동 후 결과를 끼워 맞추는 사후 확신",
          "하락 가능성이나 변수에 대한 언급 없음",
          "한 가지 이유만으로 전체 시장을 판단",
        ],
      },
    ],
  },
  {
    key: "context",
    label: "Context Credibility",
    subtitle: "환경 신뢰성 — 정보 유효성, 세상의 공감도",
    criteria: [
      {
        key: "time_validity",
        label: "시점 유효성",
        weight: 0.242,
        icon: Clock,
        checklist: [
          "정보 발생 직후 거래량 200%↑ 폭증, 주가 이미 급등/급락",
          "핵심 일정(청약일, 실적발표 등)이 이미 종료",
          "정보 최초 생성으로부터 6시간 이상 경과",
          "12시간 이전 뉴스를 재가공한 것",
          "작성일/수정일 등 시각 데이터가 본문에 없음",
        ],
      },
      {
        key: "cross_verification",
        label: "교차 검증 일치도",
        weight: 0.027,
        icon: CheckCircle2,
        checklist: [
          "출처/작성자 신뢰도에 대해 다른 소스 평가가 상충",
          "본문 수치와 외부 팩트 일치 여부 불확실",
          "인과관계 비약/선동 심각성에 대해 해석이 갈림",
          "정보 유효 기간/시세 선반영 판단이 엇갈림",
          "작성자 이득 여부에 대해 '정보'와 '광고' 사이 판단 불일치",
        ],
      },
    ],
  },
];

const ITEM_POINTS = [30, 25, 20, 15, 5];

const getScoreColor = (score: number): string => {
  if (score >= 70) return "text-accent";
  if (score >= 50) return "text-amber-500";
  if (score >= 30) return "text-orange-500";
  return "text-destructive";
};

const getBarColorClass = (score: number): string => {
  if (score >= 70) return "bg-accent";
  if (score >= 50) return "bg-amber-500";
  if (score >= 30) return "bg-orange-500";
  return "bg-destructive";
};

const getScoreLabel = (score: number): string => {
  if (score >= 70) return "신뢰도 높음";
  if (score >= 50) return "신뢰도 보통";
  if (score >= 30) return "신뢰도 낮음";
  return "신뢰도 매우 낮음";
};

// Compute group score as weighted average of its criteria
function computeGroupScore(
  group: typeof GROUPS[number],
  details: Record<string, CriterionDetail>
): number {
  let weightSum = 0;
  let scoreSum = 0;
  for (const c of group.criteria) {
    const d = details[c.key];
    if (d) {
      scoreSum += (d.score / 100) * c.weight;
      weightSum += c.weight;
    }
  }
  return weightSum > 0 ? Math.round((scoreSum / weightSum) * 100) : 0;
}

const ReliabilityScore = ({ score, details }: ReliabilityScoreProps) => {
  const [showModal, setShowModal] = useState(false);
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null);

  const normalizedScore = score <= 5 ? score * 20 : score;

  return (
    <>
      <div className="rounded-xl border bg-card p-5 mb-6">
        {/* Main score */}
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
            className={`h-full rounded-full transition-all duration-500 ${getBarColorClass(normalizedScore)}`}
            style={{ width: `${normalizedScore}%` }}
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <span className={`text-xs font-medium ${getScoreColor(normalizedScore)}`}>
            {getScoreLabel(normalizedScore)}
          </span>
          <span className="text-xs text-muted-foreground">ROC 가중치 기반 6항목 평가</span>
        </div>

        {/* Group breakdown */}
        {details && (
          <div className="space-y-4 pt-3 border-t">
            {GROUPS.map((group) => {
              const groupScore = computeGroupScore(group, details);
              return (
                <div key={group.key}>
                  {/* Group header */}
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-xs font-bold text-foreground">{group.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">{group.subtitle}</span>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${getScoreColor(groupScore)}`}>
                      {groupScore}
                    </span>
                  </div>

                  {/* Criteria within group */}
                  <div className="space-y-1.5">
                    {group.criteria.map((c) => {
                      const detail = details[c.key];
                      if (!detail) return null;
                      const isExpanded = expandedCriterion === c.key;
                      const Icon = c.icon;
                      return (
                        <div key={c.key} className="rounded-lg border bg-background">
                          <button
                            onClick={() => setExpandedCriterion(isExpanded ? null : c.key)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <Icon className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-foreground">{c.label}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">×{c.weight}</span>
                                  <span className={`text-sm font-bold tabular-nums ${getScoreColor(detail.score)}`}>
                                    {detail.score}
                                  </span>
                                </div>
                              </div>
                              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted mt-1">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${getBarColorClass(detail.score)}`}
                                  style={{ width: `${detail.score}%` }}
                                />
                              </div>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 pt-0 space-y-1.5 pl-10">
                              {c.checklist.map((item, idx) => {
                                const flagged = detail.flags[idx];
                                return (
                                  <div key={idx} className="flex items-start gap-2">
                                    {flagged ? (
                                      <X className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                                    )}
                                    <span className={`text-xs leading-relaxed ${flagged ? "text-destructive/80" : "text-muted-foreground"}`}>
                                      {item}
                                      <span className="ml-1 text-muted-foreground/60">
                                        ({flagged ? `-${ITEM_POINTS[idx]}` : "0"})
                                      </span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
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
              <h3 className="text-sm font-semibold text-foreground mb-2">🏷️ 신뢰도 공식</h3>
              <div className="rounded-lg border-l-4 border-primary bg-primary/5 px-4 py-3">
                <p className="text-sm font-medium text-foreground">
                  신뢰도 = Source(출처·투명성) + Content(데이터·논리) + Context(유효성·공감도)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ROC 가중치법 적용 · 각 항목 5개 체크리스트(30/25/20/15/5점 감점) · 최저 5점 보장
                </p>
              </div>
            </div>

            {/* 3 Groups */}
            <div className="space-y-4">
              {GROUPS.map((group) => {
                const totalWeight = group.criteria.reduce((s, c) => s + c.weight, 0);
                return (
                  <div key={group.key}>
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      {group.label}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({(totalWeight * 100).toFixed(1)}%)
                      </span>
                    </h3>
                    <p className="text-xs text-muted-foreground mb-2">{group.subtitle}</p>
                    <div className="space-y-2 pl-2">
                      {group.criteria.map((c) => {
                        const Icon = c.icon;
                        return (
                          <div key={c.key} className="flex items-start gap-3">
                            <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {c.label}{" "}
                                <span className="text-muted-foreground font-normal">
                                  (가중치 {(c.weight * 100).toFixed(1)}%)
                                </span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Radar Chart */}
            {details && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">📊 6대 항목 레이더</h3>
                <ReliabilityRadar
                  scores={Object.fromEntries(
                    Object.entries(details).map(([k, v]) => [k, (v as CriterionDetail).score])
                  )}
                />
              </div>
            )}

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
