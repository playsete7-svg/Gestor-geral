/**
 * SUPREMO BRIDGE — Configuracao Compartilhada
 * =============================================
 * Este arquivo centraliza as credenciais Firebase de cada modulo
 * do ecossistema Supremo Delivery.
 *
 * Cada modulo importa este config para saber como se conectar
 * aos outros projetos Firebase via app secundario (initializeApp com nome).
 *
 * IMPORTANTE: Estas sao Web API Keys do Firebase (publicas por design).
 * A seguranca real vem das regras do Firestore, nao das chaves.
 * Para producao, mover escrita cross-project para Cloud Functions.
 */

const SUPREMO_BRIDGE_CONFIG = {
  // Marketplace / Vitrine
  marketplace: {
    apiKey: "AIzaSyDuFwPXFdUomE5Zqa1vXhoy1nAZ5pJ5cyw",
    authDomain: "marketing-place-3543e.firebaseapp.com",
    projectId: "marketing-place-3543e",
    storageBucket: "marketing-place-3543e.firebasestorage.app",
    messagingSenderId: "801531622226",
    appId: "1:801531622226:web:c9748e920080347d0a808b",
  },

  // Loja / PDV (exemplo: Hamburgueria do Bairro)
  // Em producao, cada loja tera suas proprias credenciais
  store: {
    apiKey: "AIzaSyBYxYq65hf2zwBTKrwuFAg5AmS5iM88aLU",
    authDomain: "luk123-b1986.firebaseapp.com",
    projectId: "luk123-b1986",
    storageBucket: "luk123-b1986.firebasestorage.app",
    messagingSenderId: "55447377903",
    appId: "1:55447377903:web:e9cbbcdba3a4ed5dc4081a",
  },

  // Central de Motoboys
  motoboy: {
    apiKey: "AIzaSyDwx7sBHIGuiSKcFqywTIa8Y5_smkRkXiU",
    authDomain: "central-de-motoboy.firebaseapp.com",
    projectId: "central-de-motoboy",
    storageBucket: "central-de-motoboy.firebasestorage.app",
    messagingSenderId: "876410209893",
    appId: "1:876410209893:web:fa26c23c3aa9bfdfd3688c",
  },

  // Central de Clientes (CRM)
  customers: {
    apiKey: "AIzaSyCffyL9l3qZDJkRiR6ZZhfmUQfIp7jmRMM",
    authDomain: "central-de-clientes-2741f.firebaseapp.com",
    projectId: "central-de-clientes-2741f",
    storageBucket: "central-de-clientes-2741f.firebasestorage.app",
    messagingSenderId: "378564769320",
    appId: "1:378564769320:web:375a6dadde993f9d7e671d",
  },

  // Gestor Geral
  gestor: {
    apiKey: "AIzaSyBhHyvuDpg-ns9ABCc78yyzcdFjom52how",
    authDomain: "gestor-geral-6ce8d.firebaseapp.com",
    projectId: "gestor-geral-6ce8d",
    storageBucket: "gestor-geral-6ce8d.firebasestorage.app",
    messagingSenderId: "208252049701",
    appId: "1:208252049701:web:7662067e73dbc77e2722cc",
  },
};

// Colecoes padrao de cada sistema
const SUPREMO_COLLECTIONS = {
  marketplace: {
    stores: "stores",
    orders: "orders",
    users: "users",
    campaigns: "campaigns",
    catalogControls: "catalogControls",
  },
  store: {
    orders: "orders",
    products: "produtos",
    menuConfig: "config/cardapioData",
    users: "users",
    motoboys: "motoboys",
  },
  motoboy: {
    rides: "rides",
    motoboys: "motoboys",
    courierApplications: "courierApplications",
    courierInfractions: "courierInfractions",
  },
  customers: {
    users: "users",
    orders: "orders",
    marketingActions: "marketingActions",
    systemEvents: "systemEvents",
  },
  gestor: {
    orders: "orders",
    users: "users",
    motoboys: "motoboys",
    auditLogs: "auditLogs",
    systemEvents: "systemEvents",
    marketingActions: "marketingActions",
    config: "config/gestorGeral",
  },
};

// Helper: converter valor JS para campo do Firestore (REST API)
function supremoFirestoreField(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(supremoFirestoreField) } };
  if (typeof value === "object") return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([k, v]) => [k, supremoFirestoreField(v)])) } };
  return { stringValue: String(value) };
}

