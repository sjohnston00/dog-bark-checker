import React, { useEffect, useRef, useState } from 'react'
import { twJoin } from 'tailwind-merge'

export default function Page() {
  const [streamId, setStreamId] = useState<string | null>(null)
  const [events, setEvents] = useState<string[]>([])
  const esRef = useRef<EventSource | null>(null)
  const [currentVolume, setCurrentVolume] = useState(0)

  async function startStream() {
    const res = await fetch('/stream', {
      method: 'POST',
    })
    const { streamId } = await res.json()
    setStreamId(streamId)
  }

  async function endStream() {
    const res = await fetch(`/stream/${streamId}`, {
      method: 'DELETE',
    })

    console.log(`DELETE ${res.status}`)
    setStreamId(null)
  }

  useEffect(() => {
    if (!streamId) return

    // EventSource automatically targets the resource route loader
    const es = new EventSource(`/stream/${streamId}`)
    esRef.current = es

    es.addEventListener('data', (e) => {
      setEvents((prev) => [...prev, `data: ${e.data}`])

      try {
        const data = JSON.parse(e.data)
        console.log(data)

        if (data.db) {
          setCurrentVolume(100 - Math.abs(data.db))
        }
      } catch (error) {
        console.error('Failed to parse JSON from SSE')
      }
    })
    es.addEventListener('error', (e) => {
      setEvents((prev) => [
        ...prev,
        `error: ${'data' in e ? e.data : 'unknown'}`,
      ])
      es.close()
    })
    es.addEventListener('end', () => {
      setEvents((prev) => [...prev, 'stream ended'])
      es.close()
      esRef.current = null
    })

    return () => {
      es.close()
      setCurrentVolume(0)
      esRef.current = null
    }
  }, [streamId])

  return (
    <div>
      <button className='btn' onClick={startStream} disabled={!!streamId}>
        Start Stream
      </button>
      <button
        className='btn btn-error'
        onClick={endStream}
        disabled={!streamId}
      >
        End Stream
      </button>
      <div className='flex flex-col items-center w-fit gap-4'>
        <progress
          max={100}
          value={currentVolume}
          className={twJoin(
            `block mt-4 progress progress-vertical w-10 h-36 transition-progress-value`,
            currentVolume > 60 && 'progress-error'
          )}
        ></progress>
        <span className='text-base-content/60 text-sm'>
          {currentVolume.toFixed(0)}%
        </span>
      </div>

      {/* <ul>
        {events.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul> */}
    </div>
  )
}
