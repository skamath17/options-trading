from sqlalchemy import Column, Integer, String, TIMESTAMP
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "Users"
    
    user_id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    username = Column(String(255), nullable=False, unique=True)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP, default=datetime.utcnow)