import type { Database } from 'better-sqlite3'
import type YAMNetBarkDetector from './tensorflow-models.server'
import { spawn, type ChildProcess } from 'node:child_process'
import RecordingsRepository from '~/utils/RecordingsRepository.server'
import type EventEmitter from 'node:events'

type RtspProcessorConstructorArgs = {
  rtspUrl: string
  detector: YAMNetBarkDetector
  db: Database
  recordingId: number
  emitter: EventEmitter
}

export default class RtspProcessor {
  private rtspUrl: string
  private detector: YAMNetBarkDetector
  private db: Database
  private ffmpegProcess: ChildProcess | null
  private audioBuffer: Buffer[]
  private readonly bufferSize: number
  private detectionCount: number
  private recordingId: number
  private recordingsRepo: RecordingsRepository
  private emitter: EventEmitter
  constructor({
    rtspUrl,
    detector,
    db,
    recordingId,
    emitter,
  }: RtspProcessorConstructorArgs) {
    this.rtspUrl = rtspUrl
    this.detector = detector
    this.db = db
    this.ffmpegProcess = null
    this.audioBuffer = []
    this.bufferSize = 16_000 // YAMNet prefers 16kHz
    this.detectionCount = 0
    this.recordingId = recordingId
    this.recordingsRepo = new RecordingsRepository({ db: this.db })
    this.emitter = emitter
  }

  async start() {
    console.log(`Starting RTSP stream processing fr: ${this.rtspUrl}`)

    this.ffmpegProcess = spawn('ffmpeg', [
      '-i',
      this.rtspUrl,
      '-vn',
      '-acodec',
      'pcm_s16le',
      '-ar',
      '16000', // Higher sample rate for ML models
      '-ac',
      '1',
      '-threads',
      '0',
      '-f',
      'wav',
      'pipe:1',
    ])

    const HEADER_SIZE: number = 44
    let isWavHeader = true
    let headerBuffer = Buffer.alloc(0)

    this.ffmpegProcess.stdout!.on('data', (data: Buffer) => {
      // Accumulate until we've consumed the full 44-byte WAV header
      if (isWavHeader) {
        headerBuffer = Buffer.concat([headerBuffer, data])
        if (headerBuffer.length < HEADER_SIZE) return

        // Slice off the header, keep the rest as PCM
        data = headerBuffer.subarray(HEADER_SIZE)
        headerBuffer = Buffer.alloc(0)
        isWavHeader = false

        if (data.length === 0) return
      }
      this.processAudioData(data)
    })

    this.ffmpegProcess.stderr!.on('data', (data: Buffer) => {
      const message = data.toString()
      this.recordingsRepo.appendLog({
        level: 'stderr',
        recordingId: this.recordingId,
        text: message,
      })
    })

    this.ffmpegProcess.on('close', (code, signal) => {
      this.recordingsRepo.appendLog({
        level: 'stdout',
        recordingId: this.recordingId,
        text: `FFmpeg process closed (${signal}) with code ${code}`,
      })
    })
  }

  private processAudioData(data: Buffer) {
    // Each sample is 2 bytes, signed 16-bit little-endian (pcm_s16le)
    const dataChunks = data.length / 2
    let sumOfSquares = 0

    const samples: number[] = []

    //increment by 2
    for (let i = 0; i < data.length; i += 2) {
      const sample = data.readInt16LE(i) / 32768 // normalise to -1..1
      sumOfSquares += sample * sample
      samples.push(sample)
    }
    const rms = Math.sqrt(sumOfSquares / dataChunks)
    // Convert to dBFS — silence is -Infinity, full scale is 0
    const decibels = 20 * Math.log10(rms)
    this.emitter.emit('stream', { db: decibels })

    //push the chunks into the audioBuffer
    this.audioBuffer.push(Buffer.from(samples))

    //when we have the audio buffer bigger then the buffer size, pipe the audio through detector
    while (this.audioBuffer.length >= this.bufferSize) {
      const chunk = this.audioBuffer.splice(0, this.bufferSize)
      const timestamp = new Date()

      this.processAudioChunk(chunk, timestamp)
    }
  }

  private async processAudioChunk(chunk: Buffer[], timestamp: Date) {
    try {
      const result = await this.detector.detectBark(chunk, timestamp)
      if (!result) {
        console.log('Result is empty')
        return
      }

      if (result.isBark) {
        this.detectionCount++

        this.recordingsRepo.saveBarkDetection({
          recordingId: this.recordingId,
          confidence: result.confidence,
          modelUsed: result.modelUsed,
          source: 'rtsp_stream',
          timestamp: timestamp.toISOString(),
        })
        this.emitter.emit('bark', { result, timestamp })

        this.recordingsRepo.appendLog({
          level: 'stdout',
          recordingId: this.recordingId,
          text: `Bark #${this.detectionCount} detected at ${timestamp.toLocaleString()} Model: ${result.modelUsed} | Confidence: ${(
            result.confidence * 100
          ).toFixed(1)}%`,
        })
      }
    } catch (error: unknown) {
      this.recordingsRepo.appendLog({
        level: 'stderr',
        recordingId: this.recordingId,
        text: `Error processing audio chunk: ${String(error)}`,
      })
    }
  }

  stop() {
    if (!this.ffmpegProcess) {
      console.error('No ffmpeg process to kill')
      return
    }
    this.ffmpegProcess.kill()
    this.emitter.emit('end', null)
    setImmediate(() => {
      this.emitter.removeAllListeners()
    })
  }
}
