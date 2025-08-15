import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ActivityDetailRow } from '../types'

type Props = { rows: ActivityDetailRow[] }

export default function ActivityChart({ rows }: Props) {
  return (
    <div style={{ width: '100%', height: 400 }}>
      <ResponsiveContainer>
        <LineChart data={rows}>
          <XAxis dataKey="time" />
          <YAxis yAxisId="left" label={{ value: 'HR (bpm)', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'Altitude (m)', angle: 90, position: 'insideRight' }} />
          <Tooltip />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="heartrate_bpm" stroke="#e11d48" dot={false} />
          <Line yAxisId="right" type="monotone" dataKey="altitude_m" stroke="#0ea5e9" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
