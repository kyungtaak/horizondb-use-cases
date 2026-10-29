import asyncio
import logging
import random
from datetime import datetime, timedelta
from typing import TYPE_CHECKING
from uuid import UUID

from app.commerce.models import Comment, OrderEvent, Scene, Tick

if TYPE_CHECKING:
    from app.commerce.repository import CommerceRepository

logger = logging.getLogger(__name__)

COMMENTS: dict[Scene, tuple[str, ...]] = {
    "normal": (
        "4인 가족이 쓰기에 용량이 충분한가요?",
        "바삭하게 잘 익는 모습이 마음에 들어요",
        "세척할 때 바스켓을 분리할 수 있나요?",
        "구성품이 알차네요. 구매하고 싶어요",
        "기름 없이 요리하니까 편리하겠어요",
        "방송 가격에 쿠폰도 적용되나요?",
    ),
    "shipping": (
        "배송이 언제인지 안내가 없어서 답답해요. 금요일까지 오나요?",
        "배송 일정이 불확실해서 결제를 망설이고 있어요",
        "주말에 써야 하는데 배송 안내가 없네요. 불편해요",
        "배송이 늦을까 봐 걱정돼요. 출고일 좀 알려주세요",
        "배송 설명도 없이 구매하라니 답답하네요",
        "제품은 마음에 드는데 배송 때문에 고민이에요",
    ),
    "recovery": (
        "출고 일정 설명해 주셔서 이제 이해됐어요. 감사합니다",
        "배송 일정 확인하고 앱에서 결제했어요",
        "바스켓은 식기세척기에 넣어도 되나요?",
        "구성품 다시 보여주셔서 좋네요",
        "용량이 넉넉해서 구매하고 싶어요",
        "배송 안내가 명확해서 안심이 되네요",
    ),
}


def make_tick(run_id: UUID, sequence: int, scene: Scene, now: datetime, seed: int) -> Tick:
    rng = random.Random(f"{seed}:{sequence}")
    orders: list[OrderEvent] = []
    if rng.random() < {"normal": 40 / 60, "shipping": 20 / 60, "recovery": 45 / 60}[scene]:
        channel = rng.choice(("app", "phone", "web"))
        for kind in ("received", "paid"):
            orders.append(OrderEvent(
                run_id=run_id, event_id=f"{run_id}:{sequence}:{kind}", order_id=sequence,
                kind=kind, channel=channel,
                occurred_at=now - timedelta(milliseconds=10 if kind == "received" else 0),
            ))
        if sequence % 23 == 0:
            orders.append(OrderEvent(
                run_id=run_id, event_id=f"{run_id}:{sequence}:cancelled", order_id=sequence,
                kind="cancelled", channel=channel, occurred_at=now,
            ))
    comment = None
    if sequence % 2 == 0:
        comment = Comment(
            comment_id=f"{run_id}:{sequence}", run_id=run_id, created_at=now,
            content=rng.choice(COMMENTS[scene]),
        )
    return Tick(orders=orders, comment=comment)


class CommerceSimulator:
    def __init__(self, repository: "CommerceRepository") -> None:
        self.repository = repository
        self._tasks: list[asyncio.Task[None]] = []
        self._ready = asyncio.Event()
        self._owner = False

    async def start(self) -> None:
        self._tasks = [
            asyncio.create_task(self._generate(), name="commerce-generator"),
            asyncio.create_task(self._analyze(), name="commerce-analysis-monitor"),
            asyncio.create_task(self._brief(), name="commerce-briefing"),
        ]
        await asyncio.wait_for(self._ready.wait(), timeout=12)

    async def close(self) -> None:
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)

    async def _generate(self) -> None:
        from psycopg import AsyncConnection

        while True:
            try:
                async with await AsyncConnection.connect(
                    self.repository.settings.database_conninfo, autocommit=True,
                    connect_timeout=10,
                ) as owner:
                    cursor = await owner.execute("SELECT pg_try_advisory_lock(72421901)")
                    acquired = (await cursor.fetchone())[0]
                    if not acquired:
                        self._ready.set()
                        await asyncio.sleep(5)
                        continue
                    await self.repository.recover()
                    self._owner = True
                    self._ready.set()
                    try:
                        while True:
                            started = asyncio.get_running_loop().time()
                            await owner.execute("SELECT 1")
                            await self.repository.tick()
                            elapsed = asyncio.get_running_loop().time() - started
                            await asyncio.sleep(max(0, 1 - elapsed))
                    finally:
                        self._owner = False
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Commerce generator failed; events paused until reconnect")
                await asyncio.sleep(5)

    async def _analyze(self) -> None:
        while True:
            try:
                if self._owner:
                    await self.repository.enqueue_batches()
                    await self.repository.reconcile()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Commerce AI reconciliation failed")
            await asyncio.sleep(0.5)

    async def _brief(self) -> None:
        while True:
            try:
                if self._owner:
                    await self.repository.generate_briefing(automatic=True)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Commerce briefing worker failed")
            await asyncio.sleep(30)
