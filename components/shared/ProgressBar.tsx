type ProgressBarProps = {
  value: number;
  label: string;
  size?: "sm" | "md";
};

export function ProgressBar({ value, label, size = "md" }: ProgressBarProps) {
  const clamped = Math.min(Math.max(Math.round(value), 0), 100);
  return (
    <div
      className={`progress progress-${size}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      <span className="progress-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}
