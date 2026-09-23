import { BandPower } from '../types';

export const BAND_KEYS = ['delta', 'theta', 'alpha', 'beta', 'gamma'] as const;
export type BandKey = typeof BAND_KEYS[number];

export const BAND_LABELS: Record<BandKey, string> = {
  delta: 'Delta',
  theta: 'Theta',
  alpha: 'Alpha',
  beta: 'Beta',
  gamma: 'Gamma',
};

export const BAND_COLORS: Record<BandKey, string> = {
  delta: '#1565c0',
  theta: '#2e7d32',
  alpha: '#f9a825',
  beta: '#e53935',
  gamma: '#6a1b9a',
};

export const CHANNEL_NAMES: Record<string, string> = {
  Fp1: '左前额', Fp2: '右前额', F3: '左额', F4: '右额',
  C3: '左中央', C4: '右中央', P3: '左顶', P4: '右顶',
  O1: '左枕', O2: '右枕',
};

export const channelDisplayName = (channel: string) => CHANNEL_NAMES[channel] || channel;

/**
 * 将任意来源（后端、历史录制、mock）的频段结果归一化：
 * 非有限值（undefined / NaN / Infinity / 空串）一律视为"缺失"（null），
 * 绝不回退成 0，避免缺数据被画成零值柱。
 */
export const normalizeBandPower = (raw: unknown): BandPower => {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const toValue = (v: unknown): number | null => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    return v;
  };
  return {
    delta: toValue(obj.delta),
    theta: toValue(obj.theta),
    alpha: toValue(obj.alpha),
    beta: toValue(obj.beta),
    gamma: toValue(obj.gamma),
  };
};

export const isBandPowerEmpty = (bands: BandPower | null): boolean =>
  !bands || BAND_KEYS.every(k => bands[k] === null);

/** 缺失频段展示为 "无数据"，有值才做数值格式化 */
export const formatBandValue = (v: number | null, digits = 2): string =>
  v === null ? '无数据' : v.toFixed(digits);
