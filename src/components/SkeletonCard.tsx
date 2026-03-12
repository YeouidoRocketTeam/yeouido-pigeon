const SkeletonCard = () => {
  return (
    <div className="bg-card rounded-xl p-5 card-shadow animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 rounded-sm bg-muted" />
        <div className="h-3 w-24 bg-muted rounded" />
      </div>
      <div className="h-5 w-3/4 bg-muted rounded mb-2" />
      <div className="h-4 w-full bg-muted rounded mb-1" />
      <div className="h-4 w-2/3 bg-muted rounded mb-4" />
      <div className="flex gap-2">
        <div className="h-6 w-16 bg-muted rounded-full" />
        <div className="h-6 w-20 bg-muted rounded-full" />
      </div>
    </div>
  );
};

export default SkeletonCard;
