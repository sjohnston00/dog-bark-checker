import { data } from 'react-router'
import RecordingsRepository from '~/utils/RecordingsRepository.server'
import db from '~/utils/db.server'
import type { Route } from './+types/recordings.$id.sse'
import { recordingsMap } from '~/utils/recordingsMap.server'

function encode({ event, data }: { event: string; data: Record<string, any> }) {
  const encoder = new TextEncoder()
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export async function loader({ params }: Route.LoaderArgs) {
  const recordingId = Number(params.id)

  if (!recordingId || recordingId < 0) {
    throw data({ message: 'Invalid recording ID' }, { status: 400 })
  }
  const recordingsRepo = new RecordingsRepository({ db: db })
  const recording = recordingsRepo.getById(recordingId)

  if (!recording) {
    throw data({ message: 'Recording not found' }, { status: 404 })
  }

  //if it's completed return a status 410 - Gone which means the resource WAS here but now it's finished
  if (recording.status !== 'pending') {
    throw data({ message: 'Recording already finished' }, { status: 410 })
  }

  const recordingSession = recordingsMap.get(recordingId)
  if (!recordingSession) {
    throw data({ message: 'Live recording not found' }, { status: 404 })
  }

  //TODO: get the recordingMap and the current live recording if it's still pending

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encode({
          event: 'start',
          data: {
            date: new Date(),
          },
        })
      )

      const onData = (payload: unknown) => {
        try {
          controller.enqueue(
            encode({ event: 'data', data: payload as Record<string, any> })
          )
        } catch {
          // Controller already closed (client disconnected)
        }
      }

      const onError = (payload: unknown) => {
        try {
          controller.enqueue(
            encode({ event: 'error', data: payload as Record<string, any> })
          )
        } catch {}
        cleanup()
        controller.close()
      }

      const onEnd = (payload: unknown) => {
        try {
          controller.enqueue(
            encode({ event: 'end', data: payload as Record<string, any> })
          )
        } catch {}
        cleanup()
        controller.close()
      }
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(
            encode({
              event: 'ping',
              data: {
                date: new Date(),
              },
            })
          )
        } catch {
          // Controller already closed (client disconnected)
          cleanup()
          controller.close()
        }
      }, 5_000)

      recordingSession.emitter.on('stream', onData)
      recordingSession.emitter.on('bark', onData)
      recordingSession.emitter.once('error', onError)
      recordingSession.emitter.once('end', onEnd)

      function cleanup() {
        clearInterval(pingInterval)
        recordingSession!.emitter.off('stream', onData)
        recordingSession!.emitter.off('error', onError)
        recordingSession!.emitter.off('end', onEnd)
      }

      // React Router will call this when the client disconnects
      return cleanup
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
