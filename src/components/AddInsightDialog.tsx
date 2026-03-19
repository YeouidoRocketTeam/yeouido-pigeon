import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, Loader2, ChevronRight, Zap, LinkIcon, Image, Youtube, X, Plus, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface AddInsightDialogProps {
  onAdded: () => void;
  projectId?: string | null;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

type AnalysisType = "news" | "screenshot" | "youtube" | "sns" | null;

const AddInsightDialog = ({ onAdded, projectId, externalOpen, onExternalOpenChange }: AddInsightDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    else setInternalOpen(v);
  };
  const [selectedType, setSelectedType] = useState<AnalysisType>(null);
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setSelectedType(null);
      setUrl("");
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !user) return;

    setIsSubmitting(true);

    try {
      const insertData: any = {
        user_id: user.id,
        url: url.trim(),
        status: "processing",
        source_domain: new URL(url.trim()).hostname.replace("www.", ""),
        favicon_url: `https://www.google.com/s2/favicons?domain=${new URL(url.trim()).hostname}&sz=32`,
      };

      if (projectId) {
        insertData.project_id = projectId;
      }

      const { data: insight, error: insertError } = await supabase
        .from("insights")
        .insert(insertData)
        .select()
        .single();

      if (insertError) throw insertError;

      toast({ title: "추가 완료", description: "AI가 분석 중입니다..." });
      handleClose();
      onAdded();

      supabase.functions.invoke("analyze-insight", {
        body: { insightId: insight.id, url: url.trim() },
      }).catch(console.error);

    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message || "인사이트 추가에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const analysisTypes = [
    {
      id: "news" as const,
      icon: LinkIcon,
      label: "뉴스 링크",
      description: "기사 URL을 붙여넣으면 AI가 요약해드려요",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      id: "youtube" as const,
      icon: Youtube,
      label: "유튜브 영상",
      description: "투자 관련 영상 링크를 분석해드려요",
      iconBg: "bg-destructive/10",
      iconColor: "text-destructive",
    },
    {
      id: "sns" as const,
      icon: MessageCircle,
      label: "SNS 게시물",
      description: "X(트위터), 인스타, 틱톡 등 SNS 글을 분석해드려요",
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
    },
  ];

  const getPlaceholder = () => {
    switch (selectedType) {
      case "youtube": return "https://www.youtube.com/watch?v=...";
      case "sns": return "https://x.com/user/status/...";
      default: return "https://news.einfomax.co.kr/...";
    }
  };

  const getTips = () => {
    switch (selectedType) {
      case "youtube":
        return [
          "유튜브 영상 URL을 붙여넣으면 자동 분석됩니다",
          "투자 관련 채널의 영상을 지원합니다",
          "비공개 영상은 분석이 제한될 수 있습니다",
        ];
      case "sns":
        return [
          "X(트위터), 인스타그램, 틱톡 등의 URL을 지원합니다",
          "공개 게시물만 분석이 가능합니다",
          "투자 관련 의견이나 분석 글에 적합합니다",
        ];
      default:
        return [
          "전체 기사 URL을 붙여넣으면 가장 정확한 분석이 가능합니다",
          "로이터, 블룸버그, 한국경제, 연합뉴스 등의 기사를 지원합니다",
          "유료 구독 기사는 분석이 제한될 수 있습니다",
        ];
    }
  };

  const getTitle = () => {
    switch (selectedType) {
      case "news": return "뉴스 기사";
      case "youtube": return "유튜브 영상";
      case "sns": return "SNS 게시물";
      default: return "";
    }
  };

  return (
    <>
      {/* Fixed bottom CTA button - only show when not externally controlled */}
      {externalOpen === undefined && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pt-2 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto">
            <button
              onClick={() => setIsOpen(true)}
              className="w-full h-14 text-base font-semibold rounded-2xl text-brand-foreground shadow-lg bg-brand hover:bg-brand/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Plus className="h-5 w-5" />
              콘텐츠 저장하기
            </button>
          </div>
        </div>
      )}

      {/* Backdrop + Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 backdrop-blur-sm"
            onClick={handleClose}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-card rounded-t-3xl overflow-hidden"
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
              </div>

              <AnimatePresence mode="wait">
                {!selectedType ? (
                  /* Step 1: Type selection */
                  <motion.div
                    key="type-select"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="px-6 pb-6"
                  >
                    <div className="mb-5">
                      <h2 className="text-lg font-bold text-foreground">분석 유형 선택</h2>
                      <p className="text-sm text-muted-foreground mt-1">분석할 투자 정보의 형태를 고르세요</p>
                    </div>

                    <div className="space-y-3">
                      {analysisTypes.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setSelectedType(type.id)}
                          className="w-full flex items-center gap-4 p-4 rounded-xl transition-all bg-muted/70 hover:bg-muted active:scale-[0.98]"
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${type.iconBg}`}>
                            <type.icon className={`h-5 w-5 ${type.iconColor}`} />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="text-sm font-semibold text-foreground">{type.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleClose}
                      className="w-full mt-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-muted/50"
                    >
                      취소
                    </button>
                  </motion.div>
                ) : (
                  /* Step 2: URL input */
                  <motion.div
                    key="url-input"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="px-6 pb-6"
                  >
                    {/* Header with back */}
                    <div className="flex items-center justify-between mb-4">
                      <button
                        onClick={() => setSelectedType(null)}
                        className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                        <LinkIcon className="h-4 w-4" />
                        {getTitle()}
                      </h2>
                      <div className="w-9" />
                    </div>

                    <p className="text-sm text-muted-foreground mb-4">
                      분석할 뉴스 또는 금융 기사의 URL을 입력해주세요
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {/* URL label */}
                      <div>
                        <label className="text-sm font-medium text-foreground mb-2 block">
                          {selectedType === "youtube" ? "영상 URL" : "기사 URL"}
                        </label>
                        <div className="relative">
                          <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            type="url"
                            placeholder={getPlaceholder()}
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            required
                            className="pl-10 h-12 rounded-xl border-border"
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* Tips */}
                      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                        <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                          <Zap className="h-3.5 w-3.5" />
                          정확한 분석을 위한 팁
                        </p>
                        <ul className="space-y-1.5">
                          {getTips().map((tip, i) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                              <span className="text-amber-500 mt-0.5">•</span>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Submit */}
                      <Button
                        type="submit"
                        size="lg"
                        className="w-full h-14 text-base font-semibold rounded-xl"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            분석 중...
                          </>
                        ) : (
                          <>
                            <Zap className="h-5 w-5 mr-2" />
                            {selectedType === "youtube" ? "영상 분석하기" : selectedType === "sns" ? "게시물 분석하기" : "기사 분석하기"}
                          </>
                        )}
                      </Button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AddInsightDialog;
