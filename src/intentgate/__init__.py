"""IntentGate: deterministic admission control for untrusted AI proposals."""

from .engine import ARTIFACT_FORMAT, run_scenario
from .model import FORMAT, Scenario, parse_scenario

__all__ = ["ARTIFACT_FORMAT", "FORMAT", "Scenario", "parse_scenario", "run_scenario"]
__version__ = "0.1.0"
