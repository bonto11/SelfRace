import client from './client'
import { ActivitySummary, ActivityDetailRow } from '../types'

export async function fetchActivities(userId: number): Promise<ActivitySummary[]> {
  const res = await client.get(`/activities`, { params: { user_id: userId } })
  return res.data
}

export async function cacheStreams(userId: number, activityId: number) {
  await client.post(`/activities/${activityId}/streams/cache`, { user_id: userId })
}

export async function fetchStreams(userId: number, activityId: number): Promise<ActivityDetailRow[]> {
  const res = await client.get(`/activities/${activityId}/streams`, { params: { user_id: userId } })
  return res.data
}
