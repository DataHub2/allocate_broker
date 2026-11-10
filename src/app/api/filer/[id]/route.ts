import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { deleteFile, NotFound, readFile } from "@/lib/marketplace";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await context.params;
  try {
    const file = await readFile(await getDb(), user.id, user.is_admin, id);
    return new NextResponse(Buffer.from(file.data), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${file.mime === "application/pdf" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      },
    });
  } catch (error) {
    if (error instanceof NotFound) return new NextResponse(null, { status: 404 });
    throw error;
  }
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await context.params;
  try {
    await deleteFile(await getDb(), user.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof NotFound) return new NextResponse(null, { status: 404 });
    throw error;
  }
}
