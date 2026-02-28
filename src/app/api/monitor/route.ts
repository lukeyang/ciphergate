import { NextResponse } from "next/server";

import { listMonitorEntries } from "@/lib/monitor-store";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse<{ entries: ReturnType<typeof listMonitorEntries> }>> {
  return NextResponse.json({ entries: listMonitorEntries() }, { status: 200 });
}
