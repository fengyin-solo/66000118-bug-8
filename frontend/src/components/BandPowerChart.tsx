import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Rectangle } from 'recharts';
import { useEEGStore } from '../store/eeg';
import { refreshLiveSample } from '../services/eeg';
import { BandName } from '../types';

const BANDS: Array<{ key: BandName; label: string; color: string }> = [
  { key: 'delta', label: 'Delta', color: '#1565c0' },
  { key: 'theta', label: 'Theta', color: '#2e7d32' },
  { key: 'alpha', label: 'Alpha', color: '#f9a825' },
  { key: 'beta', label: 'Beta', color: '#e53935' },
  { key: 'gamma', label: 'Gamma', color: '#6a1b9a' },
];

const CHANNEL_NAMES: Record<string, string> = {
  Fp1: '左前额', Fp2: '右前额', F3: '左额', F4: '右额',
  C3: '左中央', C4: '右中央', P3: '左顶', P4: '右顶',
  O1: '左枕', O2: '右枕'
};

interface BandDatum {
  name: string;
  color: string;
  value: number;
  power: number | null;
  missing: boolean;
}

const BandBarShape: React.FC<any> = (props) => {
  const { x, y, width, payload } = props as {
    x: number;
    y: number;
    width: number;
    payload: BandDatum;
  };

  if (!payload.missing) {
    return <Rectangle {...props} fill={payload.color} radius={[4, 4, 0, 0]} />;
  }

  const center = x + width / 2;
  return (
    <g>
      <rect
        x={center - 2}
        y={Math.max(8, y - 28)}
        width={4}
        height={28}
        rx={2}
        fill="none"
        stroke={payload.color}
        strokeWidth={2}
        strokeDasharray="4 3"
      />
      <text x={center} y={Math.max(24, y - 34)} textAnchor="middle" fontSize="10" fill={payload.color}>
        缺
      </text>
    </g>
  );
};

const BandTooltip: React.FC<any> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload as BandDatum;
  return (
    <div style={{ padding: '8px 10px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '6px', fontSize: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
      <div style={{ fontWeight: 700, color: item.color, marginBottom: '4px' }}>{item.name}</div>
      {item.missing ? (
        <span style={{ color: '#999' }}>该频段无数据</span>
      ) : (
        <span style={{ color: '#333' }}>能量: {item.power?.toFixed(4)}</span>
      )}
    </div>
  );
};

const BandLegend: React.FC<{ data?: BandDatum[] }> = ({ data = [] }) => (
  <ul style={{ display: 'flex', padding: 0, margin: '8px 16px 0 48px' }}>
    {data.map(item => {
      return (
        <li key={item.name} style={{ listStyle: 'none', flex: 1, minWidth: 0, textAlign: 'center', fontSize: '11px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#333', fontWeight: 600 }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: item.missing ? 'transparent' : item.color,
              border: item.missing ? `2px dashed ${item.color}` : 'none',
              boxSizing: 'border-box',
            }} />
            {item.name}
          </div>
          <div style={{ color: item.missing ? '#ef6c00' : '#666', marginTop: '2px' }}>
            {item.missing ? '缺失' : item.power?.toFixed(2)}
          </div>
        </li>
      );
    })}
  </ul>
);

export const BandPowerChart: React.FC = () => {
  const {
    bandPower, selectedChannel, playbackMode,
    sampleStatus, sampleError,
  } = useEEGStore();
  const channelName = CHANNEL_NAMES[selectedChannel] || selectedChannel;
  const loading = sampleStatus === 'loading' && !playbackMode;
  const failed = sampleStatus === 'error' && !playbackMode;

  const data: BandDatum[] = BANDS.map(({ key, label, color }) => {
    const power = bandPower?.[key] ?? null;
    return {
      name: label,
      color,
      power,
      value: power ?? 0,
      missing: power === null,
    };
  });
  const hasMissingBand = data.some(item => item.missing);

  const header = (
    <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '20px' }}>📊</span>
      <span>{selectedChannel}</span>
      <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>{channelName} · 频段能量</span>
      {playbackMode && <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 500 }}>⏮ 回放中</span>}
      {loading && <span style={{ fontSize: '12px', color: '#999' }}>计算中...</span>}
      {hasMissingBand && !failed && <span style={{ fontSize: '12px', color: '#ef6c00' }}>部分频段缺失</span>}
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
          {sampleError || '当前通道频段计算失败'}
        </div>
      ) : !bandPower ? (
        <div style={{ color: '#999', padding: '40px 0', textAlign: 'center' }}>
          {loading ? '正在清空旧结果并计算当前通道...' : '暂无频段数据'}
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart key={selectedChannel} data={data} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis width={48} tick={{ fontSize: 10 }} />
              <Tooltip content={<BandTooltip />} cursor={{ fill: 'rgba(21, 101, 192, 0.06)' }} />
              <Bar dataKey="value" shape={<BandBarShape />} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <BandLegend data={data} />
        </>
      )}
    </div>
  );
};
