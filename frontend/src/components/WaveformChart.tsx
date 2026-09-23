import React, { useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEEGStore } from '../store/eeg';
import { refreshLiveSample } from '../services/eeg';

const CHANNEL_NAMES: Record<string, string> = {
  Fp1: '左前额', Fp2: '右前额', F3: '左额', F4: '右额',
  C3: '左中央', C4: '右中央', P3: '左顶', P4: '右顶',
  O1: '左枕', O2: '右枕'
};

export const WaveformChart: React.FC = () => {
  const {
    eegData, selectedChannel, sampleStatus, sampleError,
    isRecording, playbackMode,
  } = useEEGStore();
  const loading = sampleStatus === 'loading';

  const fetchEEG = useCallback(() => {
    void refreshLiveSample();
  }, []);

  useEffect(() => {
    if (playbackMode) return;

    void refreshLiveSample();
    const intervalId = window.setInterval(fetchEEG, 3000);
    return () => window.clearInterval(intervalId);
  }, [selectedChannel, playbackMode, fetchEEG]);

  const chartData = eegData?.data[selectedChannel]?.map((v: number, i: number) => ({
    t: eegData.time[i]?.toFixed(3), value: Number(v.toFixed(4))
  })) || [];

  const channelName = CHANNEL_NAMES[selectedChannel] || selectedChannel;

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
        {sampleStatus === 'error' && !playbackMode && (
          <button
            onClick={fetchEEG}
            disabled={loading}
            style={{ marginLeft: 'auto', fontSize: '12px', color: '#1565c0', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            重试
          </button>
        )}
      </h3>
      {sampleStatus === 'error' && !playbackMode ? (
        <div style={{ padding: '12px', color: '#b71c1c', background: '#ffebee', borderRadius: '8px', fontSize: '13px' }}>
          {sampleError || '当前通道数据计算失败'}
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ color: '#999', padding: '40px 0', textAlign: 'center' }}>等待数据中...</div>
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
