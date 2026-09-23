import numpy as np
from scipy import signal


class DataUnavailableError(ValueError):
    pass


class CalculationError(RuntimeError):
    pass

CHANNELS = ['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2']
SAMPLE_RATE = 256
BANDS = {'delta': (0.5,4), 'theta': (4,8), 'alpha': (8,13), 'beta': (13,30), 'gamma': (30,100)}


def _finite_array(channel_data: list, channel_name: str = '通道') -> np.ndarray:
    try:
        values = np.asarray(channel_data, dtype=float)
    except (TypeError, ValueError) as exc:
        raise DataUnavailableError(f'{channel_name} 通道数据无效') from exc
    if values.ndim != 1 or values.size == 0:
        raise DataUnavailableError(f'{channel_name} 通道没有可用数据')
    values = values[np.isfinite(values)]
    if values.size == 0:
        raise DataUnavailableError(f'{channel_name} 通道没有可用数据')
    return values

def generate_mock_eeg(duration_sec: float = 5.0) -> dict:
    t = np.linspace(0, duration_sec, int(SAMPLE_RATE * duration_sec))
    data = {}
    for ch in CHANNELS:
        sig = 0.5*np.sin(2*np.pi*10*t) + 0.3*np.sin(2*np.pi*20*t) + 0.2*np.random.randn(len(t))
        data[ch] = sig.tolist()
    return {'channels': CHANNELS, 'sample_rate': SAMPLE_RATE, 'data': data, 'time': t.tolist(), 'duration': duration_sec}

def compute_band_power(channel_data: list, sample_rate: int) -> dict:
    values = _finite_array(channel_data)
    try:
        freqs, psd = signal.welch(values, fs=sample_rate, nperseg=min(256, len(values)))
        result = {}
        for name, (low, high) in BANDS.items():
            mask = (freqs >= low) & (freqs <= high)
            if mask.any():
                power = float(np.trapz(psd[mask], freqs[mask]))
                result[name] = power if np.isfinite(power) else None
            else:
                result[name] = None
        return result
    except DataUnavailableError:
        raise
    except Exception as exc:
        raise CalculationError('频段能量计算失败') from exc

def compute_spectrogram(channel_data: list, sample_rate: int) -> dict:
    values = _finite_array(channel_data)
    try:
        nperseg = min(128, len(values))
        noverlap = min(64, nperseg - 1)
        f, t, Sxx = signal.spectrogram(values, fs=sample_rate, nperseg=nperseg, noverlap=noverlap)
        return {'frequencies': f.tolist(), 'time': t.tolist(), 'power': (10*np.log10(Sxx+1e-10)).tolist()}
    except DataUnavailableError:
        raise
    except Exception as exc:
        raise CalculationError('频谱图计算失败') from exc

def compute_brain_state(channel_data: list, sample_rate: int) -> dict:
    import time
    bands = compute_band_power(channel_data, sample_rate)
    total = sum(value for value in bands.values() if value is not None) + 1e-10
    def ratio(band: str) -> float:
        value = bands.get(band)
        return value / total if value is not None else 0.0

    beta_rel = ratio('beta')
    alpha_rel = ratio('alpha')
    theta_rel = ratio('theta')
    try:
        focus = min(100.0, max(0.0, (beta_rel * 300) + np.random.uniform(-5, 5)))
        relaxation = min(100.0, max(0.0, (alpha_rel * 300) + np.random.uniform(-5, 5)))
        fatigue = min(100.0, max(0.0, (theta_rel * 300) + np.random.uniform(-5, 5)))
    except Exception as exc:
        raise CalculationError('脑状态计算失败') from exc
    scores = {'focused': focus, 'relaxed': relaxation, 'fatigued': fatigue}
    max_score = max(scores.values())
    if max_score < 50:
        status = 'neutral'
        status_label = '平稳'
        status_color = '#757575'
    else:
        status = max(scores, key=scores.get)
        if status == 'focused':
            status_label = '专注'
            status_color = '#1976d2'
        elif status == 'relaxed':
            status_label = '放松'
            status_color = '#388e3c'
        else:
            status_label = '疲劳'
            status_color = '#d32f2f'
    return {
        'focus': round(focus, 1),
        'relaxation': round(relaxation, 1),
        'fatigue': round(fatigue, 1),
        'status': status,
        'statusLabel': status_label,
        'statusColor': status_color,
        'timestamp': int(time.time() * 1000)
    }

def compute_correlation(target_channel: str, all_data: dict, sample_rate: int) -> dict:
    target_data = _finite_array(all_data[target_channel], target_channel)
    correlations = []
    try:
        for ch in CHANNELS:
            if ch == target_channel:
                correlations.append({
                    'channel': ch,
                    'targetChannel': target_channel,
                    'correlation': 1.0,
                    'coherence': 1.0
                })
                continue
            try:
                ch_data = _finite_array(all_data.get(ch), ch)
                min_length = min(len(target_data), len(ch_data))
                if min_length < 2:
                    corr = None
                    mean_coh = None
                else:
                    target_values = target_data[:min_length]
                    ch_values = ch_data[:min_length]
                    corr_value = float(np.corrcoef(target_values, ch_values)[0, 1])
                    corr = corr_value if np.isfinite(corr_value) else None
                    f, coh = signal.coherence(target_values, ch_values, fs=sample_rate, nperseg=min(128, min_length))
                    alpha_mask = (f >= 8) & (f <= 13)
                    coh_value = float(np.mean(coh[alpha_mask])) if alpha_mask.any() else None
                    mean_coh = coh_value if coh_value is not None and np.isfinite(coh_value) else None
            except DataUnavailableError:
                corr = None
                mean_coh = None
            correlations.append({
                'channel': ch,
                'targetChannel': target_channel,
                'correlation': round(corr, 4) if corr is not None else None,
                'coherence': round(mean_coh, 4) if mean_coh is not None else None
            })
        return {'targetChannel': target_channel, 'correlations': correlations}
    except DataUnavailableError:
        raise
    except Exception as exc:
        raise CalculationError('通道相关分析计算失败') from exc
