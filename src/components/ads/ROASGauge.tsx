"use client";

interface ROASGaugeProps {
  actual: number;
  target?: number;
  label?: string;
}

export function ROASGauge({ actual, target = 3, label = "ROAS" }: ROASGaugeProps) {
  const percentage = Math.min((actual / target) * 100, 100);
  const isGood = actual >= target;
  const isWarning = actual >= 1 && actual < target;
  const isBad = actual < 1;

  const color = isGood ? "#22c55e" : isWarning ? "#f59e0b" : "#ef4444";
  const bgColor = isGood ? "rgba(34,197,94,0.1)" : isWarning ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";

  // SVG arc gauge
  const radius = 60;
  const strokeWidth = 10;
  const circumference = Math.PI * radius; // half circle
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="148" height="90" viewBox="0 0 148 90">
        {/* Background arc */}
        <path
          d="M 14 80 A 60 60 0 0 1 134 80"
          fill="none"
          stroke="var(--tt-border)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d="M 14 80 A 60 60 0 0 1 134 80"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
        {/* Value text */}
        <text x="74" y="65" textAnchor="middle" fill={color} fontSize="24" fontWeight="bold">
          {actual.toFixed(1)}x
        </text>
        <text x="74" y="82" textAnchor="middle" fill="var(--tt-text-muted)" fontSize="11">
          Target: {target.toFixed(1)}x
        </text>
      </svg>
      <div className="flex items-center gap-2">
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ background: bgColor, color }}
        >
          {isGood ? "On Track" : isWarning ? "Below Target" : "Critical"}
        </span>
        <span className="text-xs" style={{ color: "var(--tt-text-muted)" }}>{label}</span>
      </div>
    </div>
  );
}
