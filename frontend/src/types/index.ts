export interface EEGData { channels: string[]; sample_rate: number; data: Record<string, number[]>; time: number[]; duration: number; }
export interface BandPower {
  // 缺失（该频段无有效数据）时为 null，区别于真实的零值
  delta: number | null;
  theta: number | null;
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
}
export interface BrainState {
  focus: number;
  relaxation: number;
  fatigue: number;
  status: 'focused' | 'relaxed' | 'fatigued' | 'neutral';
  statusLabel: string;
  statusColor: string;
  timestamp: number;
}
export interface ChannelCorrelation {
  channel: string;
  targetChannel: string;
  correlation: number;
  coherence: number;
}
export interface CorrelationData {
  targetChannel: string;
  correlations: ChannelCorrelation[];
}

export interface RecordingFrame {
  relativeTime: number;
  eeg: EEGData;
  bands: BandPower;
  brainState: BrainState;
  correlation: CorrelationData;
}

export interface Recording {
  id: string;
  name: string;
  channel: string;
  startTime: number;
  endTime: number;
  duration: number;
  frames: RecordingFrame[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  currentFrame: RecordingFrame | null;
}

// 实时数据加载状态：加载中 / 成功 / 请求失败 / 通道无数据
export type LiveStatus = 'loading' | 'success' | 'error' | 'no_data';
