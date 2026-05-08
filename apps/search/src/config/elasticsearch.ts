import { Client } from "@elastic/elasticsearch";
import { env } from "./env";

export const esClient = new Client({ node: env.ELASTICSEARCH_URL });

export const INDEX = "products";

export async function createIndex() {
  const exists = await esClient.indices.exists({ index: INDEX });
  if (exists) return;

  await esClient.indices.create({
    index: INDEX,
    // los mappings son el equivalente a un CREATE TABLE
    mappings: {
      properties: {
        id: { type: "keyword" },
        restaurantId: { type: "keyword" },
        menuId: { type: "keyword" },
        nombre: { type: "text", analyzer: "spanish" },
        categoria: {
          type: "text",
          analyzer: "spanish",
          fields: { keyword: { type: "keyword" } },
        },
        descripcion: { type: "text", analyzer: "spanish" },
        precio: { type: "float" },
        disponible: { type: "boolean" },
      },
    },
  });
}
