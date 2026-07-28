"""IDs compatibles con los cuid existentes (strings únicos)."""
from cuid2 import Cuid

_generator = Cuid(length=25)


def new_id() -> str:
    return _generator.generate()
