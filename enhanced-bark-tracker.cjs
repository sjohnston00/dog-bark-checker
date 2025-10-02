#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const sqlite3 = require('sqlite3').verbose()
const { Command } = require('commander')
const tf = require('@tensorflow/tfjs-node')
const wav = require('wav')
const { createReadStream, createWriteStream } = require('fs')

// Import our enhanced detectors
const { YAMNetBarkDetector } = require('./tensorflow-models.cjs')

// Initialize database (same as before)
function initDatabase() {
  const db = new sqlite3.Database('bark_detections.db')

  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS detections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            confidence REAL NOT NULL,
            duration REAL,
            source TEXT NOT NULL,
            model_used TEXT,
            audio_features TEXT,
            ensemble_info TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)
  })

  return db
}

// Enhanced RTSP processor with TensorFlow models
class EnhancedRTSPProcessor {
  constructor(rtspUrl, detector, db) {
    this.rtspUrl = rtspUrl
    this.detector = detector
    this.db = db
    this.ffmpegProcess = null
    this.audioBuffer = []
    this.bufferSize = 16000 // YAMNet prefers 16kHz
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
      'pipe:1'
    ])

    let wavHeader = true
    let headerBuffer = Buffer.alloc(0)

    this.ffmpegProcess.stdout.on('data', (data) => {
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

    this.ffmpegProcess.stderr.on('data', (data) => {
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
    const samples = []
    for (let i = 0; i < data.length; i += 2) {
      const sample = data.readInt16LE(i) / 32768.0
      samples.push(sample)
    }

    this.audioBuffer.push(...samples)

    while (this.audioBuffer.length >= this.bufferSize) {
      const chunk = this.audioBuffer.splice(0, this.bufferSize)
      const timestamp = new Date().toISOString()

      this.processAudioChunk(chunk, timestamp)
    }
  }

  async processAudioChunk(chunk, timestamp) {
    try {
      const result = await this.detector.detectBark(chunk, timestamp)

      if (result.isBark) {
        this.detectionCount++
        this.saveBarkDetection(result, 'rtsp_stream')

        console.log(
          `🐕 Bark #${this.detectionCount} detected at ${new Date(
            timestamp
          ).toLocaleString()}`
        )
        console.log(
          `   Model: ${result.modelUsed} | Confidence: ${(
            result.confidence * 100
          ).toFixed(1)}%`
        )

        if (result.ensemble) {
          console.log(
            `   Ensemble: ${result.ensemble.allResults
              .map((r) => `${r.model}(${(r.confidence * 100).toFixed(1)}%)`)
              .join(', ')}`
          )
        }
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error.message)
    }
  }

  saveBarkDetection(result, source) {
    const stmt = this.db.prepare(`
            INSERT INTO detections (timestamp, confidence, source, model_used, audio_features, ensemble_info)
            VALUES (?, ?, ?, ?, ?, ?)
        `)

    stmt.run([
      result.timestamp,
      result.confidence,
      source,
      result.modelUsed || 'unknown',
      JSON.stringify(result.features || {}),
      JSON.stringify(result.ensemble || {})
    ])

    stmt.finalize()
  }

  stop() {
    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill()
    }
    console.log(`📊 Total detections: ${this.detectionCount}`)
  }
}

// Enhanced file processor
class EnhancedFileProcessor {
  constructor(filePath, detector, db) {
    this.filePath = filePath
    this.detector = detector
    this.db = db
    this.detectionCount = 0
  }

  async process() {
    console.log(`🎵 Processing file with enhanced ML models: ${this.filePath}`)

    const tempAudioPath = path.join(__dirname, 'temp_audio_ml.wav')

    // Extract audio optimized for ML models (16kHz for better compatibility)
    const ffmpegProcess = spawn('ffmpeg', [
      '-i',
      this.filePath,
      '-vn',
      '-acodec',
      'pcm_s16le',
      '-ar',
      '16000', // ML models prefer 16kHz
      '-ac',
      '1',
      '-threads',
      '0',
      '-preset',
      'ultrafast',
      '-y',
      tempAudioPath
    ])

    await new Promise((resolve, reject) => {
      ffmpegProcess.stderr.on('data', (data) => {
        const message = data.toString()
        if (message.includes('Error') && !message.includes('deprecated')) {
          console.error('FFmpeg error:', message)
        }
      })

      ffmpegProcess.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`FFmpeg failed with code ${code}`))
      })
    })

    await this.processAudioFileWithML(tempAudioPath)

    if (fs.existsSync(tempAudioPath)) {
      fs.unlinkSync(tempAudioPath)
    }
  }

  async processAudioFileWithML(audioPath) {
    const bufferSize = 16000 // 1 second at 16kHz for ML models
    const overlapSize = 4000 // 25% overlap
    let buffer = []
    let totalSamples = 0

    console.log('🤖 Starting ML-powered audio analysis...')
    const startTime = Date.now()

    return new Promise((resolve, reject) => {
      const reader = new wav.Reader()

      reader.on('format', (format) => {
        console.log(
          `Audio format: ${format.sampleRate}Hz, ${format.channels} channel(s)`
        )
      })

      reader.on('data', async (chunk) => {
        const samples = []
        for (let i = 0; i < chunk.length; i += 2) {
          samples.push(chunk.readInt16LE(i) / 32768.0)
        }

        buffer.push(...samples)
        totalSamples += samples.length

        let detectedBarkCount = 1

        while (buffer.length >= bufferSize) {
          detectedBarkCount++
          const audioChunk = buffer.slice(0, bufferSize)
          const timeOffset = (totalSamples - buffer.length) / 16000

          try {
            const result = await this.detector.detectBark(
              audioChunk,
              new Date().toISOString(),
              timeOffset
            )

            if (result.isBark) {
              this.detectionCount++
              this.saveBarkDetection(result, this.filePath, timeOffset)

              console.log(
                `🐕 Bark #${this.detectionCount} at ${timeOffset.toFixed(1)}s`
              )
              console.log(
                `   ${result.modelUsed}: ${(result.confidence * 100).toFixed(
                  1
                )}% confidence`
              )

              if (result.ensemble) {
                console.log(
                  `   Ensemble results: ${result.ensemble.allResults
                    .map(
                      (r) => `${r.model}(${(r.confidence * 100).toFixed(1)}%)`
                    )
                    .join(', ')}`
                )
              }
            }
          } catch (error) {
            console.error(`Error at ${timeOffset.toFixed(1)}s:`, error.message)
          }

          buffer.splice(0, bufferSize - overlapSize)
        }

        if (totalSamples % 160000 === 0) {
          // Every 10 seconds
          process.stdout.write('.')
        }
      })

      reader.on('end', async () => {
        if (buffer.length > overlapSize) {
          const timeOffset = totalSamples / 16000
          try {
            const result = await this.detector.detectBark(
              buffer,
              new Date().toISOString()
            )

            if (result.isBark) {
              this.detectionCount++
              this.saveBarkDetection(result, this.filePath, timeOffset)
              console.log(
                `🐕 Final bark at ${timeOffset.toFixed(1)}s (${
                  result.modelUsed
                })`
              )
            }
          } catch (error) {
            console.error('Error processing final chunk:', error.message)
          }
        }

        const processingTime = (Date.now() - startTime) / 1000
        const audioDuration = totalSamples / 16000

        console.log(
          `\n🎯 Analysis complete! ${this.detectionCount} barks detected`
        )
        console.log(
          `📊 Audio: ${audioDuration.toFixed(
            1
          )}s | Processing: ${processingTime.toFixed(1)}s`
        )
        console.log(
          `⚡ Speed: ${(audioDuration / processingTime).toFixed(1)}x real-time`
        )

        resolve()
      })

      reader.on('error', reject)

      createReadStream(audioPath).pipe(reader)
    })
  }

  saveBarkDetection(result, source, timeOffset = null) {
    const stmt = this.db.prepare(`
            INSERT INTO detections (timestamp, confidence, duration, source, model_used, audio_features, ensemble_info)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `)

    stmt.run([
      result.timestamp,
      result.confidence,
      timeOffset,
      source,
      result.modelUsed || 'unknown',
      JSON.stringify(result.features || {}),
      JSON.stringify(result.ensemble || {})
    ])

    stmt.finalize()
  }
}

