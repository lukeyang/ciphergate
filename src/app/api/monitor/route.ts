import { NextResponse } from "next/server";

import { listDebugEntries } from "@/lib/debug-log-store";
import { listMonitorEntries } from "@/lib/monitor-store";

export const runtime = "nodejs";

export async function GET(): Promise<
  NextResponse<{ entries: ReturnType<typeof listMonitorEntries>; debugEntries: ReturnType<typeof listDebugEntries> }>
> {
  return NextResponse.json({ entries: listMonitorEntries(), debugEntries: listDebugEntries() }, { status: 200 });
}
