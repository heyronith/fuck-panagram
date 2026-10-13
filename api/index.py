import sys
from pathlib import Path

# Add project root directory to sys.path so app and its modules import seamlessly
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

from app import app
