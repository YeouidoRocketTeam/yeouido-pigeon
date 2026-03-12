import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Link, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface AddInsightDialogProps {
  onAdded: () => void;
}

const AddInsightDialog = ({ onAdded }: AddInsightDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !user) return;

    setIsSubmitting(true);

    try {
      // Insert the insight with processing status
      const { data: insight, error: insertError } = await supabase
        .from("insights")
        .insert({
          user_id: user.id,
          url: url.trim(),
          status: "processing",
          source_domain: new URL(url.trim()).hostname.replace("www.", ""),
          favicon_url: `https://www.google.com/s2/favicons?domain=${new URL(url.trim()).hostname}&sz=32`,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      toast({ title: "추가 완료", description: "AI가 분석 중입니다..." });
      setUrl("");
      setIsOpen(false);
      onAdded();

      // Trigger AI analysis via edge function
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

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        className="rounded-full h-10 w-10"
      >
        <Plus className="h-5 w-5" />
      </Button>

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
              className="w-full max-w-md bg-card rounded-xl p-6 card-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">인사이트 추가</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative">
                  <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder="https://n.news.naver.com/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    className="pl-10 h-12"
                    autoFocus
                  />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      추가 중...
                    </>
                  ) : (
                    "분석 시작"
                  )}
                </Button>
              </form>

              <p className="mt-3 text-xs text-muted-foreground text-center">
                뉴스, 유튜브, SNS 등의 URL을 붙여넣으세요
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AddInsightDialog;
