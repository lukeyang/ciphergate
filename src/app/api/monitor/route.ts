import { NextResponse } from "next/server";

import { listDebugEntries } from "@/lib/debug-log-store";
import { listMonitorEntries } from "@/lib/monitor-store";
import { getPolicyTuningPaths } from "@/lib/policy-tuning";

export const runtime = "nodejs";

export async function GET(): Promise<
  NextResponse<{
    entries: ReturnType<typeof listMonitorEntries>;
    debugEntries: ReturnType<typeof listDebugEntries>;
    tuning: ReturnType<typeof getPolicyTuningPaths>;
  }>
> {
  return NextResponse.json(
    {
      entries: listMonitorEntries(),
      debugEntries: listDebugEntries(),
      tuning: getPolicyTuningPaths(),
    },
    { status: 200 }
  );
}
