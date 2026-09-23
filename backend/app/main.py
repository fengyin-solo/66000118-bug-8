from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .core.config import CORS_ORIGINS
from .api.eeg import router as eeg_router
from .services.eeg_processor import DataUnavailableError, CalculationError

app = FastAPI(title="EEG Visualizer API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
app.include_router(eeg_router, prefix="/api")


def _error_response(message: str, status_code: int) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={'error': message})


@app.exception_handler(DataUnavailableError)
async def data_unavailable_handler(request: Request, exc: DataUnavailableError):
    return _error_response(str(exc), 404)


@app.exception_handler(CalculationError)
async def calculation_error_handler(request: Request, exc: CalculationError):
    return _error_response(str(exc), 502)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return _error_response('请求参数无效', 422)


@app.get("/api/health")
async def health(): return {"status": "ok", "service": "EEG Visualizer"}
