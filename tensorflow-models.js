#!/usr/bin/env node

// Enhanced bark detector with TensorFlow.js models
const tf = require('@tensorflow/tfjs-node')

// YAMNet-based bark detector (Google's pre-trained audio classifier)
class YAMNetBarkDetector {
  constructor() {
    this.model = null
    this.sampleRate = 16000 // YAMNet requires 16kHz
    this.windowSize = 16000 // ~0.975 seconds for YAMNet
    this.yamnetClasses = null
    this.barkClassIndices = []

    // Load YAMNet class labels
    this.loadYAMNetClasses()
  }

  /**
   * Refer to https://github.com/tensorflow/models/blob/master/research/audioset/yamnet/yamnet_class_map.csv for full class list
   */
  async loadYAMNetClasses() {
    // YAMNet AudioSet class labels - these are the indices for dog-related sounds
    this.barkClassIndices = [
      83 // Dog barking
      // 74, // Animal sounds
      // 368, // Dog whimpering
      // 380, // Dog howling
      // 382, // Dog whining
      // 85 // Bow-wow
    ]

    console.log('YAMNet class indices loaded for dog sounds')
  }

  async initModel() {
    console.log('Loading YAMNet model from TensorFlow Hub...')

    try {
      // Load YAMNet from TensorFlow Hub
      this.model = await tf.loadGraphModel(
        // 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1'
        'https://www.kaggle.com/models/google/yamnet/TfJs/tfjs/1',
        {
          fromTFHub: true
        }
      )
      console.log('✅ YAMNet model loaded successfully')
      return true
    } catch (error) {
      console.warn(
        '❌ Failed to load YAMNet from TensorFlow Hub:',
        error.message
      )
      console.log('🔄 Falling back to local model or heuristic detection...')
      return false
    }
  }

  // Pre-process audio for YAMNet (requires specific format)
  preprocessAudio(audioBuffer) {
    // YAMNet expects 16kHz audio, pad or truncate to correct length
    let processedAudio = Float32Array.from(audioBuffer)

    if (processedAudio.length < this.windowSize) {
      // Pad with zeros if too short
      const padded = new Float32Array(this.windowSize)
      padded.set(processedAudio)
      processedAudio = padded
    } else if (processedAudio.length > this.windowSize) {
      // Truncate if too long
      processedAudio = processedAudio.slice(0, this.windowSize)
    }

    // Convert to tensor and add batch dimension
    // return tf.tensor(processedAudio).expandDims(0)
    return tf.tensor1d(processedAudio)
  }

  async detectBark(audioBuffer, timestamp, timeOffset = 0) {
    if (!this.model) {
      // Fallback to heuristic detection
      return this.heuristicDetection(audioBuffer, timestamp)
    }

    try {
      // Preprocess audio for YAMNet
      const audioTensor = this.preprocessAudio(audioBuffer)

      // YAMNet expects the input as a dictionary with 'waveform' key
      const predictions = this.model.execute({ waveform: audioTensor })

      // YAMNet returns [scores, embeddings, spectrogram]
      // We want the scores (first output)
      let scores
      if (Array.isArray(predictions)) {
        scores = await predictions[0].data() // Get scores tensor
        // Clean up all prediction tensors
        predictions.forEach((tensor) => tensor.dispose())
      } else {
        scores = await predictions.data()
        predictions.dispose()
      }

      const YAMNET_DOG_CLASS_INDEX = 69 // Index for "Dog" class in YAMNet

      // console.log(
      //   `${timeOffset.toFixed(1)}s`,
      //   'scores - Dog [69]: ',
      //   scores[69],
      //   'Bark [70]: ',
      //   scores[70],
      //   'Whimper (Dog) [75]: ',
      //   scores[75],
      //   'Howl [72]:',
      //   scores[72]
      // )

      // for (const classIndex of this.barkClassIndices) {
      //   if (classIndex < scores.length && scores[classIndex] > maxBarkScore) {
      //     maxBarkScore = scores[classIndex]
      //     detectedClass = classIndex
      //   }
      // }

      // Clean up input tensor
      audioTensor.dispose()

      const isBark = scores[YAMNET_DOG_CLASS_INDEX] > 0.3 // Threshold for detection
      const confidence = scores[YAMNET_DOG_CLASS_INDEX]

      return {
        isBark,
        confidence,
        timestamp,
        modelUsed: 'YAMNet'
      }
    } catch (error) {
      console.warn('YAMNet inference failed:', error.message)
      return this.heuristicDetection(audioBuffer, timestamp)
    }
  }

  // Fallback heuristic detection (from previous implementation)
  heuristicDetection(audioBuffer, timestamp) {
    const features = this.extractSimpleFeatures(audioBuffer)
    const confidence = this.calculateBarkProbability(features)
    const isBark = confidence > 0.7

    return {
      isBark,
      confidence,
      timestamp,
      modelUsed: 'Heuristic',
      features
    }
  }

  extractSimpleFeatures(audioBuffer) {
    // Simple feature extraction for fallback
    let rms = 0
    let zcr = 0

    // Calculate RMS
    for (let i = 0; i < audioBuffer.length; i++) {
      rms += audioBuffer[i] * audioBuffer[i]
    }
    rms = Math.sqrt(rms / audioBuffer.length)

    // Calculate zero crossing rate
    for (let i = 1; i < audioBuffer.length; i++) {
      if (audioBuffer[i] >= 0 !== audioBuffer[i - 1] >= 0) {
        zcr++
      }
    }
    zcr = zcr / (2 * audioBuffer.length)

    return { rms, zcr }
  }

  calculateBarkProbability(features) {
    // Simple scoring based on typical bark characteristics
    let score = 0

    if (features.rms > 0.01 && features.rms < 0.5) score += 0.4
    if (features.zcr > 0.05 && features.zcr < 0.3) score += 0.3

    return Math.min(score + 0.3, 1.0) // Base score + feature scores
  }
}

module.exports = {
  YAMNetBarkDetector
}
