import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

const EmptyState = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        당신의 투자 분석가가 준비되었습니다
      </h2>
      <p className="text-muted-foreground max-w-xs leading-relaxed">
        기사, 영상, 게시물의 URL을 추가하여 AI 투자 인사이트를 시작하세요.
      </p>
    </motion.div>
  );
};

export default EmptyState;
