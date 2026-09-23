import numpy as np
from scipy import signal

CHANNELS = ['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2']
SAMPLE_RATE = 256
BANDS = {'delta': (0.5,4), 'theta': (4,8), 'alpha': (8,13), 'beta': (13,30), 'gamma': (30,100)}

def generate_mock_eeg(duration_sec: float = 5.0) -> dict:
    t = np.linspace(0, duration_sec, int(SAMPLE_RATE * duration_sec))
    data = {}
    for ch in CHANNELS:
        sig = 0.5*np.sin(2*np.pi*10*t) + 0.3*np.sin(2*np.pi*20*t) + 0.2*np.random.randn(len(t))
        data[ch] = sig.tolist()
    return {'channels': CHANNELS, 'sample_rate': SAMPLE_RATE, 'data': data, 'time': t.tolist(), 'duration': duration_sec}

def compute_band_power(channel_data: list, sample_rate: int) -> dict:
    # 空/无效数据：各频段均标记为 None（缺失），前端据此显示"无数据"，
    # 不能返回 0.0 —— 零值是真实的计算结果，缺失不是零。
    arr = np.asarray(channel_data, dtype=float)
    if arr.size == 0 or not np.isfinite(arr).any():
        return {name: None for name in BANDS}
    try:
        freqs, psd = signal.welch(arr[np.isfinite(arr)], fs=sample_rate, nperseg=256)
    except Exception:
        return {name: None for name in BANDS}
    result = {}
    for name, (low, high) in BANDS.items():
        mask = (freqs >= low) & (freqs <= high)
        if not mask.any():
            result[name] = None
            continue
        power = float(np.trapz(psd[mask], freqs[mask]))
        result[name] = power if np.isfinite(power) else None
    return result

def compute_spectrogram(channel_data: list, sample_rate: int) -> dict:
    f, t, Sxx = signal.spectrogram(channel_data, fs=sample_rate, nperseg=128, noverlap=64)
    return {'frequencies': f.tolist(), 'time': t.tolist(), 'power': (10*np.log10(Sxx+1e-10)).tolist()}

def compute_brain_state(channel_data: list, sample_rate: int) -> dict:
    import time
    bands = compute_band_power(channel_data, sample_rate)
    # 缺失频段按 0 参与相对占比计算（不改变 None 的"缺失"语义）
    values = {k: (v if v is not None else 0.0) for k, v in bands.items()}
    total = sum(values.values()) + 1e-10
    beta_rel = values['beta'] / total
    alpha_rel = values['alpha'] / total
    theta_rel = values['theta'] / total
    focus = min(100.0, max(0.0, (beta_rel * 300) + np.random.uniform(-5, 5)))
    relaxation = min(100.0, max(0.0, (alpha_rel * 300) + np.random.uniform(-5, 5)))
    fatigue = min(100.0, max(0.0, (theta_rel * 300) + np.random.uniform(-5, 5)))
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
    target_data = np.array(all_data[target_channel])
    correlations = []
    for ch in CHANNELS:
        if ch == target_channel:
            correlations.append({
                'channel': ch,
                'targetChannel': target_channel,
                'correlation': 1.0,
                'coherence': 1.0
            })
            continue
        ch_data = np.array(all_data[ch])
        corr = float(np.corrcoef(target_data, ch_data)[0, 1])
        f, coh = signal.coherence(target_data, ch_data, fs=sample_rate, nperseg=128)
        alpha_mask = (f >= 8) & (f <= 13)
        mean_coh = float(np.mean(coh[alpha_mask])) if alpha_mask.any() else 0.0
        correlations.append({
            'channel': ch,
            'targetChannel': target_channel,
            'correlation': round(corr, 4),
            'coherence': round(mean_coh, 4)
        })
    return {'targetChannel': target_channel, 'correlations': correlations}
