/**
 * BRIDGE 4: Gestor Geral → Todos os Sistemas
 * =============================================
 * Problema: O gestor le orders, users e motoboys do seu PROPRIO
 *   Firebase (gestor-geral-6ce8d), que ninguem alimenta.
 *   Ele mostra dados fantasmas, nao a realidade.
 *   O bridge existente so conecta com central-de-clientes.
 *
 * Solucao: Adicionar bridges (apps secundarios) para TODOS os
 *   projetos Firebase do ecossistema: loja, central de motoboys
 *   e marketplace. Ler apenas as colecoes necessarias de cada um.
 *
 * INTEGRACAO:
 *   No gestor-geral-enterprise.html, apos a inicializacao do
 *   Firebase principal e do customerBridgeApp existente, adicionar:
 *
 *   <script src="supremo-bridge-config.js"></script>
 *   <script src="bridge-gestor-all-systems.js"></script>
 *
 *   E chamar initGestorBridges() no DOMContentLoaded ou apos
 *   a inicializacao existente.
 */

// Apps secundarios para cada sistema
let storeBridgeDb = null;
let storeBridgeDbs = [];
let motoboyBridgeDb = null;
let marketplaceBridgeDb = null;
// customerBridgeDb ja existe no gestor-geral-enterprise.html

// Estado dos bridges
const bridgeState = {
  store: { connected: false, error: null },
  motoboy: { connected: false, error: null },
  marketplace: { connected: false, error: null },
};

/**
 * Inicializa todos os bridges do gestor.
 * Cria apps Firebase secundarios para cada sistema e comeca a escutar.
 */
async function initGestorBridges() {
  try {
    const { initializeApp } = await import(
      "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js"
    );
    const firestore = await import(
      "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"
    );

    // === BRIDGE: LOJA ===
    // Le orders e users da loja para ter dados reais de pedidos
    try {
      const storeApp = initializeApp(SUPREMO_BRIDGE_CONFIG.store, "store-bridge-gestor");
      storeBridgeDb = firestore.getFirestore(storeApp);
      bridgeState.store.connected = true;
      console.log("[Bridge4] Bridge da loja conectado:", SUPREMO_BRIDGE_CONFIG.store.projectId);
    } catch (e) {
      bridgeState.store.error = e.message;
      console.warn("[Bridge4] Falha no bridge da loja:", e);
    }

    // Lojas adicionais podem ser cadastradas em SUPREMO_BRIDGE_CONFIG.stores.
    // Cada loja mantém suas próprias credenciais e os dados são etiquetados pela origem.
    storeBridgeDbs = [storeBridgeDb].filter(Boolean);
    for (const [index, storeConfig] of (Array.isArray(SUPREMO_BRIDGE_CONFIG.stores) ? SUPREMO_BRIDGE_CONFIG.stores : []).entries()) {
      try {
        const app = initializeApp(storeConfig, `store-bridge-gestor-${index + 2}`);
        storeBridgeDbs.push(firestore.getFirestore(app));
        bridgeState.store.connected = true;
      } catch (e) {
        bridgeState.store.error = e.message;
        console.warn("[Bridge4] Falha em uma loja adicional:", e);
      }
    }

    // === BRIDGE: CENTRAL DE MOTOBOYS ===
    // Le rides e motoboys para supervisionar a logistica real
    try {
      const motoboyApp = initializeApp(SUPREMO_BRIDGE_CONFIG.motoboy, "motoboy-bridge-gestor");
      motoboyBridgeDb = firestore.getFirestore(motoboyApp);
      bridgeState.motoboy.connected = true;
      console.log("[Bridge4] Bridge de motoboys conectado:", SUPREMO_BRIDGE_CONFIG.motoboy.projectId);
    } catch (e) {
      bridgeState.motoboy.error = e.message;
      console.warn("[Bridge4] Falha no bridge de motoboys:", e);
    }

    // === BRIDGE: MARKETPLACE ===
    // Le stores e orders do marketplace para supervisionar a vitrine
    try {
      const marketplaceApp = initializeApp(SUPREMO_BRIDGE_CONFIG.marketplace, "marketplace-bridge-gestor");
      marketplaceBridgeDb = firestore.getFirestore(marketplaceApp);
      bridgeState.marketplace.connected = true;
      console.log("[Bridge4] Bridge do marketplace conectado:", SUPREMO_BRIDGE_CONFIG.marketplace.projectId);
    } catch (e) {
      bridgeState.marketplace.error = e.message;
      console.warn("[Bridge4] Falha no bridge do marketplace:", e);
    }

    // Iniciar listeners de tempo real
    subscribeAdditionalStoreBridges(firestore);
    subscribeBridgeRealtime(firestore);

    return bridgeState;
  } catch (error) {
    console.error("[Bridge4] Falha geral ao inicializar bridges:", error);
    return bridgeState;
  }
}

