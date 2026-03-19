import { data } from 'react-router'
import RecordingsRepository from '~/utils/RecordingsRepository.server'
import db from '~/utils/db.server'
import type { Route } from './+types/recordings.$id.sse'

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

  //TODO: get the recordingMap and the current live recording if it's still pending
  //TODO: if it's complete return a status 410 - Gone which means the resource WAS here but now it's finished

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
      setInterval(() => {
        controller.enqueue(
          encode({
            event: 'ping',
            data: {
              date: new Date(),
            },
          })
        )
      }, 1000)

      return () => {
        console.log('cleanup function')
      }
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
