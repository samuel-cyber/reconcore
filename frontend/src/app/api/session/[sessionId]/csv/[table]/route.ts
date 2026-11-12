import { NextResponse } from "next/server";
import initFixture from "../../../../../../mocks/init.json";
import { formatCanonicalCsv } from "../../../../../../lib/csv-utils";
import type { TableKey } from "../../../../../../lib/api-types";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [
    { sessionId: initFixture.session_id, table: "pos" },
    { sessionId: initFixture.session_id, table: "waybills" },
    { sessionId: initFixture.session_id, table: "bank" },
  ];
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string; table: string }> }
) {
  const { table } = await context.params;
  if (table !== "pos" && table !== "waybills" && table !== "bank") {
    return NextResponse.json(
      {
        error: {
          code: "invalid_table",
          message: "Table must be one of: pos, waybills, bank.",
        },
      },
      { status: 404 }
    );
  }

  const tableData = initFixture.tables[table as TableKey];
  const csvContent = formatCanonicalCsv(tableData);

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tableData.filename}"`,
    },
  });
}

