from dataclasses import dataclass


@dataclass(frozen=True)
class CategoryProfiles:
    harassment: list[float]
    threat: list[float]
    sexual: list[float]


def build_profiles(vector_size: int) -> CategoryProfiles:
    if vector_size < 3:
        raise ValueError("ciphertext vector must contain at least 3 dimensions")

    harassment = [0.0] * vector_size
    threat = [0.0] * vector_size
    sexual = [0.0] * vector_size

    # Final 3 slots are customer-side policy features.
    harassment[-3] = 1.0
    threat[-2] = 1.0
    sexual[-1] = 1.0

    return CategoryProfiles(harassment=harassment, threat=threat, sexual=sexual)
