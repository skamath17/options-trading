from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from datetime import datetime
from ..database import Base

class Trade(Base):
    __tablename__ = "Trades"
    
    trade_id = Column(Integer, primary_key=True, autoincrement=True)
    position_id = Column(Integer, ForeignKey('Positions.position_id'), nullable=False)
    user_id = Column(Integer, ForeignKey('Users.user_id'), nullable=False)
    order_type = Column(String(50), nullable=False)
    entry_time = Column(DateTime, nullable=False)
    exit_time = Column(DateTime, nullable=True)
    entry_price = Column(Numeric(10, 2), nullable=False)
    exit_price = Column(Numeric(10, 2), nullable=True)
    quantity = Column(Integer, nullable=False)
    pnl = Column(Numeric(10, 2), nullable=True)
    status = Column(String(50), nullable=False)
    trading_symbol = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    
    position = relationship("Position", back_populates="trades")