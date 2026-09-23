import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEEGStore } from '../store/eeg';
import { BandPower } from '../types';
import {
  BAND_KEYS, BAND_LABELS, BAND_COLORS, channelDisplayName, formatBandValue,
} from '../utils/eeg';

const panelStyle: React.CSSProperties = {
  padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
};
const titleStyle: React.CSSProperties = {
  margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
};

interface BandDatum {
  key: string;
  name: string;
  power: number | null; // null = 该频段缺失
  missing: boolean;
  color: string;
}

const buildData = (bandPower: BandPower | null): BandDatum[] =>
  BAND_KEYS.map(key => ({
    key,
    name: BAND_LABELS[key],
    power: bandPower ? bandPower[key] : null,
    missing: !bandPower || bandPower[key] === null,
    color: BAND_COLORS[key],
  }));

interface BarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: BandDatum;
}

// 单根柱：缺失频段画灰色虚线轮廓柱（明确"无数据"，区别于真实零值），有值用该频段颜色
const renderBandBar = (props: BarProps) => {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  if (!payload || height <= 0) return <g />;
  if (payload.missing) {
    return (
      <rect
        key={payload.key}
        x={x} y={y} width={width} height={height}
        fill="url(#missingBandHatch)" stroke="#bdbdbd" strokeWidth={1}
        strokeDasharray="4 3" rx={4}
      />
    );
  }
  return (
    <rect
      key={payload.key}
      x={x} y={y} width={width} height={height}
      fill={payload.color} rx={4}
    />
  );
};

interface BandBarProps {
  panelKey: string;
  data: BandDatum[];
}

const BandBars: React.FC<BandBarProps> = ({ panelKey, data }) => (
  <ResponsiveContainer width="100%" height={200}>
    <BarChart key={panelKey} data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
      <defs>
        <pattern id="missingBandHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#f5f5f5" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#d0d0d0" strokeWidth="2" />
        </pattern>
      </defs>
      <XAxis
        dataKey="name"
        tick={{ fontSize: 11 }}
        tickFormatter={(_value: string, index: number) =>
          data[index]?.missing ? `${data[index].name}·缺` : data[index]?.name ?? ''
        }
      />
      <YAxis tick={{ fontSize: 10 }} />
      <Tooltip
        formatter={((_value: unknown, _name: string, item: any) => {
          const d = item?.payload as BandDatum | undefined;
          return [d?.missing ? '无数据' : formatBandValue(d?.power ?? null), d?.name ?? ''];
        }) as never}
      />
      <Bar
        dataKey="power"
        shape={renderBandBar}
        isAnimationActive={false}
        radius={[4, 4, 0, 0]}
      />
    </BarChart>
  </ResponsiveContainer>
);

const LegendRow: React.FC<{ data: BandDatum[] }> = ({ data }) => (
  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: 4 }}>
    {data.map(d => (
      <span key={d.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: d.missing ? '#9e9e9e' : '#555' }}>
        <span style={{
          width: 10, height: 10, borderRadius: 2,
          background: d.missing ? '#f5f5f5' : d.color,
          border: d.missing ? '1px dashed #bdbdbd' : 'none',
        }} />
        {d.name}{d.missing ? '（无数据）' : ''}
      </span>
    ))}
  </div>
);

export const BandPowerChart: React.FC = () => {
  const {
    bandPower, selectedChannel, playbackMode, activeRecording, playbackState,
    liveStatus, liveError, retryLiveFetch,
  } = useEEGStore();

  const channelName = channelDisplayName(selectedChannel);
  const data = buildData(bandPower);

  const header = (
    <h3 style={titleStyle}>
      <span style={{ fontSize: '20px' }}>📊</span>
      <span>{selectedChannel}</span>
      <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>{channelName} · 频段能量</span>
      {playbackMode && <span style={{ fontSize: '12px', color: '#6a1b9a', fontWeight: 500 }}>⏮ 回放模式</span>}
    </h3>
  );

  // —— 回放：永远显示当前帧；该帧缺数据时显式标缺失，不保留上一帧柱形 ——
  if (playbackMode) {
    if (!activeRecording) return null;
    // 按 录制/通道/帧时间 重挂载，切换帧时图表整体重建，杜绝上一帧结果串入
    const frameKey = `${activeRecording.id}:${selectedChannel}:${playbackState.currentTime.toFixed(2)}`;
    return (
      <div style={panelStyle}>
        {header}
        <BandBars panelKey={frameKey} data={data} />
        <LegendRow data={data} />
      </div>
    );
  }

  // —— 实时：加载中 / 失败，均不残留上一通道结果 ——
  if (liveStatus === 'loading' && !bandPower) {
    return (
      <div style={panelStyle}>
        {header}
        <div style={{ color: '#999', padding: '40px 0', textAlign: 'center' }}>
          正在计算 {selectedChannel} 频段能量...
        </div>
      </div>
    );
  }

  if (liveStatus === 'error') {
    return (
      <div style={panelStyle}>
        {header}
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <div style={{ color: '#d32f2f', fontSize: '13px', marginBottom: 12 }}>
            ⚠️ {liveError || '频段能量计算失败'}
          </div>
          <button
            onClick={retryLiveFetch}
            style={{
              padding: '6px 18px', background: '#1565c0', color: '#fff',
              border: 'none', borderRadius: '6px', fontSize: '13px',
              fontWeight: 500, cursor: 'pointer',
            }}
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  if (liveStatus === 'no_data') {
    return (
      <div style={panelStyle}>
        {header}
        <div style={{ color: '#b26a00', padding: '40px 0', textAlign: 'center', fontSize: '13px' }}>
          当前通道无频段数据
        </div>
        <LegendRow data={data} />
      </div>
    );
  }

  // —— 实时成功：图例与柱形都由同一份 data 渲染，按通道重挂载，杜绝错位/串通道 ——
  return (
    <div style={panelStyle}>
      {header}
      <BandBars panelKey={`live:${selectedChannel}`} data={data} />
      <LegendRow data={data} />
    </div>
  );
};
