import EventEmitter from 'node:events'
import RtspProcessor from '~/lib/rtspProcessor.server'
import YAMNetBarkDetector from '~/lib/tensorflow-models.server'
import db from './db.server'

type RecordingSession = {
  rtspProcessor: RtspProcessor
  startTime: Date
  emitter: EventEmitter
  stop: () => void
}

export const recordingsMap = new Map<number, RecordingSession>()

export async function createSession(recordingId: number, rtspUrl: string) {
  console.log('Starting recording process')
  const emitter = new EventEmitter()
  emitter.setMaxListeners(50)

  const detector = new YAMNetBarkDetector()
  await detector.initModel()

  const rtspProcessor = new RtspProcessor({
    db,
    emitter,
    recordingId,
    rtspUrl,
    detector: detector,
  })

  rtspProcessor.start()

  const stop = () => {
    rtspProcessor.stop()
    recordingsMap.delete(recordingId)
    console.log(`Session deleted now at ${recordingsMap.size} open sessions`)
  }

  recordingsMap.set(recordingId, {
    rtspProcessor,
    emitter: emitter,
    stop: stop,
    startTime: new Date(),
  })
}

export function stopRecording(recordingId: number) {
  const recording = recordingsMap.get(recordingId)
  if (!recording) {
    console.error(`Recording ID: ${recordingId} not found in map`)
    return
  }
  recording?.stop()
}
