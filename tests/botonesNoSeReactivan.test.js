/**
 * Regresion: un segundo clic creaba el pedido DOS VECES.
 *
 * Al pulsar CREAR NUEVO PEDIDO / MODIFICAR, _traspasoEjecutar pone traspasoEnCurso=true y
 * los botones se deshabilitan (:disabled="!traspasoListo()"). El POST es rapido, pero
 * despues quedan por hacer un openPedidoDetail() y un fetch mas antes de que aparezca el
 * modal de resultado, que es lo que tapa los botones. Y openPedidoDetail llama a
 * _resetTraspaso(), cuya primera linea era `this.traspasoEnCurso = false`: los botones se
 * reactivaban ahi, un segundo antes de que saliese el modal. En ese hueco un clic mas
 * lanzaba otro POST y se creaba el pedido dos veces.
 *
 * Ahora hay _traspasoOperando, que solo baja el finally de _traspasoEjecutar y por eso
 * sobrevive al reset, mas un guard de reentrada al principio de _traspasoEjecutar (el
 * :disabled no basta: dos clics en el mismo tick de Alpine entran los dos).
 *
 * No necesita navegador ni backend. Uso: node tests/botonesNoSeReactivan.test.js
 */
import manager from '../src/js/estadoPedidosAnecoopTestManager.js';

const CAB_TEST = { PED_idpedido: 666164, PED_pedido: 26217, PED_idcliente: 1939 };
const RESULTADO = { PED_pedido: 31610, PED_idpedido: 673456, ejercicio: 26, lineas: [1], almacenes: 1 };

let fallos = 0;
const check = (nombre, cond, detalle = '') => {
    if (!cond) fallos++;
    console.log(`${cond ? 'OK  ' : 'FALLA'} ${nombre}`);
    if (!cond && detalle) console.log(`      ${detalle}`);
};

const silenciar = async (fn) => {
    const l = console.log, w = console.warn, e = console.error;
    console.log = console.warn = console.error = () => {};
    try { return await fn(); } finally { console.log = l; console.warn = w; console.error = e; }
};

const dormir = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Monta el manager reproduciendo la secuencia real: el POST responde rapido y
 * openPedidoDetail (que llama a _resetTraspaso, como el de verdad) tarda, que es donde
 * estaba el hueco. `mirillas` apunta si en algun momento los botones quedaron activos.
 */
function montar({ retrasoDetalle = 60 } = {}) {
    const posts = [];
    const mirillas = [];
    globalThis.window = { env: { IP_BACKEND: '127.0.0.1:0' }, confirm: () => true, alert: () => {} };
    globalThis.fetch = async (url, opts) => {
        if (opts && opts.method === 'POST') {
            posts.push(JSON.parse(opts.body));
            return { ok: true, status: 200, json: async () => ({ ok: true, resultado: RESULTADO, avisos: [], traza: [] }) };
        }
        return { ok: true, status: 200, json: async () => ({ documentos: {}, header: null, lineas: [] }) };
    };

    const m = manager();
    m.pedidoDetail = CAB_TEST;
    m._traspasoItem = { id: 1, id_pedido_net: CAB_TEST.PED_idpedido };
    // El openPedidoDetail de verdad resetea el estado del traspaso y tarda (dos fetch).
    m.openPedidoDetail = async () => {
        m._resetTraspaso(m._traspasoItem);
        mirillas.push({ momento: 'dentro de openPedidoDetail', listo: m.traspasoListo() });
        await dormir(retrasoDetalle);
        mirillas.push({ momento: 'al salir de openPedidoDetail', listo: m.traspasoListo() });
    };
    return { m, posts, mirillas };
}

// ── 1. Los botones NO se reactivan mientras la operacion sigue ──
{
    const { m, mirillas } = montar();
    await silenciar(() => m.traspasoInsertar());
    check('los botones siguen bloqueados durante todo el openPedidoDetail',
        mirillas.length === 2 && mirillas.every(v => v.listo === false),
        JSON.stringify(mirillas));
    check('al terminar del todo se reactivan', m.traspasoListo() === true);
    check('y el modal de resultado esta puesto', !!m.traspasoResultado,
        JSON.stringify(m.traspasoResultado));
}

// ── 2. Un segundo clic en el hueco no manda un segundo POST ──
// Es el caso real: el usuario pulsa, ve los botones activos otra vez y vuelve a pulsar.
{
    const { m, posts } = montar({ retrasoDetalle: 80 });
    await silenciar(async () => {
        const primera = m.traspasoInsertar();
        await dormir(20);              // el POST ya respondio, estamos en el hueco
        await m.traspasoInsertar();    // el segundo clic
        await primera;
    });
    check('solo se manda UN POST aunque se pulse dos veces', posts.length === 1,
        `posts=${posts.length}`);
}

// ── 3. Dos clics en el mismo tick (doble clic) tampoco ──
// Aqui el :disabled del boton no ayuda: Alpine no ha repintado todavia.
{
    const { m, posts } = montar();
    await silenciar(() => Promise.all([m.traspasoInsertar(), m.traspasoInsertar()]));
    check('doble clic simultaneo manda UN solo POST', posts.length === 1, `posts=${posts.length}`);
}

// ── 4. Lo mismo con MODIFICAR ──
{
    const { m, posts } = montar({ retrasoDetalle: 80 });
    m.traspasoMostrarForm = true;   // el formulario ya abierto: el clic ejecuta
    await silenciar(async () => {
        const primera = m.traspasoModificarClick();
        await dormir(20);
        await m.traspasoModificarClick();
        await primera;
    });
    check('MODIFICAR tampoco se ejecuta dos veces', posts.length === 1, `posts=${posts.length}`);
}

// ── 5. Si falla, los botones vuelven para poder reintentar ──
{
    const { m } = montar();
    globalThis.fetch = async () => { throw new Error('la red se cayo'); };
    await silenciar(() => m.traspasoInsertar());
    check('tras un error de red se puede reintentar', m.traspasoListo() === true);
    check('y el error se ve en pantalla, no solo en la consola',
        !m.traspasoMensajeOk && /la red se cayo/.test(m.traspasoMensaje || ''), m.traspasoMensaje);
}

// ── 6. El boton de impresora de cada fila ──
{
    const { m } = montar();
    m.traspasoDocsPorPedido = { 666164: { idnuxeo: 'AUTO-PE26.1.31610-1-20260819-064207', pedidoProd: 31610 } };
    check('la fila traspasada tiene documento',
        m.traspasoDocDeFila({ id_pedido_net: 666164 })?.pedidoProd === 31610);
    check('el mapa se indexa igual con la clave en texto',
        m.traspasoDocDeFila({ id_pedido_net: '666164' })?.pedidoProd === 31610);
    check('una fila sin traspasar no tiene boton', m.traspasoDocDeFila({ id_pedido_net: 999999 }) === null);
    check('una fila sin id_pedido_net tampoco', m.traspasoDocDeFila({}) === null);
    check('ni un item vacio', m.traspasoDocDeFila(null) === null);
}

console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
