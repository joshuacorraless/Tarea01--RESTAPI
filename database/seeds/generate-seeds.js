#!/usr/bin/env node
// genera datos de prueba con la api de gemini e inserta en postgres o mongo
// segun DB_ENGINE.
//
// requiere GEMINI_API_KEY en el .env de la raiz.
// uso desde la raiz del proyecto:
//   node database/seeds/generate-seeds.js
//   DB_ENGINE=mongo node database/seeds/generate-seeds.js

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// el .env vive en la raiz del proyecto; lo parseamos a mano para no jalar dotenv
function loadEnv() {
  const envPath = path.join(__dirname, "../../.env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DB_ENGINE = process.env.DB_ENGINE || "postgres";
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/restaurant_db";
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/restaurant_db";
const OUTPUT_FILE = path.join(__dirname, "data.json");

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY no esta definida en el .env");
  console.error("   Conseguila gratis en: https://aistudio.google.com/apikey");
  console.error("   Luego agregala al .env: GEMINI_API_KEY=tu-key-aqui");
  process.exit(1);
}

if (!["postgres", "mongo"].includes(DB_ENGINE)) {
  console.error(
    `DB_ENGINE invalido: "${DB_ENGINE}". Debe ser "postgres" o "mongo".`,
  );
  process.exit(1);
}

const SEED_PROMPT = `Generá datos de prueba realistas en JSON para un sistema de restaurantes costarricense.

Generá exactamente esta estructura JSON y nada más — sin texto adicional, sin markdown, sin bloques de código:

{
  "restaurants": [
    {
      "name": "nombre del restaurante",
      "description": "descripción atractiva",
      "address": "dirección en Costa Rica",
      "phone": "número de teléfono costarricense",
      "opening_hours": "horario de apertura",
      "menus": [
        {
          "nombre": "nombre del menú",
          "detalles": "descripción del menú",
          "items": [
            {
              "nombre": "nombre del plato",
              "detalles": "descripción apetitosa del plato",
              "categoria": "una de: Entradas, Platos Fuertes, Postres, Bebidas, Sopas, Desayunos",
              "precio": 0000
            }
          ]
        }
      ],
      "mesas": [
        {
          "numeroMesa": "1",
          "capacidad": 4
        }
      ]
    }
  ]
}

Requisitos:
- 4 restaurantes costarricenses distintos (soda, marisquería, pizzería, restaurante de fusión)
- Cada restaurante con 2 menús
- Cada menú con 5 ítems de menú variados
- Cada restaurante con 4 mesas con capacidades distintas (2, 4, 6, 8 personas)
- Precios en colones costarricenses (entre 1500 y 15000)
- Nombres de platos típicos o de fusión costarricense
- Direcciones en provincias de Costa Rica
- Teléfonos con formato costarricense (2XXX-XXXX o 8XXX-XXXX)
- Responde ÚNICAMENTE con el JSON, sin ningún texto adicional antes ni después`;

// usamos gemini-2.5-flash via REST, sin SDK
async function generateWithGemini() {
  console.log("Llamando a la API de Gemini para generar datos...");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SEED_PROMPT }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${error}`);
  }

  const data = await response.json();

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

  if (!rawText) {
    throw new Error("Gemini no devolvio contenido. Revisa tu API key.");
  }

  // a veces gemini envuelve el json en ```json ... ``` aunque le pidas que no
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    console.error("Gemini no devolvio JSON valido. Respuesta recibida:");
    console.error(rawText.substring(0, 500));
    throw new Error("La respuesta de Gemini no es JSON valido");
  }
}

function buildPostgresSQL(seedData) {
  const statements = [];

  statements.push(`-- Seeds generados por LLM (Gemini) - no editar manualmente
INSERT INTO users (full_name, email, external_auth_id, role, phone)
VALUES ('Admin Seeds', 'admin-seeds@restaurantes.cr', 'seed-admin-kc-id-00000000', 'restaurant_admin', '8888-0000')
ON CONFLICT (email) DO NOTHING;
`);

  for (const restaurant of seedData.restaurants) {
    statements.push(`-- Restaurante: ${restaurant.name}
INSERT INTO restaurants (name, description, address, phone, opening_hours, admin_user_id)
SELECT ${s(restaurant.name)}, ${s(restaurant.description)}, ${s(restaurant.address)}, ${s(restaurant.phone)}, ${s(restaurant.opening_hours)}, id
FROM users WHERE email = 'admin-seeds@restaurantes.cr';
`);

    statements.push(`INSERT INTO mesas (idRestaurante, numeroMesa, capacidad)
SELECT r.id, v.numero, v.cap FROM
  (SELECT id FROM restaurants WHERE name = ${s(restaurant.name)} ORDER BY created_at DESC LIMIT 1) r,
  (VALUES ${restaurant.mesas.map((m) => `(${s(m.numeroMesa)}, ${m.capacidad})`).join(", ")}) AS v(numero, cap);
`);

    for (const menu of restaurant.menus) {
      statements.push(`INSERT INTO menus (idRestaurante, nombre, detalles)
SELECT id, ${s(menu.nombre)}, ${s(menu.detalles)}
FROM restaurants WHERE name = ${s(restaurant.name)} ORDER BY created_at DESC LIMIT 1;
`);

      statements.push(`INSERT INTO itemsDelMenu (idMenu, nombre, detalles, categoria, precio)
SELECT m.id, v.nombre, v.detalles, v.categoria, v.precio FROM
  (SELECT id FROM menus WHERE nombre = ${s(menu.nombre)}
    AND idRestaurante = (SELECT id FROM restaurants WHERE name = ${s(restaurant.name)} ORDER BY created_at DESC LIMIT 1)
  ) m,
  (VALUES ${menu.items.map((i) => `(${s(i.nombre)}, ${s(i.detalles)}, ${s(i.categoria)}, ${i.precio})`).join(", ")}) AS v(nombre, detalles, categoria, precio);
`);
    }
  }

  return statements.join("\n");
}

function buildMongoScript(seedData) {
  const lines = [];

  lines.push(`// Seeds generados por LLM (Gemini) - no editar manualmente`);
  lines.push(`use('restaurant_db');\n`);

  lines.push(`const adminId = db.users.insertOne({`);
  lines.push(`  fullName: 'Admin Seeds',`);
  lines.push(`  email: 'admin-seeds@restaurantes.cr',`);
  lines.push(`  externalAuthId: 'seed-admin-kc-id-00000000',`);
  lines.push(`  role: 'restaurant_admin',`);
  lines.push(`  phone: '8888-0000',`);
  lines.push(`  createdAt: new Date(), updatedAt: new Date()`);
  lines.push(`}).insertedId;\n`);

  seedData.restaurants.forEach((restaurant, rIdx) => {
    const rVar = `rId${rIdx}`;

    lines.push(`// Restaurante: ${restaurant.name}`);
    lines.push(`const ${rVar} = db.restaurants.insertOne({`);
    lines.push(`  name: ${JSON.stringify(restaurant.name)},`);
    lines.push(`  description: ${JSON.stringify(restaurant.description)},`);
    lines.push(`  address: ${JSON.stringify(restaurant.address)},`);
    lines.push(`  phone: ${JSON.stringify(restaurant.phone)},`);
    lines.push(`  openingHours: ${JSON.stringify(restaurant.opening_hours)},`);
    lines.push(`  adminUserId: adminId,`);
    lines.push(`  createdAt: new Date(), updatedAt: new Date()`);
    lines.push(`}).insertedId;\n`);

    lines.push(`db.mesas.insertMany([`);
    lines.push(
      restaurant.mesas
        .map(
          (m) =>
            `  { idRestaurante: ${rVar}, numeroMesa: ${JSON.stringify(m.numeroMesa)}, capacidad: ${m.capacidad}, disponible: true, creadoEn: new Date(), ultimaActualizacion: new Date() }`,
        )
        .join(",\n"),
    );
    lines.push(`]);\n`);

    restaurant.menus.forEach((menu, mIdx) => {
      const mVar = `mId${rIdx}_${mIdx}`;

      lines.push(`const ${mVar} = db.menus.insertOne({`);
      lines.push(`  idRestaurante: ${rVar},`);
      lines.push(`  nombre: ${JSON.stringify(menu.nombre)},`);
      lines.push(`  detalles: ${JSON.stringify(menu.detalles)},`);
      lines.push(`  activo: true,`);
      lines.push(`  creadoEn: new Date(), ultimaActualizacion: new Date()`);
      lines.push(`}).insertedId;\n`);

      lines.push(`db.menuitems.insertMany([`);
      lines.push(
        menu.items
          .map(
            (item) =>
              `  { idMenu: ${mVar}, nombre: ${JSON.stringify(item.nombre)}, detalles: ${JSON.stringify(item.detalles)}, categoria: ${JSON.stringify(item.categoria)}, precio: ${item.precio}, disponible: true, creadoEn: new Date(), ultimaActualizacion: new Date() }`,
          )
          .join(",\n"),
      );
      lines.push(`]);\n`);
    });
  });

  lines.push(`print('Seeds insertados correctamente en MongoDB');`);
  return lines.join("\n");
}

