import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useUser } from '../store/useUser'
import { cacheStreams, fetchStreams } from '../api/activities'
import { ActivityDetailRow } from '../types'
import ActivityChart from '../components/ActivityChart'

export default function ActivityDetailPage() {
  const { id } = useParams()
  const { currentUserId } = useUser()
  const [rows, setRows] = useState<ActivityDetailRow[]>([])

  useEffect(() => {
    if (!id || !currentUserId) return
    const actId = parseInt(id, 10)

    cacheStreams(currentUserId, actId).then(() => {
      fetchStreams(currentUserId, actId).then(setRows)
    })
  }, [id, currentUserId])

  return (
    <div>
      <h1>Detail aktivity {id}</h1>
      <ActivityChart rows={rows} />
    </div>
  )
}
