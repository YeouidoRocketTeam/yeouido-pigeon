import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bookmark, Link2, Image, Youtube } from "lucide-react";

const WelcomeDialog = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("kitch-welcome-seen");
    if (!hasSeenWelcome) {
      setOpen(true);
    }
  }, []);

  const handleConfirm = () => {
    localStorage.setItem("kitch-welcome-seen", "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleConfirm(); }}>
      <DialogContent className="sm:max-w-sm mx-auto rounded-2xl p-8 text-center border-0 shadow-2xl [&>button]:hidden">
        <div className="flex flex-col items-center gap-5">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bookmark className="h-8 w-8 text-primary" />
          </div>

          {/* Title */}
          <div>
            <h2 className="text-xl font-bold text-foreground leading-tight">
              투자 뉴스,
              <br />
              이제 빠르게 소화하세요
            </h2>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed">
            놓치기 쉬운 투자 기사나 영상을
            <br />
            링크 하나로 저장하면
            <br />
            <span className="font-semibold text-foreground">핵심 내용</span>만 골라서 보여드려요.
          </p>

          <p className="text-sm text-muted-foreground leading-relaxed">
            긴 기사 처음부터 끝까지
            <br />
            읽을 필요 없어요.
          </p>

          {/* Feature list */}
          <div className="w-full bg-muted rounded-xl p-4 space-y-3 text-left">
            <div className="flex items-center gap-3 text-sm text-foreground">
              <Link2 className="h-4 w-4 text-primary shrink-0" />
              <span>뉴스 기사 — 링크만 붙여넣기</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-foreground">
              <Image className="h-4 w-4 text-primary shrink-0" />
              <span>스크린샷 — 이미지 바로 저장</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-foreground">
              <Youtube className="h-4 w-4 text-primary shrink-0" />
              <span>유튜브 — 영상 핵심 텍스트로</span>
            </div>
          </div>

          {/* CTA */}
          <Button onClick={handleConfirm} className="w-full h-12 text-base font-semibold rounded-xl">
            확인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeDialog;
