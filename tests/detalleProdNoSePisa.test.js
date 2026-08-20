/**
 * Regresion: el panel de PRODUCCION aparecia y se borraba solo un segundo despues.
 *
 * openPedidoDetail hace DOS busquedas del pedido de produccion, una detras de otra:
 *   1. traspasoCargarPrevio() -> /analizar, que casa admitiendo las variantes de
 *      referencia que se escriben a mano, y pinta el panel.
 *   2. la cascada /pedido-prod, que busca por igualdad EXACTA.
 * Cuando (1) casaba y (2) no, la segunda devolvia 404, ponia prodNotFound=true y el
 * template (x-if="!prodNotFound && pedidoDetailProd") borraba lo que acababa de salir.
 *
 * Esta prueba monta el manager con un fetch de mentira y comprueba los tres caminos.
 * No necesita navegador ni backend. Uso: node tests/detalleProdNoSePisa.test.js
 */
import manager from '../src/js/estadoPedidosGarcialaxTestManager.js';

globalThis.window = { env: { IP_BACKEND: '127.0.0.1:0' } };

const ITEM = { id_pedido_net: 666328, pedido: 26266, cliente: 2254 };
const CAB_TEST = {
    PED_idpedido: 666328, PED_pedido: 26266, PED_idcliente: 2254, PED_iddestino: 1184,
    PED_referencia: '26/0037348', PED_BESTELLNR: null, PED_fechapedido: '2026-07-31T00:00:00.000Z'
};
const CAB_PROD = { PED_idpedido: 672028, PED_pedido: 30632, PED_referencia: '26/37348-POLONIA' };

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

/**
 * @param analisis   respuesta de /analizar
 * @param prodDirecto respuesta de la cascada /pedido-prod: 'ok' | '404'
 */
function montar({ analisis, prodDirecto }) {
    const llamadas = [];
    globalThis.fetch = async (url) => {
        llamadas.push(url);
        if (url.includes('/analizar')) return json(analisis);
        if (url.includes('/pedido-prod-id/')) return json({ header: CAB_PROD, lineas: [{ PEL_idlinea: 1 }] });
        if (url.includes('/pedido-prod?')) {
            return prodDirecto === '404'
                ? json({ message: 'no encontrado' }, 404)
                : json({ header: CAB_PROD, lineas: [{ PEL_idlinea: 1 }] });
        }
        if (url.includes('/pedido-lineas/')) return json([{ PEL_idlinea: 1 }]);
        if (url.includes('/pedido/')) return json(CAB_TEST);
        throw new Error(`URL no prevista en la prueba: ${url}`);
    };
    return { m: manager(), llamadas };
}

const CASOS = [
    {
        nombre: 'el analisis casa y la cascada da 404 -> el pedido de produccion NO se borra',
        analisis: { ok: true, modo: 'MODIFICAR', prod: { PED_idpedido: 672028, PED_pedido: 30632 }, candidatos: [{}], claves: ['26/0037348', '26/37348'], ejercicioDestino: 26, traza: [] },
        prodDirecto: '404',
        espera: { hayProd: true, prodNotFound: false, cascadaLlamada: false }
    },
    {
        nombre: 'el analisis NO casa y la cascada da 404 -> se sigue diciendo "no encontrado"',
        analisis: { ok: true, modo: 'INSERTAR', prod: null, candidatos: [], candidatosDebiles: [], claves: ['26/0037348'], ejercicioDestino: 26, traza: [] },
        prodDirecto: '404',
        espera: { hayProd: false, prodNotFound: true, cascadaLlamada: true }
    },
    {
        nombre: 'el analisis NO casa pero la cascada si -> lo pinta la cascada',
        analisis: { ok: true, modo: 'INSERTAR', prod: null, candidatos: [], candidatosDebiles: [], claves: ['26/0037348'], ejercicioDestino: 26, traza: [] },
        prodDirecto: 'ok',
        espera: { hayProd: true, prodNotFound: false, cascadaLlamada: true }
    }
];

const logReal = console.log, warnReal = console.warn;
let fallos = 0;
for (const c of CASOS) {
    const { m, llamadas } = montar(c);
    console.log = () => {}; console.warn = () => {};
    await m.openPedidoDetail(ITEM);
    console.log = logReal; console.warn = warnReal;

    const obtenido = {
        hayProd: !!m.pedidoDetailProd,
        prodNotFound: m.prodNotFound,
        cascadaLlamada: llamadas.some(u => u.includes('/pedido-prod?'))
    };
    // Lo que de verdad decide si se ve o no, que es la condicion del x-if del template.
    const visible = !obtenido.prodNotFound && obtenido.hayProd;
    const esperaVisible = !c.espera.prodNotFound && c.espera.hayProd;
    const ok = JSON.stringify(obtenido) === JSON.stringify(c.espera) && visible === esperaVisible;
    if (!ok) fallos++;
    console.log(`${ok ? 'OK  ' : 'FALLA'} ${c.nombre}`);
    console.log(`      panel visible=${visible}  ${JSON.stringify(obtenido)}`);
    if (!ok) console.log(`      esperaba ${JSON.stringify(c.espera)}`);
}

console.log(`\n${CASOS.length - fallos}/${CASOS.length} casos OK`);
process.exit(fallos === 0 ? 0 : 1);
