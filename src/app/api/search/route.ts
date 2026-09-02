import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "../../../lib/db/connect";
import { Drug } from "../../../lib/db/models/Drug";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    await connectToDatabase();
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const docs = await Drug.find({
      $or: [{ name: regex }, { genericName: regex }, { synonyms: regex }],
    })
      .limit(10)
      .lean();

    const results = docs.map((d) => ({
      id: d._id,
      name: d.name,
      genericName: d.genericName,
      drugClass: d.drugClass,
      isSampleData: d.isSampleData,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: "Search is temporarily unavailable.", detail: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    );
  }
}