/**
 * Escuta clientes, pedidos e produtos de lojas adicionais configuradas.
 * A primeira loja continua usando os listeners legados abaixo; as demais são
 * mescladas nos mesmos arrays para que a Central opere sobre todas as origens.
 */
function subscribeAdditionalStoreBridges(firestore) {
  const { collection, onSnapshot } = firestore;
  const stores = storeBridgeDbs.slice(1);
  if (!stores.length) return;
  const buckets = stores.map(() => ({ orders: [], users: [], products: [] }));
  const publish = () => {
    window._bridgeStoreOrders = [...(window._bridgeStoreOrders || []).filter(row => row._storeBridgeIndex === undefined), ...buckets.flatMap(bucket => bucket.orders)];
    window._bridgeStoreUsers = [...(window._bridgeStoreUsers || []).filter(row => row._storeBridgeIndex === undefined), ...buckets.flatMap(bucket => bucket.users)];
    window._bridgeStoreProducts = [...(window._bridgeStoreProducts || []).filter(row => row._storeBridgeIndex === undefined), ...buckets.flatMap(bucket => bucket.products)];
    window.dispatchEvent(new CustomEvent("gestor:bridge-store-users", { detail: window._bridgeStoreUsers }));
    window.dispatchEvent(new CustomEvent("gestor:bridge-store-orders", { detail: window._bridgeStoreOrders }));
    window.dispatchEvent(new CustomEvent("gestor:bridge-store-products", { detail: window._bridgeStoreProducts }));
    updateGestorConsolidated();
  };
  stores.forEach((db, index) => {
    const source = index + 1;
    onSnapshot(collection(db, "orders"), snap => { buckets[index].orders = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: `store_${source}`, _storeBridgeIndex: source })); publish(); }, err => { bridgeState.store.error = err.message; });
    onSnapshot(collection(db, "users"), snap => { buckets[index].users = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: `store_${source}`, _storeBridgeIndex: source })); publish(); }, err => { bridgeState.store.error = err.message; });
    onSnapshot(collection(db, "produtos"), snap => { buckets[index].products = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: `store_${source}`, _storeBridgeIndex: source })); publish(); }, err => { bridgeState.store.error = err.message; });
  });
}

/**
 * Escuta colecoes em tempo real de cada sistema conectado.
 * @param {Object} firestore - modulo firebase-firestore importado
 */
