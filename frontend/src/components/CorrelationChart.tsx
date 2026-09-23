import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useEEGStore } from '../store/eeg';
import { refreshLiveSample } from '../services/eeg';

const CHANNEL_NAMES: Record<string, string> = {
  Fp1: '左前额', Fp2: '右前额', F3: '左额', F4: '右额',
  C3: '左中央', C4: '右中央', P3: '左顶', P4: '右顶',
  O1: '左枕', O2: '右枕'
};

interface CorrelationDatum {
  name: string;
  nameCn: string;
  correlation: number | null;
  coherence: number | null;
  correlationValue: number;
  coherenceValue: number;
}

export const CorrelationChart: React.FC = () => {
  const {
    correlationData, selectedChannel, playbackMode,
    sampleStatus, sampleError,
  } = useEEGStore();
  const channelName = CHANNEL_NAMES[selectedChannel] || selectedChannel;
  const loading = sampleStatus === 'loading' && !playbackMode;
  const failed = sampleStatus === 'error' && !playbackMode;
  const targetChannel = correlationData?.targetChannel || selectedChannel;

  const chartData: CorrelationDatum[] = (correlationData?.correlations || [])
    .filter(c => c.channel !== targetChannel)
    .map(c => ({
      name: c.channel,
      nameCn: CHANNEL_NAMES[c.channel] || c.channel,
      correlation: c.correlation,
      coherence: c.coherence,
      correlationValue: c.correlation === null ? 0 : Math.abs(c.correlation) * 100,
      coherenceValue: c.coherence === null ? 0 : c.coherence * 100,
    }));

  const getCorrelationColor = (value: number) => {
    if (value >= 80) return '#2e7d32';
    if (value >= 60) return '#689f38';
    if (value >= 40) return '#f9a825';
    if (value >= 20) return '#ef6c00';
    return '#c62828';
  };

  const formatMetric = (value: number | null) => value === null ? '缺失' : `${value.toFixed(1)}%`;

  const header = (
    <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '20px' }}>🔗</span>
      <span>{targetChannel}</span>
      <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>{channelName} · 通道相关分析</span>
      {playbackMode && <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 500 }}>⏮ 回放中</span>}
      {loading && <span style={{ fontSize: '12px', color: '#999' }}>计算中...</span>}
      {failed && (
        <button
          onClick={() => void refreshLiveSample()}
          disabled={loading}
          style={{ marginLeft: 'auto', fontSize: '12px', color: '#1565c0', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          重试
        </button>
      )}
    </h3>
  );

  return (
    <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      {header}
      {failed ? (
        <div style={{ padding: '12px', color: '#b71c1c', background: '#ffebee', borderRadius: '8px', fontSize: '13px' }}>
          {sampleError || '当前通道相关分析计算失败'}
        </div>
      ) : !correlationData ? (
        <div style={{ color: '#999', padding: '40px 0', textAlign: 'center' }}>
          {loading ? '正在清空旧结果并计算当前通道...' : '暂无相关分析数据'}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            {chartData.slice(0, 3).map((item) => (
              <div key={item.name} style={{ flex: 1, minWidth: '120px', padding: '12px', borderRadius: '8px', background: `linear-gradient(135deg, ${item.correlation === null ? '#9e9e9e' : getCorrelationColor(item.correlationValue)}15, ${item.correlation === null ? '#9e9e9e' : getCorrelationColor(item.correlationValue)}08)`, border: `1px solid ${item.correlation === null ? '#9e9e9e30' : getCorrelationColor(item.correlationValue) + '30'}` }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>与 {item.name} 相关度</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: item.correlation === null ? '#9e9e9e' : getCorrelationColor(item.correlationValue) }}>{formatMetric(item.correlation)}</div>
                <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>{item.nameCn}</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart key={targetChannel} data={chartData} barGap={4}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip
                formatter={(value: number, name: string, item: any) => {
                  const datum = item?.payload as CorrelationDatum;
                  if (name === 'correlationValue') return [formatMetric(datum.correlation), '相关性'];
                  return [formatMetric(datum.coherence), 'Alpha相干性'];
                }}
                labelFormatter={(label: string) => `${label} (${CHANNEL_NAMES[label] || label})`}
              />
              <Bar dataKey="correlationValue" name="相关性" radius={[4, 4, 0, 0]}>
                {chartData.map((d) => (
                  <Cell key={d.name} fill={d.correlation === null ? 'rgba(158,158,158,0.18)' : getCorrelationColor(d.correlationValue)} />
                ))}
              </Bar>
              <Bar dataKey="coherenceValue" name="Alpha相干性" fill="#1565c0" radius={[4, 4, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '8px', fontSize: '11px', color: '#333' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: 'linear-gradient(90deg, #2e7d32, #c62828)', borderRadius: '2px' }} />
              相关性
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ width: '10px', height: '10px', background: '#1565c0', opacity: 0.7, borderRadius: '2px' }} />
              Alpha相干性
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#999' }}>
              <span style={{ width: '10px', height: '10px', background: 'rgba(158,158,158,0.18)', border: '1px dashed #9e9e9e', borderRadius: '2px', boxSizing: 'border-box' }} />
              缺失
            </span>
          </div>
        </>
      )}
    </div>
  );
};
