from pathlib import Path

import tenseal as ts


class PolicyServerSecurityError(RuntimeError):
    pass


def load_public_context(context_path: str) -> ts.Context:
    path = Path(context_path)
    if not path.exists():
        raise PolicyServerSecurityError(f"Public context not found: {context_path}")

    context = ts.context_from(path.read_bytes())

    # Guardrail: policy server must never run with a private context.
    is_private = getattr(context, "is_private", None)
    if callable(is_private) and is_private():
        raise PolicyServerSecurityError("Secret key detected in policy-server context")

    return context
