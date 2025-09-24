// src/features/coach/components/Control.tsx

"use client";

type Props = {
  weeks: number;
  goal: string;
  sports: string[];
  onWeeksChange: (w: number) => void;
  onGoalChange: (g: string) => void;
  onToggleSport: (s: string) => void;
};

export default function Controls(props: Props) {
  const { weeks, goal, sports, onWeeksChange, onGoalChange, onToggleSport } =
    props;

  return (
    <div className="bg-gray-800 p-4 rounded space-y-3">
      <div className="flex gap-3 items-center">
        <label className="text-sm opacity-80">Weeks:</label>
        {[4, 6, 8, 12].map((w) => (
          <button
            key={w}
            onClick={() => onWeeksChange(w)}
            className={`px-3 py-1 rounded text-sm ${
              weeks === w ? "bg-blue-600 text-white" : "bg-gray-700"
            }`}
          >
            {w}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-sm opacity-80 mb-1">Goal</label>
        <input
          className="w-full bg-gray-900 border border-gray-600 rounded p-2"
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          placeholder="Napíš cieľ (preteky, výkon...)"
        />
      </div>

      <div className="flex gap-3 items-center">
        <span className="text-sm opacity-80">Sports:</span>
        {["run", "bike", "strength"].map((s) => (
          <label key={s} className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={sports.includes(s)}
              onChange={() => onToggleSport(s)}
            />
            {s}
          </label>
        ))}
      </div>
    </div>
  );
}
