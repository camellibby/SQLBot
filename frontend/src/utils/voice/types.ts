export interface RecorderOptions {
  sampleRate?: number;
  frameSize?: number;
  arrayBufferType?: 'short16' | 'float32';
}

export interface FrameRecordedData {
  isLastFrame: boolean;
  frameBuffer: ArrayBuffer;
}

export interface RecorderManagerConstructor {
  new (processorPath: string): RecorderManager;
}

export interface RecorderManager {
  start(options: RecorderOptions): Promise<void>;
  stop(): void;
  onStart?: () => void;
  onStop?: (audioBuffers: ArrayBuffer[]) => void;
  onFrameRecorded?: (data: FrameRecordedData) => void;
}
