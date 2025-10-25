declare module '/voice/index.esm.js' {
  export default class RecorderManager {
    constructor(processorPath: string);
    start(options: {
      sampleRate?: number;
      frameSize?: number;
      arrayBufferType?: 'short16' | 'float32';
    }): Promise<void>;
    stop(): void;
    onStart?: () => void;
    onStop?: (audioBuffers: ArrayBuffer[]) => void;
    onFrameRecorded?: (data: { isLastFrame: boolean; frameBuffer: ArrayBuffer }) => void;
  }
}
