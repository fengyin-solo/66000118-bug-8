import { create } from 'zustand';
import { EEGData, BandPower, BrainState, CorrelationData, Recording, RecordingFrame, PlaybackState, LiveStatus } from '../types';
import { normalizeBandPower, isBandPowerEmpty } from '../utils/eeg';

const STORAGE_KEY = 'eeg_recordings';

const loadRecordings = (): Recording[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecordings = (recordings: Recording[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
  } catch {}
};

interface EEGState {
  eegData: EEGData | null;
  selectedChannel: string;
  bandPower: BandPower | null;
  isStreaming: boolean;
  brainState: BrainState | null;
  correlationData: CorrelationData | null;
  isRecording: boolean;
  recordingStartTime: number;
  currentRecordingFrames: RecordingFrame[];
  recordings: Recording[];
  playbackMode: boolean;
  activeRecording: Recording | null;
  playbackState: PlaybackState;
  // 实时数据通道与加载状态，确保标题/图例/柱形始终属于同一通道
  liveChannel: string;
  liveStatus: LiveStatus;
  liveError: string | null;
  // 每次发起实时请求自增，用于丢弃过期响应（快速切换通道/进入回放时）
  liveFetchSeq: number;
  setChannel: (c: string) => void;
  setStreaming: (v: boolean) => void;
  beginLiveFetch: (channel: string) => void;
  applyLiveSample: (channel: string, seq: number, sample: {
    eeg: EEGData; bands: unknown; brainState: BrainState; correlation: CorrelationData;
  }) => void;
  failLiveFetch: (channel: string, seq: number, message: string) => void;
  retryLiveFetch: () => void;
  setBrainState: (s: BrainState | null) => void;
  setCorrelationData: (c: CorrelationData | null) => void;
  startRecording: () => void;
  stopRecording: (name: string) => void;
  addRecordingFrame: (eeg: EEGData, bands: BandPower, brainState: BrainState, correlation: CorrelationData) => void;
  deleteRecording: (id: string) => void;
  enterPlaybackMode: (recording: Recording) => void;
  exitPlaybackMode: () => void;
  setPlaybackTime: (time: number) => void;
  togglePlayback: () => void;
  setPlaybackPlaying: (playing: boolean) => void;
}

export const useEEGStore = create<EEGState>((set, get) => ({
  eegData: null,
  selectedChannel: 'Fp1',
  bandPower: null,
  isStreaming: false,
  brainState: null,
  correlationData: null,
  isRecording: false,
  recordingStartTime: 0,
  currentRecordingFrames: [],
  recordings: loadRecordings(),
  playbackMode: false,
  activeRecording: null,
  playbackState: {
    isPlaying: false,
    currentTime: 0,
    currentFrame: null,
  },
  liveChannel: 'Fp1',
  liveStatus: 'loading',
  liveError: null,
  liveFetchSeq: 0,

  // 切换实时通道：立即清空上一通道的全部结果，杜绝"新标题 + 旧柱形"的残留与错位
  setChannel: (c) => {
    if (get().playbackMode) return; // 回放中通道由录制决定，禁止串改
    if (get().selectedChannel === c) return;
    set({
      selectedChannel: c,
      eegData: null,
      bandPower: null,
      brainState: null,
      correlationData: null,
      liveChannel: c,
      liveStatus: 'loading',
      liveError: null,
      liveFetchSeq: get().liveFetchSeq + 1,
    });
  },

  setStreaming: (v) => set({ isStreaming: v }),

  // 周期性刷新开始：标记加载中，但不清空已展示的成功数据（避免图表每 3 秒闪烁）。
  // 不自增 liveFetchSeq —— 只有切通道/重试/进出回放才递增并触发立即重新拉取。
  beginLiveFetch: (channel) => set({
    liveChannel: channel,
    liveStatus: 'loading',
    liveError: null,
  }),

  applyLiveSample: (channel, seq, sample) => {
    const state = get();
    // 过期响应丢弃：通道已切换、已进入回放或有更新的请求时，旧响应不得写入
    if (state.playbackMode || state.selectedChannel !== channel || seq !== state.liveFetchSeq) return;
    const bands = normalizeBandPower(sample.bands);
    set({
      liveChannel: channel,
      liveStatus: isBandPowerEmpty(bands) ? 'no_data' : 'success',
      liveError: null,
      eegData: sample.eeg,
      bandPower: bands,
      brainState: sample.brainState,
      correlationData: sample.correlation,
    });
  },

  failLiveFetch: (channel, seq, message) => {
    const state = get();
    if (state.playbackMode || state.selectedChannel !== channel || seq !== state.liveFetchSeq) return;
    // 请求失败：清空旧结果并记录失败状态，等待重试
    set({
      liveChannel: channel,
      liveStatus: 'error',
      liveError: message,
      eegData: null,
      bandPower: null,
      brainState: null,
      correlationData: null,
    });
  },

  retryLiveFetch: () => {
    const { selectedChannel, playbackMode } = get();
    if (playbackMode) return;
    set({
      liveChannel: selectedChannel,
      liveStatus: 'loading',
      liveError: null,
      eegData: null,
      bandPower: null,
      brainState: null,
      correlationData: null,
      liveFetchSeq: get().liveFetchSeq + 1, // 通知轮询组件立即重新拉取
    });
  },

  setBrainState: (s) => set({ brainState: s }),
  setCorrelationData: (c) => set({ correlationData: c }),

  startRecording: () => {
    set({
      isRecording: true,
      recordingStartTime: Date.now(),
      currentRecordingFrames: [],
      playbackMode: false,
      activeRecording: null,
    });
  },
  stopRecording: (name: string) => {
    const { currentRecordingFrames, recordingStartTime, selectedChannel } = get();
    if (currentRecordingFrames.length === 0) {
      set({ isRecording: false, currentRecordingFrames: [] });
      return;
    }
    const endTime = Date.now();
    const duration = (endTime - recordingStartTime) / 1000;
    const newRecording: Recording = {
      id: `rec_${endTime}`,
      name: name || `录制 ${new Date(recordingStartTime).toLocaleString()}`,
      channel: selectedChannel,
      startTime: recordingStartTime,
      endTime,
      duration,
      frames: currentRecordingFrames,
    };
    const recordings = [...get().recordings, newRecording];
    saveRecordings(recordings);
    set({
      isRecording: false,
      recordingStartTime: 0,
      currentRecordingFrames: [],
      recordings,
    });
  },
  addRecordingFrame: (eeg, bands, brainState, correlation) => {
    const { isRecording, recordingStartTime, currentRecordingFrames } = get();
    if (!isRecording) return;
    const relativeTime = (Date.now() - recordingStartTime) / 1000;
    const frame: RecordingFrame = {
      relativeTime,
      eeg,
      bands: normalizeBandPower(bands),
      brainState,
      correlation,
    };
    set({ currentRecordingFrames: [...currentRecordingFrames, frame] });
  },
  deleteRecording: (id) => {
    const recordings = get().recordings.filter(r => r.id !== id);
    saveRecordings(recordings);
    const { activeRecording } = get();
    if (activeRecording?.id === id) {
      set({
        recordings,
        playbackMode: false,
        activeRecording: null,
        playbackState: { isPlaying: false, currentTime: 0, currentFrame: null },
      });
    } else {
      set({ recordings });
    }
  },

  // 进入回放：通道与录制保持同一通道，面板（标题/图例/柱形）只展示该录制的数据
  enterPlaybackMode: (recording) => {
    if (recording.frames.length === 0) return;
    const firstFrame = recording.frames[0];
    set({
      playbackMode: true,
      activeRecording: recording,
      selectedChannel: recording.channel,
      playbackState: {
        isPlaying: false,
        currentTime: firstFrame.relativeTime,
        currentFrame: firstFrame,
      },
      eegData: firstFrame.eeg,
      bandPower: normalizeBandPower(firstFrame.bands),
      brainState: firstFrame.brainState,
      correlationData: firstFrame.correlation,
      liveStatus: 'loading',
      liveError: null,
      liveFetchSeq: get().liveFetchSeq + 1, // 作废所有在途实时请求
    });
  },

  // 退出回放（返回历史回放列表）：保持同一通道，清空回放结果后重新拉取该通道实时数据
  exitPlaybackMode: () => {
    const channel = get().activeRecording?.channel ?? get().selectedChannel;
    set({
      playbackMode: false,
      activeRecording: null,
      selectedChannel: channel,
      playbackState: {
        isPlaying: false,
        currentTime: 0,
        currentFrame: null,
      },
      eegData: null,
      bandPower: null,
      brainState: null,
      correlationData: null,
      liveChannel: channel,
      liveStatus: 'loading',
      liveError: null,
      liveFetchSeq: get().liveFetchSeq + 1,
    });
  },

  setPlaybackTime: (time) => {
    const { activeRecording } = get();
    if (!activeRecording || activeRecording.frames.length === 0) return;
    const frames = activeRecording.frames;
    let frameIndex = 0;
    for (let i = 0; i < frames.length; i++) {
      if (frames[i].relativeTime <= time) {
        frameIndex = i;
      } else {
        break;
      }
    }
    const frame = frames[frameIndex];
    // 整帧替换并归一化缺失频段；缺失帧显示缺失标记，不允许保留上一帧柱形
    set({
      playbackState: {
        ...get().playbackState,
        currentTime: time,
        currentFrame: frame,
      },
      eegData: frame.eeg,
      bandPower: normalizeBandPower(frame.bands),
      brainState: frame.brainState,
      correlationData: frame.correlation,
    });
  },
  togglePlayback: () => {
    const { playbackState } = get();
    set({
      playbackState: {
        ...playbackState,
        isPlaying: !playbackState.isPlaying,
      },
    });
  },
  setPlaybackPlaying: (playing) => {
    set({
      playbackState: {
        ...get().playbackState,
        isPlaying: playing,
      },
    });
  },
}));
