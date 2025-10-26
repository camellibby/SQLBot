// 前端浏览器的录音器，兼容 AudioWorklet/ScriptProcessor 双方案
export type ArrayBufferType = 'short16' | 'float32'

export interface RecorderOptions {
  sampleRate?: number
  frameSize?: number
  arrayBufferType?: ArrayBufferType
}

export type OnStart = () => void
export type OnStop = (audioBuffers: ArrayBuffer[]) => void
export type OnFrameRecorded = (data: { isLastFrame: boolean; frameBuffer: ArrayBuffer }) => void

export default class RecorderManager {
  processorPath: string
  audioContext?: AudioContext
  audioWorklet?: AudioWorkletNode | { port: Worker & { postMessage: (msg: any) => void } }
  audioTracks?: MediaStreamTrack[]
  audioBuffers: ArrayBuffer[] = []
  onStart?: OnStart
  onStop?: OnStop
  onFrameRecorded?: OnFrameRecorded

  constructor(processorPath: string) {
    this.processorPath = processorPath
  }

  async start(options: RecorderOptions = {}) {
    this.audioBuffers = []
    const stream = await this.getMediaStream()
    this.audioTracks = stream.getAudioTracks()
    const { sampleRate = 16000, frameSize = 1280, arrayBufferType = 'short16' } = options
    this.audioContext = this.createAudioContext(sampleRate)
    const sourceNode = this.audioContext.createMediaStreamSource(stream)

    // 优先用 AudioWorklet 支持，否则降级 worker + ScriptProcessor
    try {
      if ('audioWorklet' in this.audioContext && window.AudioWorkletNode) {
        await this.audioContext.audioWorklet.addModule(`${this.processorPath}/processor.worklet.js`)
        const workletNode = new AudioWorkletNode(this.audioContext, 'processor-worklet')
        this.audioWorklet = workletNode
        workletNode.port.onmessage = (event) => {
          // 消息分发
          const data = event.data
          if (this.onFrameRecorded && typeof this.onFrameRecorded === 'function') {
            this.onFrameRecorded(data)
          }
          // 内部累积 buffer
          if (data.frameBuffer) this.audioBuffers.push(data.frameBuffer)
          if (data.isLastFrame && typeof this.onStop === 'function') {
            this.onStop(this.audioBuffers)
          }
        }
        // 首帧初始化
        workletNode.port.postMessage({
          type: 'init',
          data: {
            frameSize,
            toSampleRate: sampleRate,
            fromSampleRate: this.audioContext.sampleRate,
            arrayBufferType,
          },
        })
        sourceNode.connect(workletNode)
        workletNode.connect(this.audioContext.destination)
      } else {
        // 兼容模式: 用 WebWorker + ScriptProcessor
        const worker = new Worker(`${this.processorPath}/processor.worker.js`)
        this.audioWorklet = { port: worker as any }
        worker.postMessage({
          type: 'init',
          data: {
            frameSize,
            toSampleRate: sampleRate,
            fromSampleRate: this.audioContext.sampleRate,
            arrayBufferType,
          },
        })
        worker.onmessage = (event) => {
          const data = event.data
          if (this.onFrameRecorded && typeof this.onFrameRecorded === 'function') {
            this.onFrameRecorded(data)
          }
          // 累积 buffer
          if (data.frameBuffer) this.audioBuffers.push(data.frameBuffer)
          if (data.isLastFrame && typeof this.onStop === 'function') {
            this.onStop(this.audioBuffers)
          }
        }
        const processor = this.audioContext.createScriptProcessor(0, 1, 1)
        processor.onaudioprocess = (e) => {
          worker.postMessage({ type: 'message', data: e.inputBuffer.getChannelData(0) })
        }
        sourceNode.connect(processor)
        processor.connect(this.audioContext.destination)
      }
      await this.audioContext.resume()
      this.onStart?.()
    } catch (err) {
      if (this.audioContext) this.audioContext.close()
      throw err
    }
  }

  stop() {
    if (this.audioWorklet) {
      // 兼容 AudioWorkletNode/Worker
      if ('port' in this.audioWorklet && typeof this.audioWorklet.port.postMessage === 'function') {
        this.audioWorklet.port.postMessage({ type: 'stop' })
      }
      // worklet 不需要调用terminate，交给业务；worker不主动关闭可重复录制
    }
    if (this.audioTracks && this.audioTracks.length > 0) {
      this.audioTracks[0].stop()
    }
    if (this.audioContext) {
      this.audioContext.suspend()
    }
  }

  private getMediaStream(): Promise<MediaStream> {
    if (navigator.mediaDevices?.getUserMedia) {
      return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    }
    // @ts-expect-error: For legacy browsers, TS does not type getUserMedia on Navigator
    if (navigator.getUserMedia) {
      return new Promise((resolve, reject) =>
        // @ts-expect-error: getUserMedia legacy callback style not in TS lib
        navigator.getUserMedia({ audio: true, video: false }, resolve, reject)
      )
    }
    return Promise.reject(new Error('不支持录音'))
  }

  private createAudioContext(sampleRate: number): AudioContext {
    try {
      // @ts-expect-error: webkitAudioContext for old Safari
      return new (window.AudioContext || window.webkitAudioContext)({ sampleRate })
    } catch {
      // @ts-expect-error: webkitAudioContext fallback no sampleRate arg
      return new (window.AudioContext || window.webkitAudioContext)()
    }
  }
}
