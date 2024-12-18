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

# Create router. Make sure you update everywhere
router = APIRouter()

kite = KiteConnect(api_key=os.getenv("KITE_API_KEY"))
access_token = "8506uEo0X7auounuWiAvrpZWYnH2WA62"
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
        
        # Construct base instrument (e.g., NIFTY24D19)
        base_instrument = f"{order_details['symbol']}{expiry_str}"

        # Check for existing position with this instrument (regardless of status)
        existing_position = db.query(Position).filter(
            Position.user_id == order_details['user_id'],
            Position.instrument == base_instrument
        ).first()

        if existing_position:
            # Reuse existing position and mark it as OPEN
            position_id = existing_position.position_id
            existing_position.status = "OPEN"
            existing_position.start_time = datetime.utcnow()  # Update start time
            existing_position.end_time = None  # Clear end time
            existing_position.total_pnl = None  # Clear total PNL
        else:
            # Create new position
            new_position = Position(
                user_id=order_details['user_id'],
                strategy_name=order_details.get('strategy_name', 'Custom'),
                instrument=base_instrument,
                start_time=datetime.utcnow(),
                status="OPEN"
            )
            db.add(new_position)
            db.flush()
            position_id = new_position.position_id

        # Construct trading symbol
        trading_symbol = f"{base_instrument}{order_details['strike']}{order_details['optionType']}"
        logger.info(f"Constructed trading symbol: {trading_symbol}")
        
        # Create trade entry
        new_trade = Trade(
            position_id=position_id,
            user_id=order_details['user_id'],
            order_type=order_details['action'],
            entry_time=datetime.utcnow(),
            entry_price=order_details.get('price', 0),
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
    
@router.get("/db-positions/{user_id}")
async def get_db_positions(user_id: int, db: Session = Depends(get_db)):
    try:
        # First get positions from Kite
        kite_positions = kite.positions()
        kite_open_positions = kite_positions.get('net', [])
        
        logger.info(f"Kite positions: {kite_open_positions}")
        
        # Group Kite positions by instrument (stripping off strike price and option type)
        kite_positions_by_instrument = {}
        for pos in kite_open_positions:
            if pos['quantity'] != 0:
                # Strip off last 7 characters (strikePrice + optionType) to get base instrument
                instrument = pos['tradingsymbol'][:-7]
                if instrument not in kite_positions_by_instrument:
                    kite_positions_by_instrument[instrument] = []
                kite_positions_by_instrument[instrument].append(pos)
        
        logger.info(f"Kite positions by instrument: {kite_positions_by_instrument}")
        
        # Get DB positions
        db_positions = db.query(Position).filter(
            Position.user_id == user_id,
            Position.status == "OPEN"
        ).all()

        positions_data = []
        for position in db_positions:
            latest_trades = db.query(Trade).filter(
                Trade.position_id == position.position_id,
                Trade.status == "OPEN"
            ).all()

            for trade in latest_trades:
                instrument = trade.trading_symbol[:-7]  # Strip off strike+optionType
                
                # Only include if instrument exists in Kite
                if instrument in kite_positions_by_instrument:
                    # Find matching Kite position for this trade
                    kite_position = next(
                        (pos for pos in kite_positions_by_instrument[instrument] 
                         if pos['tradingsymbol'] == trade.trading_symbol),
                        None
                    )
                    
                    if kite_position:
                        positions_data.append({
                            "tradingsymbol": trade.trading_symbol,
                            "quantity": kite_position['quantity'],
                            "average_price": float(kite_position['average_price']),
                            "pnl": float(kite_position['pnl']),
                            "trade_id": trade.trade_id,
                            "current_price": float(kite_position['last_price']) if 'last_price' in kite_position else 0,
                            "order_type": trade.order_type
                        })
                else:
                    # Position doesn't exist in Kite anymore, mark it as closed in our DB
                    trade.status = "CLOSED"
                    if all(t.status == "CLOSED" for t in latest_trades):
                        position.status = "CLOSED"
                        position.end_time = datetime.utcnow()
                    db.commit()

        return {
            "status": "success",
            "data": {
                "net": positions_data
            }
        }

    except Exception as e:
        logger.error(f"Error fetching positions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post("/square-off-trade/{trade_id}")
async def square_off_trade(trade_id: int, db: Session = Depends(get_db)):
    try:
        # Get the original trade
        original_trade = db.query(Trade).filter(Trade.trade_id == trade_id).first()
        if not original_trade:
            raise HTTPException(status_code=404, detail="Trade not found")
        
        if original_trade.status == "CLOSED":
            raise HTTPException(status_code=400, detail="Trade is already closed")

        # Determine opposite action
        square_off_action = "BUY" if original_trade.order_type == "SELL" else "SELL"
        
        # Place the square-off order
        order_params = {
            "tradingsymbol": original_trade.trading_symbol,
            "exchange": "NFO",  # You might want to determine this based on the symbol
            "transaction_type": square_off_action,
            "quantity": int(original_trade.quantity),  # Convert to int
            "product": kite.PRODUCT_NRML,
            "order_type": kite.ORDER_TYPE_MARKET,
            "variety": kite.VARIETY_REGULAR
        }

        # Place order with Kite
        order_id = kite.place_order(**order_params)
        
        # Get current market price
        ltp = kite.ltp(["NFO:" + original_trade.trading_symbol])
        exit_price = float(ltp["NFO:" + original_trade.trading_symbol]['last_price'])  # Convert to float

        # Update the original trade
        original_trade.exit_time = datetime.utcnow()
        original_trade.exit_price = exit_price
        original_trade.status = "CLOSED"
        
        # Calculate P&L using float values
        entry_price = float(original_trade.entry_price)  # Convert Decimal to float
        quantity = int(original_trade.quantity)  # Convert to int
        
        # Calculate P&L
        if original_trade.order_type == "BUY":
            pnl = (exit_price - entry_price) * quantity
        else:
            pnl = (entry_price - exit_price) * quantity
            
        original_trade.pnl = pnl

        # Check if all trades in this position are closed
        position = db.query(Position).filter(Position.position_id == original_trade.position_id).first()
        all_trades = db.query(Trade).filter(Trade.position_id == position.position_id).all()
        
        if all(trade.status == "CLOSED" for trade in all_trades):
            position.status = "CLOSED"
            position.end_time = datetime.utcnow()
            # Convert all PNL values to float before summing
            position.total_pnl = sum(float(trade.pnl) for trade in all_trades if trade.pnl is not None)

        db.commit()

        return {
            "status": "success",
            "message": "Position squared off successfully",
            "order_id": order_id,
            "pnl": pnl,
            "exit_price": exit_price
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Error squaring off position: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))