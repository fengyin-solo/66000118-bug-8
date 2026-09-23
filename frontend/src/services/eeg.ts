import axios from 'axios';
import { useEEGStore } from '../store/eeg';
import { BandName, BandPower, BrainState, CorrelationData, EEGData } from '../types';

const BAND_NAMES: BandName[] = ['delta', 'theta', 'alpha', 'beta', 'gamma'];
let requestSequence = 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const normalizeBands = (value: unknown): BandPower => {
  if (!isRecord(value)) throw new Error('频段数据格式无效');
  return BAND_NAMES.reduce<BandPower>((result, name) => {
    result[name] = asFiniteNumber(value[name]);
    return result;
  }, { delta: null, theta: null, alpha: null, beta: null, gamma: null });
};

const normalizeEEG = (value: unknown, channel: string): EEGData => {
  if (!isRecord(value) || !Array.isArray(value.channels) || !isRecord(value.data) || !Array.isArray(value.time)) {
    throw new Error('波形数据格式无效');
  }
  const channelData = value.data[channel];
  if (!Array.isArray(channelData) || channelData.length === 0) {
    throw new Error(`${channel} 通道没有可用波形数据`);
  }
  return value as unknown as EEGData;
};

const normalizeBrainState = (value: unknown): BrainState => {
  if (!isRecord(value) || typeof value.statusLabel !== 'string') {
    throw new Error('脑状态数据格式无效');
  }
  if (!['focused', 'relaxed', 'fatigued', 'neutral'].includes(value.status as string)) {
    throw new Error('脑状态数据格式无效');
  }
  if (!['focus', 'relaxation', 'fatigue'].every(key => asFiniteNumber(value[key]) !== null)) {
    throw new Error('脑状态数据格式无效');
  }
  return value as unknown as BrainState;
};

const normalizeCorrelation = (value: unknown, channel: string): CorrelationData => {
  if (!isRecord(value) || value.targetChannel !== channel || !Array.isArray(value.correlations)) {
    throw new Error('通道相关分析数据格式无效');
  }
  const valid = value.correlations.every(item =>
    isRecord(item) &&
    typeof item.channel === 'string' &&
    item.targetChannel === channel &&
    (item.correlation === null || typeof item.correlation === 'number') &&
    (item.coherence === null || typeof item.coherence === 'number')
  );
  if (!valid) throw new Error('通道相关分析数据格式无效');
  return value as unknown as CorrelationData;
};

const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data;
    const detail = isRecord(payload)
      ? (typeof payload.error === 'string' ? payload.error : payload.detail)
      : null;
    if (typeof detail === 'string' && detail) return detail;
    return error.message || '数据计算失败，请重试';
  }
  return error instanceof Error ? error.message : '数据计算失败，请重试';
};

export const refreshLiveSample = async (): Promise<void> => {
  const state = useEEGStore.getState();
  if (state.playbackMode) return;

  const channel = state.selectedChannel;
  const requestId = ++requestSequence;
  state.setLiveSampleLoading();

  try {
    const { data } = await axios.get(`/api/eeg/sample/${encodeURIComponent(channel)}?duration=3`);
    if (!isRecord(data)) throw new Error('服务响应格式无效');

    const eeg = normalizeEEG(data.eeg, channel);
    const bands = normalizeBands(data.bands);
    const brainState = normalizeBrainState(data.brainState);
    const correlation = normalizeCorrelation(data.correlation, channel);
    const latest = useEEGStore.getState();

    if (requestId !== requestSequence || latest.playbackMode || latest.selectedChannel !== channel) return;
    latest.setLiveSample(channel, eeg, bands, brainState, correlation);
  } catch (error) {
    const latest = useEEGStore.getState();
    if (requestId !== requestSequence || latest.playbackMode || latest.selectedChannel !== channel) return;
    latest.setLiveSampleError(getErrorMessage(error));
  }
};
