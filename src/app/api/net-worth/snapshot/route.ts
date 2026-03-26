export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { saveSnapshot } from "@/lib/net-worth";

export async function POST() {
  try {
    const snapshot = await saveSnapshot();
    return NextResponse.json({
      ...snapshot,
      cashTotal: Number(snapshot.cashTotal),
      investmentsTotal: Number(snapshot.investmentsTotal),
      total: Number(snapshot.total),
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Nepodařilo se uložit snapshot" }, { status: 500 });
  }
}
