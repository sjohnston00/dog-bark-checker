#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const sqlite3 = require('sqlite3').verbose()
const { Command } = require('commander')
// const tf = require('@tensorflow/tfjs-node')
const wav = require('wav')
const { createReadStream, createWriteStream } = require('fs')

// Initialize database
function initDatabase() {
  const db = new sqlite3.Database('bark_detections.db')

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            confidence REAL NOT NULL,
            duration REAL,
            source TEXT NOT NULL,
            audio_features TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)
  })

  return db
}

// Audio feature extraction using spectral analysis
class AudioAnalyzer {
  constructor() {
    this.sampleRate = 8000 // Reduced from 16000 for faster processing
    this.windowSize = 512 // Reduced from 1024
    this.hopSize = 256 // Reduced from 512
  }

  // Extract features from audio buffer
  extractFeatures(audioBuffer) {
    const features = {}

    // Calculate RMS energy
    features.rms = this.calculateRMS(audioBuffer)

    // Calculate zero crossing rate
    features.zcr = this.calculateZCR(audioBuffer)

    // Calculate spectral centroid (brightness)
    features.spectralCentroid = this.calculateSpectralCentroid(audioBuffer)

    // Calculate spectral rolloff
    features.spectralRolloff = this.calculateSpectralRolloff(audioBuffer)

    return features
  }

  calculateRMS(buffer) {
    let sum = 0
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i]
    }
    return Math.sqrt(sum / buffer.length)
  }

  calculateZCR(buffer) {
    let crossings = 0
    for (let i = 1; i < buffer.length; i++) {
      if (buffer[i] >= 0 !== buffer[i - 1] >= 0) {
        crossings++
      }
    }
    return crossings / (2 * buffer.length)
  }

  calculateSpectralCentroid(buffer) {
    // Use decimated FFT for speed
    const fft = this.simpleFFT(buffer)
    let numerator = 0
    let denominator = 0

    for (let i = 1; i < fft.length; i++) {
      // Skip DC component
      const magnitude = fft[i]
      const frequency = (i * this.sampleRate) / (2 * fft.length)
      numerator += frequency * magnitude
      denominator += magnitude
    }

    return denominator > 0 ? numerator / denominator : 0
  }

  calculateSpectralRolloff(buffer, threshold = 0.85) {
    const fft = this.simpleFFT(buffer)
    let totalEnergy = 0

    // Calculate total energy
    for (let i = 0; i < fft.length; i++) {
      totalEnergy += fft[i]
    }

    const targetEnergy = totalEnergy * threshold
    let cumulativeEnergy = 0

    for (let i = 0; i < fft.length; i++) {
      cumulativeEnergy += fft[i]
      if (cumulativeEnergy >= targetEnergy) {
        return (i * this.sampleRate) / (2 * fft.length)
      }
    }

    return this.sampleRate / 2
  }

  // Optimized FFT using power-of-2 sizes and reduced computation
  simpleFFT(buffer) {
    // Use smaller FFT size for speed - only need low-freq info for bark detection
    const fftSize = Math.min(512, buffer.length) // Much smaller FFT
    const decimated = this.decimateBuffer(buffer, fftSize)

    // Simple magnitude spectrum calculation (faster than full FFT)
    const result = new Array(fftSize / 2).fill(0)

    for (let k = 0; k < fftSize / 2; k++) {
      let real = 0,
        imag = 0
      const step = Math.floor(decimated.length / (fftSize / 2))

      for (let n = 0; n < decimated.length; n += step) {
        const angle = (-2 * Math.PI * k * n) / decimated.length
        real += decimated[n] * Math.cos(angle)
        imag += decimated[n] * Math.sin(angle)
      }
      result[k] = Math.sqrt(real * real + imag * imag)
    }

    return result
  }

  decimateBuffer(buffer, targetSize) {
    if (buffer.length <= targetSize) return buffer
    const step = Math.floor(buffer.length / targetSize)
    const result = []
    for (let i = 0; i < buffer.length; i += step) {
      result.push(buffer[i])
    }
    return result
  }
}

