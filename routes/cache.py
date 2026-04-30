import os
from redis.sentinel import Sentinel
from dotenv import load_dotenv

load_dotenv()

SENTINEL_HOST  = os.getenv("SENTINEL_HOST", "localhost")
SENTINEL_PORT  = int(os.getenv("SENTINEL_PORT", 26379))
MASTER_NAME    = os.getenv("REDIS_MASTER_NAME", "mymaster")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
 
_sentinel = Sentinel(
    [(SENTINEL_HOST, SENTINEL_PORT)],
    socket_timeout=2,
    password=REDIS_PASSWORD
)

def get_master():
    return _sentinel.master_for(MASTER_NAME, socket_timeout=2, password=REDIS_PASSWORD)
 
def get_slave():
    return _sentinel.slave_for(MASTER_NAME, socket_timeout=2, password=REDIS_PASSWORD)