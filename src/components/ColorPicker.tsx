interface Props {
  value: string;
  onChange: (v: string) => void;
}

const PALETTE = [
  "#4f8ef7", "#7c6af7", "#34d399", "#fbbf24", "#f87171",
  "#818cf8", "#f472b6", "#22d3ee", "#a3e635", "#fb923c",
  "#94a3b8", "#e879f9",
];

export function ColorPicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-7 h-7 rounded-md border-2 transition-transform hover:scale-110 ${
            value === c ? "border-foreground scale-110" : "border-transparent"
          }`}
          style={{ background: c }}
          aria-label={c}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded-md border border-border bg-transparent cursor-pointer"
      />
    </div>
  );
}
