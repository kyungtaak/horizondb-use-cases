import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.commerce.models import Control, Run, Snapshot, Topic
from app.commerce.repository import CommerceConflict, CommerceRepository
from app.commerce.simulator import CommerceSimulator
from app.commerce.timeline import validate_timeline
from app.config import Settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/commerce", tags=["home-shopping"])


class CommerceRuntime:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.repository: CommerceRepository | None = None
        self.simulator: CommerceSimulator | None = None
        self.error = "홈쇼핑이 비활성화되어 있습니다. 설정 후 COMMERCE_ENABLED=true로 실행하세요."

    async def open(self) -> None:
        if not self.settings.commerce_enabled:
            return
        repository = CommerceRepository(self.settings)
        simulator = CommerceSimulator(repository)
        try:
            await repository.open()
            await simulator.start()
        except Exception:
            logger.exception("Commerce initialization failed; Fleet remains available")
            await simulator.close()
            await repository.close()
            self.error = "홈쇼핑 DB 초기화 실패. commerce.setup 실행 결과와 서버 로그를 확인하세요."
            return
        self.repository = repository
        self.simulator = simulator

    async def close(self) -> None:
        if self.simulator:
            await self.simulator.close()
        if self.repository:
            await self.repository.close()


def get_repository(request: Request) -> CommerceRepository:
    runtime: CommerceRuntime = request.app.state.commerce
    if runtime.repository is None:
        raise HTTPException(status_code=503, detail=runtime.error)
    return runtime.repository


Repo = Annotated[CommerceRepository, Depends(get_repository)]


@router.get("/snapshot", response_model=Snapshot)
async def snapshot(
    repository: Repo, window_seconds: Annotated[int, Query(ge=60, le=300)] = 60,
    topic: Annotated[Topic | None, Query()] = None,
    timeline_seconds: int = 900, bucket_seconds: int = 60,
) -> Snapshot:
    if window_seconds not in (60, 300):
        raise HTTPException(status_code=422, detail="window_seconds must be 60 or 300")
    try:
        validate_timeline(timeline_seconds, bucket_seconds)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return await repository.snapshot(window_seconds, topic, timeline_seconds, bucket_seconds)


@router.post("/control", response_model=Run)
async def control(command: Control, repository: Repo) -> Run:
    try:
        return await repository.control(command)
    except CommerceConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/briefing")
async def briefing(repository: Repo) -> dict[str, str]:
    try:
        await repository.generate_briefing()
    except CommerceConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"status": "completed"}


@router.post("/retry-analysis")
async def retry_analysis(repository: Repo) -> dict[str, int]:
    return {"retried": await repository.retry_analysis()}
