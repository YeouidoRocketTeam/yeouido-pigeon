import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Link2, Youtube } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const WelcomeDialog = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const checkFirstVisit = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const storageKey = `welcome_shown_${user.id}`;
      if (localStorage.getItem(storageKey)) return;

      // Check if user was just created (within last 60 seconds)
      const createdAt = new Date(user.created_at).getTime();
      const now = Date.now();
      if (now - createdAt < 60_000) {
        setOpen(true);
        localStorage.setItem(storageKey, "true");
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        checkFirstVisit();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
      <DialogContent className="sm:max-w-sm mx-auto rounded-2xl p-8 text-center border-0 shadow-2xl [&>button]:hidden">
        <div className="flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <ExternalLink className="h-8 w-8 text-primary" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-foreground leading-tight">
              투자 뉴스,
              <br />
              이제 빠르게 소화하세요
            </h2>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            그동안 저장만해뒀던 투자 정보,
            <br />
            <span className="font-semibold text-foreground">공유</span>하기 버튼 하나로 정리하고
            <br />
            <span className="font-semibold text-foreground">핵심 내용</span> 받아보세요.
          </p>

          <p className="text-sm text-muted-foreground leading-relaxed">
            긴 기사 처음부터 끝까지
            <br />
            읽을 필요 없어요.
          </p>

          <div className="w-full bg-muted rounded-xl p-4 space-y-3 text-left">
            <div className="flex items-center gap-3 text-sm text-foreground">
              <Link2 className="h-4 w-4 text-primary shrink-0" />
              <span>뉴스 기사 — 링크만 붙여넣기</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-foreground">
              <Youtube className="h-4 w-4 text-primary shrink-0" />
              <span>유튜브 — 영상 핵심 텍스트로</span>
            </div>
          </div>

          <Button onClick={() => setOpen(false)} className="w-full h-12 text-base font-semibold rounded-xl">
            확인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeDialog;
