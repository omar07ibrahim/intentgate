"""IntentGate error hierarchy."""


class IntentGateError(Exception):
    """Base class for expected IntentGate failures."""


class ContractError(IntentGateError):
    """Raised when untrusted input violates a bounded data contract."""


class VerificationError(IntentGateError):
    """Raised when a decision artifact cannot be independently verified."""
