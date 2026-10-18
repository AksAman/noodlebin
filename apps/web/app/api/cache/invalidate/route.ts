import { invalidatePostLists } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  invalidatePostLists();
  return NextResponse.json(null);
}
