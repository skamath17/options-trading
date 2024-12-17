from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.user import User
from .api import trading
from .database import engine, get_db
from .models import Base

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3005"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create database tables
Base.metadata.create_all(bind=engine)

# Include routers
app.include_router(trading.router)

@app.get("/")
async def root():
    return {"message": "Options Trading API Backend"}

@app.get("/test-db")
async def test_db(db: Session = Depends(get_db)):
    try:
        # Try to make a simple query
        db.execute(text("SELECT 1"))
        return {"status": "success", "message": "Database connection successful"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    
@app.post("/test-create-user")
async def test_create_user(db: Session = Depends(get_db)):
    try:
        # Create a test user
        test_user = User(
            name="Test User",
            username="testuser",
            email="test@example.com",
            password_hash="test123"  # In production, this should be properly hashed
        )
        db.add(test_user)
        db.commit()
        return {"status": "success", "user_id": test_user.user_id}
    except Exception as e:
        db.rollback()
        return {"status": "error", "message": str(e)}