// Enhanced CLI with model selection
async function main() {
  const program = new Command()

  program
    .name('enhanced-bark-tracker')
    .description('Advanced dog bark detection with TensorFlow.js models')
    .version('2.0.0')

  program
    .command('stream')
    .description('Monitor RTSP stream with ML models')
    .argument('<rtsp-url>', 'RTSP stream URL')
    .option('-m, --model <type>', 'Model type: yamnet', 'yamnet')
    .action(async (rtspUrl, options) => {
      console.log('🚀 Starting enhanced RTSP stream monitoring...')

      const db = initDatabase()
      const detector = await initializeDetector(options.model)

      const processor = new EnhancedRTSPProcessor(rtspUrl, detector, db)

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
    .description('Process file with ML models')
    .argument('<file-path>', 'Path to video or audio file')
    .option('-m, --model <type>', 'Model type: yamnet', 'yamnet')
    .action(async (filePath, options) => {
      if (!fs.existsSync(filePath)) {
        console.error('❌ File not found:', filePath)
        process.exit(1)
      }

      console.log('🤖 Processing with ML models...')

      const db = initDatabase()
      const detector = await initializeDetector(options.model)
      const processor = new EnhancedFileProcessor(filePath, detector, db)

      try {
        await processor.process()
        console.log('✅ File processing complete with ML models!')
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
    .option('-f, --format <format>', 'Export format (txt, json, csv)', 'txt')
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
    .description('Show enhanced detection statistics')
    .action(async () => {
      const db = initDatabase()

      db.all(
        `
                SELECT 
                    COUNT(*) as total_detections,
                    AVG(confidence) as avg_confidence,
                    model_used,
                    source,
                    DATE(created_at) as date,
                    COUNT(*) as daily_count
                FROM detections 
                GROUP BY model_used, source, DATE(created_at)
                ORDER BY created_at DESC
                LIMIT 20
            `,
        [],
        (err, rows) => {
          if (err) {
            console.error('❌ Error getting stats:', err.message)
          } else {
            console.log('\n📊 Enhanced Detection Statistics:')
            console.log('═'.repeat(80))

            const modelStats = {}
            rows.forEach((row) => {
              const model = row.model_used || 'unknown'
              if (!modelStats[model]) {
                modelStats[model] = { count: 0, avgConfidence: 0 }
              }
              modelStats[model].count += row.daily_count
              modelStats[model].avgConfidence = row.avg_confidence
            })

            console.log('Model Performance:')
            for (const [model, stats] of Object.entries(modelStats)) {
              console.log(
                `  ${model.toUpperCase()}: ${stats.count} detections (avg: ${(
                  stats.avgConfidence * 100
                ).toFixed(1)}%)`
              )
            }

            console.log('\nRecent Activity:')
            rows.slice(0, 10).forEach((row) => {
              console.log(
                `${row.date} | ${row.model_used || 'unknown'} | ${
                  row.source
                }: ${row.daily_count} detections`
              )
            })
          }

          db.close()
        }
      )
    })

  program
    .command('models')
    .description('List available models and their status')
    .action(async () => {
      console.log('🤖 Checking available models...\n')

      // Check YAMNet
      console.log('1. YAMNet (Google AudioSet):')
      try {
        const yamnet = new YAMNetBarkDetector()
        const loaded = await yamnet.initModel()
        console.log(
          `   Status: ${loaded ? '✅ Available' : '❌ Failed to load'}`
        )
        console.log(
          '   Description: Pre-trained on AudioSet, excellent for general audio classification'
        )
        console.log('   Best for: High accuracy, general bark detection')
      } catch (error) {
        console.log('   Status: ❌ Error loading')
        console.log(`   Error: ${error.message}`)
      }

      // Heuristic always available
      console.log('\n2. Heuristic Detection:')
      console.log('   Status: ✅ Always available')
      console.log('   Description: Rule-based detection using audio features')
      console.log('   Best for: Fast processing, no internet required')

      console.log('\n💡 Use --model flag to select: yamnet or heuristic')
    })

  await program.parseAsync()
}

// Initialize detector based on type
async function initializeDetector(modelType = 'yamnet') {
  console.log(`🔧 Initializing ${modelType} detector...`)

  switch (modelType.toLowerCase()) {
    case 'yamnet':
      const yamnet = new YAMNetBarkDetector()
      await yamnet.initModel()
      return yamnet

    case 'heuristic':
      const heuristic = new YAMNetBarkDetector()
      // Don't load ML model, will fall back to heuristic
      return heuristic

    default:
      const yamnetDef = new YAMNetBarkDetector()
      await yamnetDef.initModel()
      return yamnetDef
  }
}

// Enhanced export with model information
function exportResults(db, format = 'txt') {
  return new Promise((resolve, reject) => {
    const query = `
            SELECT timestamp, confidence, duration, source, model_used, ensemble_info, created_at
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
          .map((row) => {
            let line = `${row.created_at} - Bark detected (${(
              row.confidence * 100
            ).toFixed(1)}%) - ${row.model_used || 'unknown'}`
            line += ` - Source: ${row.source}`
            if (row.duration) line += ` at ${row.duration.toFixed(1)}s`
            return line
          })
          .join('\n')

        fs.writeFileSync('enhanced_bark_detections.txt', output)
        console.log('📄 Results exported to enhanced_bark_detections.txt')
      } else if (format === 'json') {
        const processedRows = rows.map((row) => ({
          ...row,
          ensemble_info: row.ensemble_info
            ? JSON.parse(row.ensemble_info)
            : null
        }))
        fs.writeFileSync(
          'enhanced_bark_detections.json',
          JSON.stringify(processedRows, null, 2)
        )
        console.log('📄 Results exported to enhanced_bark_detections.json')
      } else if (format === 'csv') {
        const csv = [
          'timestamp,confidence,duration,source,model_used,created_at'
        ]
          .concat(
            rows.map(
              (row) =>
                `${row.timestamp},${row.confidence},${row.duration || ''},${
                  row.source
                },${row.model_used || ''},${row.created_at}`
            )
          )
          .join('\n')

        fs.writeFileSync('enhanced_bark_detections.csv', csv)
        console.log('📄 Results exported to enhanced_bark_detections.csv')
      }

      resolve()
    })
  })
}

// Run the enhanced application
if (require.main === module) {
  main().catch(console.error)
}

module.exports = {
  EnhancedRTSPProcessor,
  EnhancedFileProcessor,
  initializeDetector,
  exportResults
}
