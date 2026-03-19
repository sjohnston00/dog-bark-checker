import tf from '@tensorflow/tfjs-node'

// YAMNet-based bark detector (Google's pre-trained audio classifier)
export default class YAMNetBarkDetector {
  model: tf.GraphModel | null
  sampleRate: number
  windowSize: number
  yamnetClasses: null
  barkClassIndices: number[]

  private PERCENTAGE_THRESHOLD: number = 0.3

  constructor() {
    this.model = null
    this.sampleRate = 16_000 // YAMNet requires 16kHz
    this.windowSize = 16_000 // ~0.975 seconds for YAMNet
    this.yamnetClasses = null
    this.barkClassIndices = []

    // Load YAMNet class labels
    this.loadYAMNetClasses()
  }

  /**
   * Refer to https://github.com/tensorflow/models/blob/master/research/audioset/yamnet/yamnet_class_map.csv for full class list
   */
  private async loadYAMNetClasses() {
    // YAMNet AudioSet class labels - these are the indices for dog-related sounds
    this.barkClassIndices = [
      69, //Dog
      70, // Bark
      // 74, // Animal sounds
      // 368, // Dog whimpering
      // 380, // Dog howling
      // 382, // Dog whining
      // 85 // Bow-wow
    ]

    console.log('YAMNet class indices loaded for dog sounds')
  }

  public async initModel() {
    console.log('Loading YAMNet model from TensorFlow Hub...')

    try {
      // Load YAMNet from TensorFlow Hub
      this.model = await tf.loadGraphModel(
        // 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1'
        'https://www.kaggle.com/models/google/yamnet/TfJs/tfjs/1',
        {
          fromTFHub: true,
        }
      )
      console.log('✅ YAMNet model loaded successfully')
      return true
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.warn(
          '❌ Failed to load YAMNet from TensorFlow Hub:',
          error.message
        )
      } else {
        console.warn(error)
      }
      console.log('🔄 Falling back to local model or heuristic detection...')
      return false
    }
  }

  // Pre-process audio for YAMNet (requires specific format)
  private preprocessAudio(audioBuffer: Buffer[]) {
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

  public async detectBark(audioBuffer: Buffer[], timestamp: Date) {
    if (!this.model) {
      throw new Error('Must initialise model through initModel function first')
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

      let maxBarkScore = 0
      let detectedClass: number = -1
      for (const classIndex of this.barkClassIndices) {
        if (classIndex < scores.length && scores[classIndex] > maxBarkScore) {
          maxBarkScore = scores[classIndex]
          detectedClass = classIndex
        }
      }

      // Clean up input tensor
      audioTensor.dispose()

      const isBark = scores[detectedClass] > this.PERCENTAGE_THRESHOLD
      const confidence = scores[detectedClass]

      return {
        isBark,
        confidence,
        timestamp,
        modelUsed: 'YAMNet',
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('YAMNet inference failed:', error.message)
      } else {
        console.error(error)
      }
    }
  }
}