function subscribeBridgeRealtime(firestore) {
  const { collection, onSnapshot, query, where } = firestore;

  // === Loja: orders (pedidos reais) ===
  if (storeBridgeDb) {
    try {
      onSnapshot(
        collection(storeBridgeDb, "orders"),
        (snap) => {
          const storeOrders = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "store" }));
          window._bridgeStoreOrders = storeOrders;
          window.dispatchEvent(new CustomEvent("gestor:bridge-store-orders", { detail: storeOrders }));
          updateGestorConsolidated();
        },
        (err) => { bridgeState.store.error = err.message; console.warn("[Bridge4] Listener loja orders erro:", err); }
      );
    } catch (e) { console.warn("[Bridge4] Nao foi possivel escutar orders da loja:", e); }
      onSnapshot(
        collection(storeBridgeDb, "users"),
        (snap) => {
          const users = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "store" }));
          window._bridgeStoreUsers = users;
          window.dispatchEvent(new CustomEvent("gestor:bridge-store-users", { detail: users }));
          updateGestorConsolidated();
        },
        (err) => { bridgeState.store.error = err.message; }
      );

      onSnapshot(
        collection(storeBridgeDb, "produtos"),
        (snap) => {
          const products = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "store" }));
          window._bridgeStoreProducts = products;
          window.dispatchEvent(new CustomEvent("gestor:bridge-store-products", { detail: products }));
          updateGestorConsolidated();
        },
        (err) => { bridgeState.store.error = err.message; }
      );
  }

  // === Central Motoboy: rides + motoboys ===
  if (motoboyBridgeDb) {
    try {
      onSnapshot(
        collection(motoboyBridgeDb, "rides"),
        (snap) => {
          const rides = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "motoboy" }));
          window._bridgeRides = rides;
          window.dispatchEvent(new CustomEvent("gestor:bridge-rides", { detail: rides }));
          updateGestorConsolidated();
        },
        (err) => { bridgeState.motoboy.error = err.message; }
      );

      onSnapshot(
        collection(motoboyBridgeDb, "motoboys"),
        (snap) => {
          const couriers = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "motoboy" }));
          window._bridgeCouriers = couriers;
          window.dispatchEvent(new CustomEvent("gestor:bridge-couriers", { detail: couriers }));
          updateGestorConsolidated();
        },
        (err) => { bridgeState.motoboy.error = err.message; }
      );
    } catch (e) { console.warn("[Bridge4] Nao foi possivel escutar rides/motoboys:", e); }
      onSnapshot(
        collection(motoboyBridgeDb, "courierInfractions"),
        (snap) => {
          const infractions = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "motoboy" }));
          window._bridgeInfractions = infractions;
          window.dispatchEvent(new CustomEvent("gestor:bridge-infractions", { detail: infractions }));
          updateGestorConsolidated();
        },
        (err) => { bridgeState.motoboy.error = err.message; }
      );

      onSnapshot(
        collection(motoboyBridgeDb, "courierApplications"),
        (snap) => {
          const applications = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "motoboy" }));
          window._bridgeCourierApplications = applications;
          window.dispatchEvent(new CustomEvent("gestor:bridge-courier-applications", { detail: applications }));
          updateGestorConsolidated();
        },
        (err) => { bridgeState.motoboy.error = err.message; }
      );
  }

  // === Marketplace: stores ===
  if (marketplaceBridgeDb) {
    try {
      onSnapshot(
        collection(marketplaceBridgeDb, "stores"),
        (snap) => {
          const stores = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "marketplace" }));
          window._bridgeMarketplaceStores = stores;
          window.dispatchEvent(new CustomEvent("gestor:bridge-stores", { detail: stores }));
          updateGestorConsolidated();
        },
        (err) => { bridgeState.marketplace.error = err.message; }
      );
    } catch (e) { console.warn("[Bridge4] Nao foi possivel escitar stores do marketplace:", e); }
      onSnapshot(
        collection(marketplaceBridgeDb, "users"),
        (snap) => {
          const users = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "marketplace" }));
          window._bridgeMarketplaceUsers = users;
          window.dispatchEvent(new CustomEvent("gestor:bridge-marketplace-users", { detail: users }));
          updateGestorConsolidated();
        },
        (err) => { bridgeState.marketplace.error = err.message; }
      );

      onSnapshot(
        collection(marketplaceBridgeDb, "orders"),
        (snap) => {
          const orders = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "marketplace" }));
          window._bridgeMarketplaceOrders = orders;
          window.dispatchEvent(new CustomEvent("gestor:bridge-marketplace-orders", { detail: orders }));
          updateGestorConsolidated();
        },
        (err) => { bridgeState.marketplace.error = err.message; }
      );

      ["courierApplications", "storeApplications"].forEach(collectionName => {
        onSnapshot(collection(marketplaceBridgeDb, collectionName), (snap) => {
          const rows = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "marketplace" }));
          window[`_bridge${collectionName}`] = rows;
          window.dispatchEvent(new CustomEvent(`gestor:bridge-${collectionName}`, { detail: rows }));
          updateGestorConsolidated();
        }, (err) => { bridgeState.marketplace.error = err.message; });
      });
  }
}