// Bark detection using machine learning approach
class BarkDetector {
  constructor() {
    this.analyzer = new AudioAnalyzer()
    this.threshold = 0.7 // Confidence threshold
    this.model = null

    // Simple heuristic model parameters (can be replaced with trained ML model)
    this.barkProfile = {
      rmsMin: 0.01,
      rmsMax: 0.5,
      zcrMin: 0.05,
      zcrMax: 0.3,
      spectralCentroidMin: 500,
      spectralCentroidMax: 3000,
      spectralRolloffMin: 1000,
      spectralRolloffMax: 8000,
    }
  }

  // Initialize or load a pre-trained model
  async initModel() {
    // For now, using heuristic approach
    // In production, you could load a trained TensorFlow model:
    // this.model = await tf.loadLayersModel('file://./bark_model.json');
    console.log('Bark detector initialized with heuristic model')
  }

  // Detect bark in audio chunk
  detectBark(audioBuffer, timestamp) {
    const features = this.analyzer.extractFeatures(audioBuffer)

    // Heuristic-based detection
    const confidence = this.calculateBarkProbability(features)

    console.log(features)

    const isBark = confidence > this.threshold

    return {
      isBark,
      confidence,
      timestamp,
      features,
    }
  }

  calculateBarkProbability(features) {
    let score = 0
    let maxScore = 4 // Number of features we're checking

    // Check RMS energy (barks are typically loud)
    if (
      features.rms >= this.barkProfile.rmsMin &&
      features.rms <= this.barkProfile.rmsMax
    ) {
      score += 1
    }

    // Check zero crossing rate (barks have moderate ZCR)
    if (
      features.zcr >= this.barkProfile.zcrMin &&
      features.zcr <= this.barkProfile.zcrMax
    ) {
      score += 1
    }

    // Check spectral centroid (barks have mid-range frequencies)
    if (
      features.spectralCentroid >= this.barkProfile.spectralCentroidMin &&
      features.spectralCentroid <= this.barkProfile.spectralCentroidMax
    ) {
      score += 1
    }

    // Check spectral rolloff
    if (
      features.spectralRolloff >= this.barkProfile.spectralRolloffMin &&
      features.spectralRolloff <= this.barkProfile.spectralRolloffMax
    ) {
      score += 1
    }

    return score / maxScore
  }
}

// RTSP stream processor
class RTSPProcessor {
  constructor(rtspUrl, detector, db) {
    this.rtspUrl = rtspUrl
    this.detector = detector
    this.db = db
    this.ffmpegProcess = null
    this.audioBuffer = []
    this.bufferSize = 8000 // 1 second of audio at 8kHz (reduced for speed)
  }

