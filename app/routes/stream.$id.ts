// app/routes/stream.$id.ts
// Resource route — no default export component, just a loader.
// Handles GET /stream/:id and returns a Server-Sent Events stream.

import {
  data,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from 'react-router'
import { sessions } from '~/lib/streamRegistry.server'

export async function loader({ params }: LoaderFunctionArgs) {
  const session = sessions.get(params.id!)

  if (!session) {
    return new Response('Stream not found', { status: 404 })
  }

  const stream = new ReadableStream({
    start(controller) {
      const encode = (event: string, payload: unknown) =>
        new TextEncoder().encode(
          `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`
        )

      // Send initial connected acknowledgement
      controller.enqueue(
        encode('data', { connected: true, streamId: session.id })
      )

      const onData = (payload: unknown) => {
        try {
          controller.enqueue(encode('data', payload))
        } catch {
          // Controller already closed (client disconnected)
        }
      }

      const onError = (payload: unknown) => {
        try {
          controller.enqueue(encode('error', payload))
        } catch {}
        cleanup()
        controller.close()
      }

      const onEnd = (payload: unknown) => {
        try {
          controller.enqueue(encode('end', payload))
        } catch {}
        cleanup()
        controller.close()
      }

      session.emitter.on('stream', onData)
      session.emitter.once('error', onError)
      session.emitter.once('end', onEnd)

      function cleanup() {
        session!.emitter.off('stream', onData)
        session!.emitter.off('error', onError)
        session!.emitter.off('end', onEnd)
      }

      // React Router will call this when the client disconnects
      return cleanup
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
export async function action({ request, params }: ActionFunctionArgs) {
  const session = sessions.get(params.id!)

  if (!session) {
    return new Response('Stream not found', { status: 404 })
  }

  if (request.method !== 'DELETE') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  session.stop()

  return new Response(null, {
    status: 204,
  })
}
