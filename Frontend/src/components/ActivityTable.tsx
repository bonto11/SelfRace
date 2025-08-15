import { useNavigate } from 'react-router-dom'
import type { ActivitySummary } from '../types'

type Props = { activities: ActivitySummary[] }

/** Sekundy → "H:MM:SS" alebo "M:SS" */
function formatDurationFromSeconds(seconds?: number | null) {
  if (!seconds || seconds <= 0) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return h > 0
    ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
    : `${m}:${s.toString().padStart(2,'0')}`
}

/** Metre → kilometre s 2 desatinnými miestami */
function metersToKmLabel(m?: number | null) {
  if (m == null) return '-'
  return (m / 1000).toFixed(2)
}

/** m/s → km/h s 2 desatinnými miestami (len pre info v tabuľke, nie je nutné) */
function mpsToKmhLabel(mps?: number | null) {
  if (!mps && mps !== 0) return '-'
  return (mps * 3.6).toFixed(2)
}

export default function ActivityTable({ activities }: Props) {
  const navigate = useNavigate()

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ textAlign:'left',  borderBottom:'1px solid #ddd', padding:'6px' }}>ID</th>
          <th style={{ textAlign:'left',  borderBottom:'1px solid #ddd', padding:'6px' }}>Názov</th>
          <th style={{ textAlign:'left',  borderBottom:'1px solid #ddd', padding:'6px' }}>Date</th>
          <th style={{ textAlign:'right', borderBottom:'1px solid #ddd', padding:'6px' }}>Distance (km)</th>
          <th style={{ textAlign:'right', borderBottom:'1px solid #ddd', padding:'6px' }}>Pohybový čas</th>
          <th style={{ textAlign:'right', borderBottom:'1px solid #ddd', padding:'6px' }}>Avg HR (bpm)</th>
          <th style={{ textAlign:'right', borderBottom:'1px solid #ddd', padding:'6px' }}>Max HR (bpm)</th>
          <th style={{ textAlign:'right', borderBottom:'1px solid #ddd', padding:'6px' }}>Elevation (m)</th>
          <th style={{ textAlign:'right', borderBottom:'1px solid #ddd', padding:'6px' }}>Avg pace (min/km)</th>
          <th style={{ textAlign:'right', borderBottom:'1px solid #ddd', padding:'6px' }}>Avg speed (km/h)</th>
        </tr>
      </thead>
      <tbody>
        {activities.map((a) => (
          <tr
            key={a.id}
            onClick={() => navigate(`/activity/${a.id}`)}
            style={{ cursor:'pointer', borderBottom:'1px solid #eee' }}
            title="Klikni pre detail aktivity"
          >
            <td style={{ padding:'6px' }}>{a.id}</td>
            <td style={{ padding:'6px' }}>{a.name ?? '(bez názvu)'}</td>
            <td style={{ padding:'6px' }}>{new Date(a.date).toLocaleString()}</td>

            {/* SI → kilometre len na zobrazenie */}
            <td style={{ padding:'6px', textAlign:'right' }}>
              {metersToKmLabel(a.distance_m)}
            </td>

            {/* SI → sekundy formátované do "H:MM:SS" */}
            <td style={{ padding:'6px', textAlign:'right' }}>
              {formatDurationFromSeconds(a.moving_time_s)}
            </td>

            <td style={{ padding:'6px', textAlign:'right' }}>
              {a.average_heartrate_bpm ?? '-'}
            </td>

            <td style={{ padding:'6px', textAlign:'right' }}>
              {a.max_heartrate_bpm ?? '-'}
            </td>

            <td style={{ padding:'6px', textAlign:'right' }}>
              {a.elevation_gain_m ?? '-'}
            </td>

            {/* Pace poskytuje backend už vo formáte "m:ss" */}
            <td style={{ padding:'6px', textAlign:'right' }}>
              {a.pace_min_per_km ?? '-'}
            </td>

            {/* Bonus: priemerná rýchlosť v km/h, odvodená z m/s */}
            <td style={{ padding:'6px', textAlign:'right' }}>
              {mpsToKmhLabel(a.average_speed_mps)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