  async start() {
    console.log(`Starting RTSP stream processing from: ${this.rtspUrl}`)

    // Use FFmpeg to extract audio from RTSP stream with optimizations
    this.ffmpegProcess = spawn('ffmpeg', [
      '-i',
      this.rtspUrl,
      '-vn', // No video
      '-acodec',
      'pcm_s16le',
      '-ar',
      '8000', // Reduced sample rate
      '-ac',
      '1',
      '-threads',
      '0', // Use all cores
      '-f',
      'wav',
      'pipe:1',
    ])

    let wavHeader = true
    let headerBuffer = Buffer.alloc(0)

    this.ffmpegProcess.stdout.on('data', (data) => {
      if (wavHeader && headerBuffer.length < 44) {
        headerBuffer = Buffer.concat([headerBuffer, data])
        if (headerBuffer.length >= 44) {
          // Skip WAV header
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

    this.ffmpegProcess.stderr.on('data', (data) => {
      // FFmpeg outputs info to stderr, filter out non-error messages
      const message = data.toString()
      if (message.includes('Error') || message.includes('error')) {
        console.error('FFmpeg error:', message)
      }
    })

    this.ffmpegProcess.on('close', (code) => {
      console.log(`FFmpeg process closed with code ${code}`)
    })
  }

  processAudioData(data) {
    // Convert raw PCM data to float array
    const samples = []
    for (let i = 0; i < data.length; i += 2) {
      const sample = data.readInt16LE(i) / 32768.0 // Convert to float -1 to 1
      samples.push(sample)
    }

    this.audioBuffer.push(...samples)

    // Process buffer when we have enough samples
    while (this.audioBuffer.length >= this.bufferSize) {
      const chunk = this.audioBuffer.splice(0, this.bufferSize)
      const timestamp = new Date().toISOString()

      const result = this.detector.detectBark(chunk, timestamp)

      if (result.isBark) {
        this.saveBarkDetection(result, 'rtsp_stream')
        console.log(
          `🐕 Bark detected at ${timestamp} (confidence: ${(
            result.confidence * 100
          ).toFixed(1)}%)`
        )
      }
    }
  }

  saveBarkDetection(result, source) {
    const stmt = this.db.prepare(`
            INSERT INTO detections (timestamp, confidence, source, audio_features)
            VALUES (?, ?, ?, ?)
        `)

    stmt.run([
      result.timestamp,
      result.confidence,
      source,
      JSON.stringify(result.features),
    ])

    stmt.finalize()
  }

  stop() {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill()
    }
  }
}

// File processor for pre-recorded videos/audio
class FileProcessor {
  constructor(filePath, detector, db) {
    this.filePath = filePath
    this.detector = detector
    this.db = db
  }

  async process() {
    console.log(`Processing file: ${this.filePath}`)

    const tempAudioPath = path.join(__dirname, 'temp_audio.wav')

    // Extract audio from video/audio file
    const ffmpegProcess = spawn('ffmpeg', [
      '-i',
      this.filePath,
      '-vn',
      '-acodec',
      'pcm_s16le',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-y', // Overwrite output file
      tempAudioPath,
    ])

    await new Promise((resolve, reject) => {
      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`FFmpeg failed with code ${code}`))
        }
      })
    })

    // Process the extracted audio
    await this.processAudioFile(tempAudioPath)

    // Clean up temp file
    if (fs.existsSync(tempAudioPath)) {
      fs.unlinkSync(tempAudioPath)
    }
  }

  async processAudioFile(audioPath) {
    const bufferSize = 16000 // 1 second chunks
    let buffer = []
    let totalSamples = 0

    return new Promise((resolve, reject) => {
      const reader = new wav.Reader()

      reader.on('format', (format) => {
        console.log(
          `Audio format: ${format.sampleRate}Hz, ${format.channels} channel(s)`
        )
      })

      reader.on('data', (chunk) => {
        // Convert to float array
        for (let i = 0; i < chunk.length; i += 2) {
          const sample = chunk.readInt16LE(i) / 32768.0
          buffer.push(sample)
          totalSamples++
        }

        // Process complete buffers
        while (buffer.length >= bufferSize) {
          const audioChunk = buffer.splice(0, bufferSize)
          const timeOffset = (totalSamples - buffer.length) / 16000 // seconds
          const timestamp = new Date(
            Date.now() -
              ((totalSamples - (totalSamples - buffer.length)) * 1000) / 16000
          ).toISOString()

          const result = this.detector.detectBark(audioChunk, timestamp)

          if (result.isBark) {
            this.saveBarkDetection(result, this.filePath, timeOffset)
            console.log(
              `🐕 Bark detected at ${timeOffset.toFixed(1)}s (confidence: ${(
                result.confidence * 100
              ).toFixed(1)}%)`
            )
          }
        }
      })

      reader.on('end', () => {
        // Process remaining buffer
        if (buffer.length > 0) {
          const timeOffset = totalSamples / 16000
          const timestamp = new Date(
            Date.now() - ((totalSamples - buffer.length) * 1000) / 16000
          ).toISOString()
          const result = this.detector.detectBark(buffer, timestamp)

          if (result.isBark) {
            this.saveBarkDetection(result, this.filePath, timeOffset)
            console.log(
              `🐕 Bark detected at ${timeOffset.toFixed(1)}s (confidence: ${(
                result.confidence * 100
              ).toFixed(1)}%)`
            )
          }
        }
        resolve()
      })

      reader.on('error', reject)

      createReadStream(audioPath).pipe(reader)
    })
  }

  saveBarkDetection(result, source, timeOffset = null) {
    const stmt = this.db.prepare(`
            INSERT INTO detections (timestamp, confidence, duration, source, audio_features)
            VALUES (?, ?, ?, ?, ?)
        `)

    stmt.run([
      result.timestamp,
      result.confidence,
      timeOffset,
      source,
      JSON.stringify(result.features),
    ])

    stmt.finalize()
  }
}

