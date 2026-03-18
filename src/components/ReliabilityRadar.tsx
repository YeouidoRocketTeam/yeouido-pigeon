interface RadarChartProps {
  /** Object mapping criterion key to score (0-100) */
  scores: Record<string, number>;
  size?: number;
}

const AXES = [
  { key: "source_authority", label: "출처 권위도" },
  { key: "interest_transparency", label: "이해관계 투명성" },
  { key: "data_specificity", label: "데이터 구체성" },
  { key: "logical_completeness", label: "논리적 완결성" },
  { key: "time_validity", label: "시점 유효성" },
  { key: "cross_verification", label: "교차 검증" },
];

const RINGS = [20, 40, 60, 80, 100];

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const ReliabilityRadar = ({ scores, size = 260 }: RadarChartProps) => {
  const padding = 50;
  const totalSize = size + padding * 2;
  const cx = totalSize / 2;
  const cy = totalSize / 2;
  const maxR = size * 0.36;
  const n = AXES.length;
  const angleStep = 360 / n;

  // Build polygon ring paths
  const ringPaths = RINGS.map((ring) => {
    const r = (ring / 100) * maxR;
    const pts = AXES.map((_, i) => polarToCartesian(cx, cy, r, i * angleStep));
    return pts.map((p) => `${p.x},${p.y}`).join(" ");
  });

  // Build data polygon
  const dataPts = AXES.map((axis, i) => {
    const val = Math.max(0, Math.min(100, scores[axis.key] ?? 0));
    const r = (val / 100) * maxR;
    return polarToCartesian(cx, cy, r, i * angleStep);
  });
  const dataPolygon = dataPts.map((p) => `${p.x},${p.y}`).join(" ");

  // Label positions (slightly outside the outer ring)
  const labelR = maxR + 28;
  const labels = AXES.map((axis, i) => {
    const pos = polarToCartesian(cx, cy, labelR, i * angleStep);
    return { ...axis, x: pos.x, y: pos.y, score: scores[axis.key] ?? 0 };
  });

  return (
    <div className="flex justify-center">
      <svg width="100%" viewBox={`0 0 ${totalSize} ${totalSize}`} style={{ maxWidth: totalSize }}>
        {/* Grid rings */}
        {ringPaths.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={i === ringPaths.length - 1 ? 1.2 : 0.6}
            opacity={0.5}
          />
        ))}

        {/* Axis lines */}
        {AXES.map((_, i) => {
          const end = polarToCartesian(cx, cy, maxR, i * angleStep);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={end.x}
              y2={end.y}
              stroke="hsl(var(--border))"
              strokeWidth={0.6}
              opacity={0.5}
            />
          );
        })}

        {/* Data fill */}
        <polygon
          points={dataPolygon}
          fill="hsl(var(--primary))"
          fillOpacity={0.15}
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data points */}
        {dataPts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill="hsl(var(--primary))"
            stroke="hsl(var(--background))"
            strokeWidth={1.5}
          />
        ))}

        {/* Labels */}
        {labels.map((l, i) => {
          // Adjust text anchor based on position
          const angle = i * angleStep;
          let anchor: string = "middle";
          if (angle > 30 && angle < 150) anchor = "start";
          else if (angle > 210 && angle < 330) anchor = "end";

          return (
            <g key={i}>
              <text
                x={l.x}
                y={l.y - 5}
                textAnchor={anchor}
                fill="hsl(var(--foreground))"
                fontSize={10}
                fontWeight={600}
              >
                {l.label}
              </text>
              <text
                x={l.x}
                y={l.y + 8}
                textAnchor={anchor}
                fill="hsl(var(--muted-foreground))"
                fontSize={9}
              >
                {l.score}점
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default ReliabilityRadar;
