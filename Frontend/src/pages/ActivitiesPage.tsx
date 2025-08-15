import React from 'react'
import { fetchActivities } from '../api/activities'
import ActivityTable from '../components/ActivityTable'
import type { ActivitySummary } from '../types'

export default function ActivitiesPage() {
  // hodnota používateľa, ktorého aktivity chceme zobraziť
  const [userIdInput, setUserIdInput] = React.useState<string>('') // zobrazované v inpute
  const [currentUserId, setCurrentUserId] = React.useState<number | null>(null) // platný user_id po potvrdení

  // dáta a stav načítania
  const [activities, setActivities] = React.useState<ActivitySummary[]>([])
  const [loading, setLoading] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)

  // funkcia na načítanie aktivít z backendu
  const load = React.useCallback(async () => {
    if (currentUserId == null) return
    try {
      setLoading(true)
      setError(null)
      const data = await fetchActivities(currentUserId)
      setActivities(data)
    } catch (e: any) {
      setError(e?.message ?? 'Nepodarilo sa načítať aktivity.')
    } finally {
      setLoading(false)
    }
  }, [currentUserId])

  // keď sa zmení currentUserId (po stlačení "Reload"), načítaj
  React.useEffect(() => {
    load()
  }, [load])

  // po kliknutí "Reload" spracuj text z inputu a nastav currentUserId (len ak je to celé číslo)
  function onReloadClick() {
    const n = Number(userIdInput)
    if (!Number.isInteger(n) || n <= 0) {
      setError('Zadaj platné celé číslo (user_id).')
      return
    }
    setCurrentUserId(n)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h1 style={{ margin: 0 }}>Aktivity</h1>

      {/* Panel s ovládaním */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label htmlFor="userIdInput">User identifier:</label>
        <input
          id="userIdInput"
          type="number"
          placeholder="Sem zadaj svoje user_id (napr. 9)"
          value={userIdInput}
          onChange={(e) => setUserIdInput(e.target.value)}
          style={{ width: 220 }}
        />
        <button onClick={onReloadClick} disabled={loading}>
          {loading ? 'Načítavam…' : 'Reload'}
        </button>
        {error && <span style={{ color: 'crimson', marginLeft: '0.5rem' }}>{error}</span>}
      </div>

      {/* Obsah */}
      {currentUserId == null ? (
        <p>Zadaj svoje <strong>user_id</strong> a stlač „Reload“.</p>
      ) : loading ? (
        <p>Načítavam zoznam aktivít…</p>
      ) : activities.length === 0 ? (
        <p>Žiadne aktivity pre user_id {currentUserId} (alebo sa nepodarilo načítať).</p>
      ) : (
        <ActivityTable activities={activities} />
      )}
    </div>
  )
}
