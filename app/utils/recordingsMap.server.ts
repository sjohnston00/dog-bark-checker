import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import db from './db.server'
import RecordingsRepository from './RecordingsRepository.server'

export const recordingsMap = new Map<
  number,
  { process: ChildProcessWithoutNullStreams; startTime: Date }
>()

export function createSession(recordingId: number, rtspUrl: string) {
  console.log('Starting recording process')
  const recordingsRepo = new RecordingsRepository({ db: db })

  const process = spawn('node', [
    'enhanced-bark-tracker.cjs',
    'stream',
    rtspUrl,
  ])

  process.stdout.on('data', (data) => {
    recordingsRepo.appendLog({ text: data.toString(), recordingId, level: 'stdout' })
    // console.log(`[Recording ${recordingId}]: ${data}`)
  })
  process.stderr.on('data', (data) => {
    recordingsRepo.appendLog({ text: data.toString(), recordingId, level: 'stderr' })
    // console.error(`[Recording ${recordingId}] Error: ${data}`)
  })

  process.on('close', (code) => {
    recordingsRepo.appendLog({ text: `Exited with code ${code}`, recordingId, level: 'stdout' })

    recordingsRepo.update(recordingId, {
      status: code !== 0 ? 'failed' : 'completed',
      endTime: new Date().toISOString(),
    })

    recordingsMap.delete(recordingId)
  })

  recordingsMap.set(recordingId, {
    process,
    startTime: new Date(),
  })

  return process
}

export function stopRecording(recordingId: number) {
  const recording = recordingsMap.get(recordingId)
  recording?.process.kill('SIGTERM')
}
