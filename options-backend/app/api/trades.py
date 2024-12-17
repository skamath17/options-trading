from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.trade import Trade
from ..models.position import Position
from ..schemas.trade import TradeCreate, TradeUpdate, TradeResponse
from datetime import datetime

router = APIRouter()

@router.post("/trades/open", response_model=dict)
async def open_trade(trade_data: TradeCreate, db: Session = Depends(get_db)):
    try:
        # Create or get position
        position = Position(
            user_id=trade_data.user_id,
            strategy_name=trade_data.strategy_name,
            instrument=trade_data.trading_symbol.split(r"\d")[0],
            start_time=datetime.utcnow(),
            status="OPEN"
        )
        db.add(position)
        db.flush()

        # Create trade
        new_trade = Trade(
            position_id=position.position_id,
            user_id=trade_data.user_id,
            order_type=trade_data.order_type,
            entry_time=datetime.utcnow(),
            entry_price=trade_data.entry_price,
            quantity=trade_data.quantity,
            status="OPEN",
            trading_symbol=trade_data.trading_symbol
        )
        db.add(new_trade)
        db.commit()
        
        return {
            "status": "success",
            "message": "Trade opened successfully",
            "trade_id": new_trade.trade_id,
            "position_id": position.position_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))