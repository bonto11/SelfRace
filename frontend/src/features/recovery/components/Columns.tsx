export default function Columns() {
  return (
    <colgroup>
      <col className="w-[10%]" /> {/* Date */}
      <col className="w-[7%]" />  {/* RHR */}
      <col className="w-[7%]" />  {/* HRV avg */}
      <col className="w-[7%]" />  {/* HRV max */}
      <col className="w-[10%]" /> {/* Sleep start */}
      <col className="w-[10%]" /> {/* Sleep (hh:mm) */}
      <col className="w-[7%]" />  {/* Food */}
      <col className="w-[7%]" />  {/* Caffeine */}
      <col className="w-[10%]" /> {/* Alcohol ml */}
      <col className="w-[7%]" />  {/* Alc % */}
      <col className="w-[18%]" /> {/* Comment */}
    </colgroup>
  );
}