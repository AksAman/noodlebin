import { indexCatalogs, parseCatalogJson, type CatalogIndex } from "@/catalog"
import catalog51 from "@/catalog-data/versions/5.1.0/catalog.json"
import catalog52 from "@/catalog-data/versions/5.2.2_LTS/catalog.json"

export const shippedCatalogs: CatalogIndex = indexCatalogs([
  parseCatalogJson(JSON.stringify(catalog51), "5.1.0/catalog.json"),
  parseCatalogJson(JSON.stringify(catalog52), "5.2.2_LTS/catalog.json"),
])
