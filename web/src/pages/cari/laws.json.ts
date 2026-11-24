import { searchCatalog } from "../../lib/search-catalog.ts";

export function GET() {
  return Response.json(searchCatalog(import.meta.env.BASE_URL));
}
