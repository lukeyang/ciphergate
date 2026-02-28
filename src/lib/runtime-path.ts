import path from "node:path";

function resolveRuntimeBaseDir(): string {
  const configured = process.env.CIPHERGATE_RUNTIME_DIR?.trim();
  if (configured) {
    return configured;
  }

  // Cloud Run demo deployments should keep ephemeral runtime files in /tmp.
  if (process.env.NODE_ENV === "production") {
    return "/tmp/ciphergate";
  }

  return path.join(process.cwd(), "customer-gateway");
}

export function runtimePath(...parts: string[]): string {
  return path.join(resolveRuntimeBaseDir(), ...parts);
}

