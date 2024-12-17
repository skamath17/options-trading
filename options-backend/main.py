from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.api import trading
from app.database import engine, get_db
from app.models import Base


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
        db.execute("SELECT 1")
        return {"status": "success", "message": "Database connection successful"}
    except Exception as e:
        return {"status": "error", "message": str(e)}