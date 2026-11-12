import { NextResponse } from "next/server";
import initFixture from "../../../../../mocks/init.json";
import {
  buildZipArchive,
  formatCanonicalCsv,
} from "../../../../../lib/csv-utils";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ sessionId: initFixture.session_id }];
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await context.params;
  const zipBytes = buildZipArchive([
    {
      filename: initFixture.tables.pos.filename,
      content: formatCanonicalCsv(initFixture.tables.pos),
    },
    {
      filename: initFixture.tables.waybills.filename,
      content: formatCanonicalCsv(initFixture.tables.waybills),
    },
    {
      filename: initFixture.tables.bank.filename,
      content: formatCanonicalCsv(initFixture.tables.bank),
    },
  ]);

  return new NextResponse(Buffer.from(zipBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="reconcore_${sessionId}_csvs.zip"`,
    },
  });
}