// Helper: converter campo do Firestore (REST API) para valor JS
function supremoFirestoreVal(field) {
  if (!field) return null;
  if (field.nullValue !== undefined) return null;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.timestampValue !== undefined) return field.timestampValue;
  if (field.arrayValue?.values) return field.arrayValue.values.map(supremoFirestoreVal);
  if (field.mapValue?.fields) return Object.fromEntries(Object.entries(field.mapValue.fields).map(([k, v]) => [k, supremoFirestoreVal(v)]));
  return null;
}

// Helper: PATCH em um documento Firestore via REST (sem precisar de SDK secundario)
async function supremoRestWrite(projectId, apiKey, collectionPath, docId, data) {
  const path = collectionPath.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const safeId = encodeURIComponent(String(docId));
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}/${safeId}?key=${encodeURIComponent(apiKey)}`;
  const payload = { fields: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, supremoFirestoreField(v)])) };
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Firestore ${projectId} ${response.status}: ${await response.text()}`);
  return { ok: true, projectId, docId };
}

// Helper: GET de uma colecao Firestore via REST
async function supremoRestReadCollection(projectId, apiKey, collectionPath) {
  const path = collectionPath.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}?pageSize=100&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Firestore ${projectId} ${response.status}`);
  const body = await response.json();
  return (body.documents || []).map(doc => {
    const id = String(doc.name || "").split("/").pop();
    return { id, ...Object.fromEntries(Object.entries(doc.fields || {}).map(([k, v]) => [k, supremoFirestoreVal(v)])) };
  });
}

async function supremoRestReadDocument(projectId, apiKey, collectionPath, docId) {
  const path = collectionPath.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const safeId = encodeURIComponent(String(docId));
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}/${safeId}?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore ${projectId} ${response.status}: ${await response.text()}`);
  const document = await response.json();
  return { id: String(document.name || "").split("/").pop(), ...Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, supremoFirestoreVal(value)])) };
}

function supremoMergePatch(base, patch) {
  const result = { ...(base || {}) };
  Object.entries(patch || {}).forEach(([key, value]) => {
    if (!key.includes(".")) { result[key] = value; return; }
    const parts = key.split(".");
    let cursor = result;
    parts.slice(0, -1).forEach(part => { if (!cursor[part] || typeof cursor[part] !== "object" || Array.isArray(cursor[part])) cursor[part] = {}; cursor = cursor[part]; });
    cursor[parts.at(-1)] = value;
  });
  return result;
}

async function supremoRestMergeWrite(projectId, apiKey, collectionPath, docId, patch) {
  const existing = await supremoRestReadDocument(projectId, apiKey, collectionPath, docId);
  return supremoRestWrite(projectId, apiKey, collectionPath, docId, supremoMergePatch(existing || {}, patch));
}

// Helper: publicar evento no barramento do gestor
async function supremoPublishEvent(system, type, severity, message, entityId, payload) {
  const cfg = SUPREMO_BRIDGE_CONFIG.gestor;
  const event = {
    system,
    type,
    severity: severity || "info",
    message: message || "Evento recebido",
    entityId: entityId || null,
    payload: payload || {},
    source: system,
    createdAt: new Date().toISOString(),
  };
  try {
    // Usa addDoc via REST (cria ID automatico)
    const path = encodeURIComponent(SUPREMO_COLLECTIONS.gestor.systemEvents);
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/(default)/documents/${path}?key=${encodeURIComponent(cfg.apiKey)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(event).map(([k, v]) => [k, supremoFirestoreField(v)])) }),
    });
    return { ok: response.ok };
  } catch (e) {
    console.warn("[SupremoBridge] Falha ao publicar evento:", e);
    return { ok: false, error: e.message };
  }
}

// Disponibilizar globalmente
if (typeof window !== "undefined") {
  window.SUPREMO_BRIDGE_CONFIG = SUPREMO_BRIDGE_CONFIG;
  window.SUPREMO_COLLECTIONS = SUPREMO_COLLECTIONS;
  window.supremoFirestoreField = supremoFirestoreField;
  window.supremoFirestoreVal = supremoFirestoreVal;
  window.supremoRestWrite = supremoRestWrite;
  window.supremoRestReadCollection = supremoRestReadCollection;
  window.supremoRestReadDocument = supremoRestReadDocument;
  window.supremoRestMergeWrite = supremoRestMergeWrite;
  window.supremoPublishEvent = supremoPublishEvent;
}