// escapa strings para SQL
function s(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  console.log(
    `Generando seeds con Gemini - engine: ${DB_ENGINE.toUpperCase()}\n`,
  );

  let seedData;
  try {
    seedData = await generateWithGemini();
    console.log(
      `Gemini genero datos para ${seedData.restaurants.length} restaurantes`,
    );
  } catch (err) {
    console.error("Error al llamar a Gemini:", err.message);
    process.exit(1);
  }

  // guardamos el json crudo como evidencia del uso del llm
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(seedData, null, 2), "utf-8");
  console.log(`Datos guardados en: ${OUTPUT_FILE}`);

  if (DB_ENGINE === "postgres") {
    const sqlFile = path.join(__dirname, "seed.sql");
    fs.writeFileSync(sqlFile, buildPostgresSQL(seedData), "utf-8");
    console.log(`SQL generado en: ${sqlFile}`);

    console.log("\nInsertando en PostgreSQL via kubectl...");
    const namespace = process.env.K8S_NAMESPACE || "proyecto01-restaurante";
    const pod = process.env.K8S_POSTGRES_POD || "postgres-0";
    try {
      const sqlContent = fs.readFileSync(sqlFile, "utf-8");
      execSync(
        `kubectl exec -i -n ${namespace} ${pod} -- psql -U postgres -d restaurant_db`,
        { input: sqlContent, stdio: ["pipe", "inherit", "inherit"] },
      );
    } catch {
      console.error("Error al ejecutar SQL via kubectl.");
      process.exit(1);
    }
  } else {
    const mongoFile = path.join(__dirname, "seed.mongo.js");
    fs.writeFileSync(mongoFile, buildMongoScript(seedData), "utf-8");
    console.log(`Script MongoDB generado en: ${mongoFile}`);

    console.log("\nInsertando en MongoDB via kubectl...");

    const namespace = process.env.K8S_NAMESPACE || "proyecto01-restaurante";

    try {
      const mongosPod = execSync(
        `kubectl get pod -n ${namespace} -l app=mongos -o jsonpath='{.items[0].metadata.name}'`
      ).toString().trim().replace(/'/g, "");

      const scriptContent = fs.readFileSync(mongoFile, "utf-8");

      execSync(
        `kubectl exec -i -n ${namespace} ${mongosPod} -- mongosh mongodb://localhost:27017/restaurant_db`,
        { input: scriptContent, stdio: ["pipe", "inherit", "inherit"] }
      );
    } catch (err) {
      console.error("Error al insertar en MongoDB via kubectl:", err.message);
      process.exit(1);
    }
  }

  const totalMenus = seedData.restaurants.reduce(
    (acc, r) => acc + r.menus.length,
    0,
  );
  const totalItems = seedData.restaurants.reduce(
    (acc, r) => acc + r.menus.reduce((a, m) => a + m.items.length, 0),
    0,
  );
  const totalMesas = seedData.restaurants.reduce(
    (acc, r) => acc + r.mesas.length,
    0,
  );

  console.log("\nResumen:");
  console.log(`   Restaurantes : ${seedData.restaurants.length}`);
  console.log(`   Menus        : ${totalMenus}`);
  console.log(`   Items de menu: ${totalItems}`);
  console.log(`   Mesas        : ${totalMesas}`);
  console.log("\nListo. Indexa en ElasticSearch con: POST /search/reindex");
}

main();
