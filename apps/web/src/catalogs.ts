import { indexCatalogs, parseCatalogJson, type CatalogIndex } from "@nodevault/catalog"

const files = import.meta.glob("../../../catalog/versions/*/catalog.json", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>

export const shippedCatalogs: CatalogIndex = indexCatalogs(
  Object.entries(files).map(([path, text]) => parseCatalogJson(text, path)),
)
