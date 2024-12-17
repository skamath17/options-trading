from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TradeCreate(BaseModel):
    position_id: Optional[int]
    user_id: int
    order_type: str
    entry_price: float
    quantity: int
    trading_symbol: str
    strategy_name: str = "Custom"

class TradeUpdate(BaseModel):
    exit_price: float
    exit_time: datetime
    pnl: float

class TradeResponse(BaseModel):
    trade_id: int
    position_id: int
    status: str
    pnl: Optional[float]

    class Config:
        from_attributes = True