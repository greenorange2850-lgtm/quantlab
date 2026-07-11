# AI Trading Research OS — Python AI Service (Future)
# This service will handle LLM-powered strategy analysis.
# The Node.js API delegates to this service via HTTP.

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Trading OS AI Service", version="0.1.0")


class AnalysisRequest(BaseModel):
    strategy_version_id: str
    backtest_id: str | None = None


class AnalysisResponse(BaseModel):
    confidence: float
    reasoning: str
    suggestions: list[dict]
    weaknesses: list[dict]


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-python"}


@app.post("/analyze", response_model=AnalysisResponse)
def analyze(request: AnalysisRequest):
    return AnalysisResponse(
        confidence=0.0,
        reasoning="AI service ready — awaiting integration with Node.js API.",
        suggestions=[],
        weaknesses=[],
    )
