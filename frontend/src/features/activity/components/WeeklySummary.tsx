type Props = {
  weeks: any[];
  metric: "km" | "time" | "trimp";
  selectedWeek: string;
  hideTitle?: boolean;
};

export default function WeeklySummary({ weeks, metric, selectedWeek, hideTitle = true }: Props) {
  // ...existujúca logika výpočtov

  return (
    <div className="mt-3 rounded border border-gray-700 p-3">
      {!hideTitle && (
        <h4 className="font-semibold mb-2">Week-in-Review {selectedWeek}</h4>
      )}
      {/* tvoje KPI dlaždice */}
    </div>
  );
}
