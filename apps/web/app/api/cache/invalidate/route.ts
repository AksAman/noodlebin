import { invalidatePostLists } from "@/lib/store";
import { notFound } from "next/navigation";

export async function GET(request: Request) {
  invalidatePostLists();
  return notFound();
}