/**
 * Consolida dados de todos os bridges em uma visao unificada.
 * Substitui os dados fantasmas que o gestor mostrava do seu proprio Firebase.
 */
function updateGestorConsolidated() {
  const storeOrders = window._bridgeStoreOrders || [];
  const storeUsers = window._bridgeStoreUsers || [];
  const storeProducts = window._bridgeStoreProducts || [];
  const rides = window._bridgeRides || [];
  const couriers = window._bridgeCouriers || [];
  const infractions = window._bridgeInfractions || [];
  const courierApplications = [...(window._bridgeCourierApplications || []), ...(window._bridgecourierApplications || [])];
  const storeApplications = window._bridgestoreApplications || [];
  const marketplaceStores = window._bridgeMarketplaceStores || [];
  const marketplaceUsers = window._bridgeMarketplaceUsers || [];
  const marketplaceOrders = window._bridgeMarketplaceOrders || [];
  const customerUsers = window._bridgeCustomerUsers || [];

  // Consolidar: para cada pedido da loja, cruzar com a corrida da central
  const consolidated = [...storeOrders, ...marketplaceOrders].map(order => {
    const ride = rides.find(r => String(r.orderId) === String(order.id) || String(r.orderId) === String(order.orderId));
    const courier = ride ? couriers.find(c => String(c.id) === String(ride.selectedCourierId)) : null;
    return {
      ...order,
      ride: ride ? { id: ride.id, status: ride.status, courierName: ride.selectedCourierName, motoboyLocation: ride.motoboyLocation || null, updatedAt: ride.updatedAt || null } : null,
      courier: courier ? { id: courier.id, name: courier.name, status: courier.status, lastSeenAt: courier.lastSeenAt || null } : null,
      _consolidated: true,
    };
  });

  window._gestorConsolidatedOrders = consolidated;

  // Disparar evento para a UI do gestor re-renderizar
  window.dispatchEvent(new CustomEvent("gestor:consolidated-update", {
    detail: {
      orders: consolidated,
      rides,
      couriers,
      stores: marketplaceStores,
      customers: [...customerUsers, ...marketplaceUsers, ...storeUsers],
      users: [...customerUsers, ...marketplaceUsers, ...storeUsers],
      products: storeProducts,
      infractions,
      courierApplications,
      storeApplications,
      bridgeStatus: bridgeState,
    }
  }));
}

/**
 * Retorna o status de todos os bridges para exibir no painel do gestor.
 */
function getBridgeStatus() {
  return {
    store: bridgeState.store,
    motoboy: bridgeState.motoboy,
    marketplace: bridgeState.marketplace,
    customers: { connected: true, error: null }, // ja existe no gestor
  };
}

/**
 * Helper para o gestor publicar comandos em qualquer sistema.
 * Ex: forcar cancelamento de uma corrida, suspender motoboy, etc.
 */
async function gestorPublishCommand(system, command, payload) {
  return await supremoPublishEvent(system, "command", "warning", `Comando do gestor: ${command}`, payload?.entityId, payload);
}

if (typeof window !== "undefined") {
  window.initGestorBridges = initGestorBridges;
  window.getBridgeStatus = getBridgeStatus;
  window.gestorPublishCommand = gestorPublishCommand;
  window.updateGestorConsolidated = updateGestorConsolidated;
}
