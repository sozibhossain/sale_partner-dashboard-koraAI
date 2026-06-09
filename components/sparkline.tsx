interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Tiny inline trend chart for the KPI cards. Renders a smoothed polyline
 * plus a faint area fill from a numeric series — no chart library needed.
 */
export function Sparkline({
  data,
  color = "#3b82f6",
  width = 88,
  height = 32,
  className = "",
}: SparklineProps) {
  const series = data && data.length > 0 ? data : [0, 0];
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;
  const step = series.length > 1 ? width / (series.length - 1) : width;

  const points = series.map((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const linePath = points.map(([x, y]) => `${x},${y}`).join(" ");
  const areaPath = `${points[0][0]},${height} ${linePath} ${points[points.length - 1][0]},${height}`;
  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPath} fill={`url(#${gradientId})`} />
      <polyline
        points={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
