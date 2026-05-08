import { esClient, INDEX, createIndex } from '../config/elasticsearch';

export interface ProductDocument {
  id: string;
  restaurantId: string;
  menuId: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  precio: number;
  disponible: boolean;
}

export async function searchByText(query: string): Promise<ProductDocument[]> {
  const result = await esClient.search<ProductDocument>({
    index: INDEX,
    query: {
      // multi_match busca el query en varios campos a la vez
      multi_match: {
        query,
        fields: ['nombre^3', 'categoria^2', 'descripcion'],
      },
    },
  });

  return result.hits.hits.map(h => h._source as ProductDocument);
}

export async function searchByCategory(categoria: string): Promise<ProductDocument[]> {
  const result = await esClient.search<ProductDocument>({
    index: INDEX,
    query: {
      match: { categoria },
    },
  });

  return result.hits.hits.map(h => h._source as ProductDocument);
}

export async function reindex(products: ProductDocument[]): Promise<{ indexed: number }> {
  await esClient.indices.delete({ index: INDEX, ignore_unavailable: true });
  await createIndex();

  if (products.length === 0) return { indexed: 0 };

  const operations = products.flatMap(p => [
    { index: { _index: INDEX, _id: p.id } },
    {
      ...p,
      descripcion: p.descripcion?.trim() || 'Producto sin descripción',
    },
  ]);

  // bulk manda todo de un solo viaje, evita N requests a ES
  const result = await esClient.bulk({ operations, refresh: true });

  if (result.errors) {
    const failed = result.items.filter(i => i.index?.error);
    console.error('Bulk index errors:', failed);
  }

  return { indexed: products.length };
}