// Export detection results
function exportResults(db, format = 'txt') {
  return new Promise((resolve, reject) => {
    const query = `
            SELECT timestamp, confidence, duration, source, created_at
            FROM detections
            ORDER BY created_at DESC
        `

    db.all(query, [], (err, rows) => {
      if (err) {
        reject(err)
        return
      }

      if (format === 'txt') {
        const output = rows
          .map(
            (row) =>
              `${row.created_at} - Bark detected (confidence: ${(
                row.confidence * 100
              ).toFixed(1)}%) - Source: ${row.source}${
                row.duration ? ` at ${row.duration.toFixed(1)}s` : ''
              }`
          )
          .join('\n')

        fs.writeFileSync('bark_detections.txt', output)
        console.log('Results exported to bark_detections.txt')
      } else if (format === 'json') {
        fs.writeFileSync('bark_detections.json', JSON.stringify(rows, null, 2))
        console.log('Results exported to bark_detections.json')
      }

      resolve()
    })
  })
}

// Main CLI application
async function main() {
  const program = new Command()

  program
    .name('bark-tracker')
    .description('Track dog barking from video/audio streams')
    .version('1.0.0')

  program
    .command('stream')
    .description('Monitor RTSP stream for dog barking')
    .argument('<rtsp-url>', 'RTSP stream URL')
    .action(async (rtspUrl) => {
      console.log('🎥 Starting RTSP stream monitoring...')

      const db = initDatabase()
      const detector = new BarkDetector()
      await detector.initModel()

      const processor = new RTSPProcessor(rtspUrl, detector, db)

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n📊 Stopping stream monitoring...')
        processor.stop()
        db.close()
        process.exit(0)
      })

      await processor.start()
    })

  program
    .command('file')
    .description('Process a video/audio file for dog barking')
    .argument('<file-path>', 'Path to video or audio file')
    .action(async (filePath) => {
      if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath)
        process.exit(1)
      }

      console.log('🎵 Processing file...')

      const db = initDatabase()
      const detector = new BarkDetector()
      await detector.initModel()

      const processor = new FileProcessor(filePath, detector, db)

      try {
        await processor.process()
        console.log('✅ File processing complete!')

        // Export results
        await exportResults(db, 'txt')
      } catch (error) {
        console.error('❌ Error processing file:', error.message)
      } finally {
        db.close()
      }
    })

  program
    .command('export')
    .description('Export detection results')
    .option('-f, --format <format>', 'Export format (txt, json)', 'txt')
    .action(async (options) => {
      const db = initDatabase()

      try {
        await exportResults(db, options.format)
      } catch (error) {
        console.error('❌ Error exporting results:', error.message)
      } finally {
        db.close()
      }
    })

  program
    .command('stats')
    .description('Show detection statistics')
    .action(async () => {
      const db = initDatabase()

      db.all(
        `
                SELECT 
                    COUNT(*) as total_detections,
                    AVG(confidence) as avg_confidence,
                    source,
                    DATE(created_at) as date,
                    COUNT(*) as daily_count
                FROM detections 
                GROUP BY source, DATE(created_at)
                ORDER BY created_at DESC
            `,
        [],
        (err, rows) => {
          if (err) {
            console.error('❌ Error getting stats:', err.message)
          } else {
            console.log('\n📊 Detection Statistics:')
            console.log('========================')

            rows.forEach((row) => {
              console.log(
                `${row.date} - ${row.source}: ${
                  row.daily_count
                } detections (avg confidence: ${(
                  row.avg_confidence * 100
                ).toFixed(1)}%)`
              )
            })
          }

          db.close()
        }
      )
    })

  await program.parseAsync()
}

// Run the application
if (require.main === module) {
  main().catch(console.error)
}

module.exports = {
  BarkDetector,
  RTSPProcessor,
  FileProcessor,
  AudioAnalyzer,
}
