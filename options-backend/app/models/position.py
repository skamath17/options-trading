from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, TIMESTAMP
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Position(Base):
    __tablename__ = "Positions"
    
    position_id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('Users.user_id'), nullable=False)
    strategy_name = Column(String(255), nullable=False)
    instrument = Column(String(255), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    status = Column(String(50), nullable=False)
    total_pnl = Column(Numeric(10, 2), nullable=True)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)
    
    trades = relationship("Trade", back_populates="position")