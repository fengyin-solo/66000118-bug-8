from fastapi import APIRouter
from ..services.eeg_processor import (
    DataUnavailableError,
    generate_mock_eeg,
    compute_band_power,
    compute_spectrogram,
    compute_brain_state,
    compute_correlation,
    SAMPLE_RATE,
)

router = APIRouter(prefix="/eeg", tags=["eeg"])


def _channel_data(data: dict, channel: str) -> list:
    channel_data = data.get('data', {}).get(channel)
    if channel_data is None:
        raise DataUnavailableError(f'{channel} 通道没有可用数据')
    return channel_data


@router.get("/stream")
async def stream_eeg(duration: float = 5.0):
    return generate_mock_eeg(duration)


@router.get("/bands/{channel}")
async def band_power(channel: str):
    data = generate_mock_eeg(5.0)
    channel_data = _channel_data(data, channel)
    return {'channel': channel, 'bands': compute_band_power(channel_data, SAMPLE_RATE)}


@router.get("/brain-state/{channel}")
async def brain_state(channel: str):
    data = generate_mock_eeg(5.0)
    channel_data = _channel_data(data, channel)
    return {'channel': channel, 'state': compute_brain_state(channel_data, SAMPLE_RATE)}


@router.get("/spectrogram/{channel}")
async def spectrogram(channel: str):
    data = generate_mock_eeg(5.0)
    channel_data = _channel_data(data, channel)
    return {'channel': channel, 'spectrogram': compute_spectrogram(channel_data, SAMPLE_RATE)}


@router.get("/correlation/{channel}")
async def correlation(channel: str, duration: float = 3.0):
    data = generate_mock_eeg(duration)
    _channel_data(data, channel)
    return compute_correlation(channel, data['data'], SAMPLE_RATE)


@router.get("/channels")
async def list_channels():
    from ..services.eeg_processor import CHANNELS
    return {'channels': CHANNELS}


@router.get("/sample/{channel}")
async def full_sample(channel: str, duration: float = 3.0):
    data = generate_mock_eeg(duration)
    channel_data = _channel_data(data, channel)
    return {
        'channel': channel,
        'eeg': data,
        'bands': compute_band_power(channel_data, SAMPLE_RATE),
        'brainState': compute_brain_state(channel_data, SAMPLE_RATE),
        'correlation': compute_correlation(channel, data['data'], SAMPLE_RATE),
    }
