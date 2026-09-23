import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEEGStore } from '../store/eeg';
import { EEGData, BandPower, BrainState, CorrelationData } from '../types';
import { channelDisplayName } from '../utils/eeg';
import axios from 'axios';

export const WaveformChart: React.FC = () => {
  const {
    eegData, selectedChannel, playbackMode, isRecording, liveStatus,
  } = useEEGStore();
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (playbackMode) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const fetchEEG = async () => {
      const state = useEEGStore.getState();
      if (state.playbackMode || cancelled) return;
      const channel = state.selectedChannel;
      const seq = state.liveFetchSeq; // 复用当前上下文序号；上下文变化时 store 已递增
      state.beginLiveFetch(channel);
      setLoading(true);
      try {
        const { data } = await axios.get(`/api/eeg/sample/${channel}?duration=3`);
        if (cancelled || useEEGStore.getState().playbackMode) return;
        // 后端对未知通道返回 {error}，按"通道无数据"处理而非展示旧结果
        if (data && data.error) {
          useEEGStore.getState().failLiveFetch(channel, seq, `通道 ${channel} 无可用数据`);
          return;
        }
        const eeg = data.eeg as EEGData;
        const bands = data.bands as BandPower;
        const brainState = data.brainState as BrainState;
        const correlation = data.correlation as CorrelationData;
        if (!eeg || !eeg.data || !eeg.data[channel]) {
          useEEGStore.getState().failLiveFetch(channel, seq, `通道 ${channel} 无可用数据`);
          return;
        }
        useEEGStore.getState().applyLiveSample(channel, seq, {
          eeg, bands, brainState, correlation,
        });
        // 仅成功帧才录入录制，失败/缺数据帧不会污染历史，回放时也不会出现串帧
        if (useEEGStore.getState().isRecording) {
          useEEGStore.getState().addRecordingFrame(eeg, bands, brainState, correlation);
        }
      } catch {
        if (cancelled || useEEGStore.getState().playbackMode) return;
        useEEGStore.getState().failLiveFetch(channel, seq, '数据获取失败，请重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchEEG();
    intervalRef.current = window.setInterval(fetchEEG, 3000);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedChannel, playbackMode, useEEGStore(s => s.liveFetchSeq)]);

  const chartData = eegData?.data[selectedChannel]?.map((v: number, i: number) => ({
    t: eegData.time[i]?.toFixed(3), value: v.toFixed(4)
  })) || [];

  const channelName = channelDisplayName(selectedChannel);

  return (
    <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>📈</span>
        <span>{selectedChannel}</span>
        <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>{channelName} · 波形图</span>
        {isRecording && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#d32f2f', fontWeight: 500 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d32f2f', animation: 'pulse 1s infinite' }} />
            录制中
          </span>
        )}
        {playbackMode && (
          <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 500 }}>⏮ 回放模式</span>
        )}
        {loading && !playbackMode && <span style={{ fontSize: '12px', color: '#999' }}>刷新中...</span>}
      </h3>
      {!playbackMode && (liveStatus === 'error' || liveStatus === 'no_data') ? (
        <div style={{ color: liveStatus === 'error' ? '#d32f2f' : '#b26a00', padding: '40px 0', textAlign: 'center', fontSize: '13px' }}>
          {useEEGStore.getState().liveError || '当前通道无可用数据'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <XAxis dataKey="t" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
            <Line type="monotone" dataKey="value" stroke="#1565c0" dot={false} strokeWidth={1.5} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
