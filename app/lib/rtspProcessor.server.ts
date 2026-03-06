import type { Database } from 'better-sqlite3'
import type YAMNetBarkDetector from './tensorflow-models.server'
import { spawn, type ChildProcess } from 'node:child_process'

export default class EnhancedRTSPProcessor {
  rtspUrl: string
  detector: YAMNetBarkDetector
  db: Database
  ffmpegProcess: ChildProcess | null
  audioBuffer: Buffer[]
  bufferSize: number
  detectionCount: number
  constructor(rtspUrl: string, detector: YAMNetBarkDetector, db: Database) {
    this.rtspUrl = rtspUrl
    this.detector = detector
    this.db = db
    this.ffmpegProcess = null
    this.audioBuffer = []
    this.bufferSize = 16_000 // YAMNet prefers 16kHz
    this.detectionCount = 0
  }

  async start() {
    console.log(
      `🎥 Starting enhanced RTSP stream processing from: ${this.rtspUrl}`
    )

    // Use 16kHz for better model compatibility
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

    let wavHeader = true
    let headerBuffer = Buffer.alloc(0)

    this.ffmpegProcess.stdout!.on('data', (data) => {
      if (wavHeader && headerBuffer.length < 44) {
        headerBuffer = Buffer.concat([headerBuffer, data])
        if (headerBuffer.length >= 44) {
          const remainingData = headerBuffer.slice(44)
          if (remainingData.length > 0) {
            this.processAudioData(remainingData)
          }
          wavHeader = false
        }
      } else {
        this.processAudioData(data)
      }
    })

    this.ffmpegProcess.stderr!.on('data', (data) => {
      const message = data.toString()
      if (message.includes('Error') || message.includes('error')) {
        console.error('FFmpeg error:', message)
      }
    })

    this.ffmpegProcess.on('close', (code) => {
      console.log(`FFmpeg process closed with code ${code}`)
    })
  }

  private processAudioData(data: any) {
    const samples = []
    for (let i = 0; i < data.length; i += 2) {
      const sample = data.readInt16LE(i) / 32768.0
      samples.push(sample)
    }

    this.audioBuffer.push(...samples)

    while (this.audioBuffer.length >= this.bufferSize) {
      const chunk = this.audioBuffer.splice(0, this.bufferSize)
      const timestamp = new Date()

      this.processAudioChunk(chunk, timestamp)
    }
  }

  private async processAudioChunk(chunk, timestamp: Date) {
    try {
      const result = await this.detector.detectBark(chunk, timestamp)
      if (!result) {
        console.log('Result is empty')
        return
      }

      if (result.isBark) {
        this.detectionCount++
        this.saveBarkDetection(result, 'rtsp_stream')

        console.log(
          `🐕 Bark #${this.detectionCount} detected at ${timestamp.toLocaleString()}`
        )
        console.log(
          `   Model: ${result.modelUsed} | Confidence: ${(
            result.confidence * 100
          ).toFixed(1)}%`
        )
      }
    } catch (error: unknown) {
      console.error(error)
    }
  }

  saveBarkDetection(result, source) {
    const stmt = this.db.prepare<any[], any>(`
            INSERT INTO detections (timestamp, confidence, source, model_used, audio_features, ensemble_info)
            VALUES (?, ?, ?, ?, ?, ?)
        `)

    stmt.run([
      result.timestamp,
      result.confidence,
      source,
      result.modelUsed || 'unknown',
      JSON.stringify(result.features || {}),
      JSON.stringify(result.ensemble || {}),
    ])

    stmt.finalize()
  }

  stop() {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill()
    } else {
      console.log('no ffmpeg process to kill')
    }
    console.log(`📊 Total detections: ${this.detectionCount}`)
  }
}
