from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from kiteconnect import KiteConnect
import os
from dotenv import load_dotenv
import logging
from datetime import date, datetime
from app.models.trade import Trade
from app.models.position import Position
from app.database import get_db
from sqlalchemy.orm import Session

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

# Create router
router = APIRouter()

kite = KiteConnect(api_key=os.getenv("KITE_API_KEY"))
access_token = "eUaDFRsjI1kKP2XCuLFtM6yhrY5TVsAo"
kite.set_access_token(access_token)

def serialize_dates(obj):
    """Convert dates to strings in the options data"""
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    return obj

@router.get("/login")
async def login():
    login_url = kite.login_url()
    return JSONResponse(content={"login_url": login_url})

@router.get("/callback")
async def callback(request_token: str):
    global access_token
    try:
        data = kite.generate_session(request_token, api_secret=os.getenv("KITE_API_SECRET"))
        access_token = data["access_token"]
        kite.set_access_token(access_token)
        return JSONResponse(content={"status": "success", "access_token": access_token})
    except Exception as e:
        logger.error(f"Callback error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/option-chain/{symbol}")
async def get_option_chain(symbol: str):
    try:
        logger.info(f"Fetching options for {symbol}")
        
        # Determine the exchange and spot token based on symbol
        if symbol == "SENSEX":
            exchange = "BFO"
            spot_token = "BSE:SENSEX"  # Changed this for SENSEX
            strike_interval = 100
        else:  # NIFTY
            exchange = "NFO"
            spot_token = "NSE:NIFTY 50"  # Also updated NIFTY token format
            strike_interval = 50
            
        logger.info(f"Using spot token: {spot_token}")
        
        # Get current market price
        try:
            spot_quote = kite.quote([spot_token])
            logger.info(f"Spot quote response: {spot_quote}")
            spot_price = spot_quote[spot_token]['last_price']
            logger.info(f"Current {symbol} price: {spot_price}")
        except Exception as e:
            logger.error(f"Error fetching spot price: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error fetching spot price: {str(e)}")

        
        # Get current expiry instruments
        instruments = kite.instruments(exchange)
        logger.info(f"Fetched {len(instruments)} instruments")
        
        # Filter for the specific symbol and current expiry
        expiry_dates = [serialize_dates(inst['expiry']) for inst in instruments 
                       if inst['name'] == symbol and 
                       inst['instrument_type'] in ['CE', 'PE']]
        
        if not expiry_dates:
            return JSONResponse(content={"error": f"No options found for {symbol}"})
            
        current_expiry = min(expiry_dates)
        
        # Calculate ATM strike
        atm_strike = round(spot_price / strike_interval) * strike_interval
        logger.info(f"ATM Strike: {atm_strike}")
        
        # Calculate strike range
        lower_strike = atm_strike - (20 * strike_interval)
        upper_strike = atm_strike + (20 * strike_interval)
        
        # Filter options by strike range and expiry
        options = [inst for inst in instruments 
                  if inst['name'] == symbol and 
                  inst['instrument_type'] in ['CE', 'PE'] and
                  serialize_dates(inst['expiry']) == current_expiry and
                  lower_strike <= inst['strike'] <= upper_strike]
        
        # Get all instrument tokens for getting quotes
        instrument_tokens = [str(opt['instrument_token']) for opt in options]
        
        # Get LTP for all options
        quotes = kite.quote([str(token) for token in instrument_tokens])
        
        # Organize data by strike price
        strikes_data = {}
        for opt in options:
            strike = opt['strike']
            if strike not in strikes_data:
                strikes_data[strike] = {'strike': strike, 'CE': None, 'PE': None}
            
            opt_type = opt['instrument_type']
            token = str(opt['instrument_token'])
            
            if token in quotes:
                strikes_data[strike][opt_type] = quotes[token]['last_price']
        
        # Convert to list and sort by strike
        formatted_data = list(strikes_data.values())
        formatted_data.sort(key=lambda x: x['strike'])
        
        response_data = {
            "data": formatted_data,
            "expiry": current_expiry,
            "spotPrice": spot_price,
            "atmStrike": atm_strike
        }
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        logger.error(f"Error fetching options: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    

@router.post("/place-order")
async def place_order(order_details: dict, db: Session = Depends(get_db)):
    try:
        logger.info(f"Placing order: {order_details}")
        
        # Get current expiry from instruments
        exchange = "NFO" if order_details['symbol'] == "NIFTY" else "BFO"
        instruments = kite.instruments(exchange)
        
        # Filter for the specific symbol and current expiry
        current_expiry = min(inst['expiry'] for inst in instruments 
                           if inst['name'] == order_details['symbol'] and 
                           inst['instrument_type'] in ['CE', 'PE'])
        
        # Get the month letter (A for Jan, B for Feb, etc.)
        month_letters = {
            1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E', 6: 'F',
            7: 'G', 8: 'H', 9: 'I', 10: 'J', 11: 'K', 12: 'D'
        }
        
        # Format expiry date as YYMDD (e.g., 24D19)
        month_letter = month_letters[current_expiry.month]
        expiry_str = f"{current_expiry.strftime('%y')}{month_letter}{current_expiry.strftime('%d')}"
        
        # Construct trading symbol
        trading_symbol = f"{order_details['symbol']}{expiry_str}{order_details['strike']}{order_details['optionType']}"
        
        logger.info(f"Constructed trading symbol: {trading_symbol}")
        
        # Check for existing open position for this instrument and user
        base_instrument = f"{order_details['symbol']}{expiry_str}"
        existing_position = db.query(Position).filter(
            #Position.user_id == order_details['user_id'],
            Position.user_id == 1,
            Position.instrument == base_instrument,
            Position.status == "OPEN"
        ).first()

        # Create or get position_id
        if not existing_position:
            position = Position(
                #user_id=order_details['user_id'],
                user_id=1,
                strategy_name=order_details.get('strategy_name', 'Custom'),
                instrument=base_instrument,
                start_time=datetime.utcnow(),
                status="OPEN"
            )
            db.add(position)
            db.flush()
            position_id = position.position_id
        else:
            position_id = existing_position.position_id

        # Create trade entry
        new_trade = Trade(
            position_id=position_id,
            #user_id=order_details['user_id'],
            user_id=1,
            order_type=order_details['action'],
            entry_time=datetime.utcnow(),
            entry_price=order_details.get('price', 0),  # You might want to get actual price
            quantity=order_details['quantity'] * order_details['lotSize'],
            status="OPEN",
            trading_symbol=trading_symbol
        )
        db.add(new_trade)
        
        # Construct order params for Kite
        order_params = {
            "tradingsymbol": trading_symbol,
            "exchange": exchange,
            "transaction_type": order_details['action'],
            "quantity": order_details['quantity'] * order_details['lotSize'],
            "product": kite.PRODUCT_NRML,
            "order_type": kite.ORDER_TYPE_MARKET,
            "variety": kite.VARIETY_REGULAR
        }

        # Place order
        order_id = kite.place_order(**order_params)
        
        # If order placement successful, commit DB changes
        db.commit()
        
        return JSONResponse(content={
            "status": "success",
            "order_id": order_id,
            "trading_symbol": trading_symbol,
            "position_id": position_id,
            "trade_id": new_trade.trade_id,
            "message": "Order placed successfully"
        })
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error placing order: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.get("/positions")
async def get_positions():
    try:
        positions = kite.positions()
        return JSONResponse(content={
            "status": "success",
            "data": positions
        })
    except Exception as e:
        logger.error(f"Error fetching positions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))