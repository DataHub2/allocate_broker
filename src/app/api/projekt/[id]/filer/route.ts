import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { addFile, LIMITS, NotFound, UserError } from "@/lib/marketplace";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Du behöver logga in." }, { status: 401 });
  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Ingen fil skickades." }, { status: 400 });
  if (file.size > LIMITS.maxFileBytes) return NextResponse.json({ error: "Filen är för stor. Den får vara högst 4 MB." }, { status: 413 });
  try {
    const meta = await addFile(await getDb(), user.id, id, {
      kind: form.get("kind") === "drawing" ? "drawing" : "photo",
      name: file.name,
      data: new Uint8Array(await file.arrayBuffer()),
      questionId: typeof form.get("questionId") === "string" ? String(form.get("questionId")) : null,
    });
    return NextResponse.json(meta);
  } catch (error) {
    if (error instanceof UserError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof NotFound) return NextResponse.json({ error: "Jobbet finns inte." }, { status: 404 });
    throw error;
  }
}
