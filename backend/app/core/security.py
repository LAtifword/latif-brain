from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_pin(pin: str) -> str:
    return _pwd_context.hash(pin)


def verify_pin(pin: str, pin_hash: str) -> bool:
    return _pwd_context.verify(pin, pin_hash)
