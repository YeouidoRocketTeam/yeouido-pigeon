import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface AnalyzingOverlayProps {
  isVisible: boolean;
}

const messages = [
  "AI 분석 실행 중...",
  "핵심 내용 추출 중...",
  "관련 종목 분석 중...",
  "신뢰도 평가 중...",
  "투자 심리 분석 중...",
];

const AnalyzingOverlay = ({ isVisible }: AnalyzingOverlayProps) => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setMsgIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="flex flex-col items-center gap-6 p-10 rounded-3xl bg-card shadow-xl"
          >
            {/* Animated circles */}
            <div className="flex items-center gap-1">
              {[
                "bg-[hsl(var(--primary))]",
                "bg-amber-400",
                "bg-emerald-500",
              ].map((color, i) => (
                <motion.div
                  key={i}
                  className={`w-10 h-10 rounded-full ${color}`}
                  animate={{
                    y: [0, -12, 0],
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.2,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>

            {/* Title */}
            <div className="text-center">
              <h3 className="text-lg font-bold text-foreground mb-1">
                기사 분석 중
              </h3>
              <AnimatePresence mode="wait">
                <motion.p
                  key={msgIndex}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.3 }}
                  className="text-sm text-muted-foreground"
                >
                  {messages[msgIndex]}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Dot progress */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  animate={{
                    backgroundColor: [
                      "hsl(var(--muted-foreground) / 0.2)",
                      "hsl(var(--primary))",
                      "hsl(var(--muted-foreground) / 0.2)",
                    ],
                  }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    delay: i * 0.4,
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnalyzingOverlay;
