/**
 * El INSERTAR grande no puede forzar nunca, y forzar tiene que pedir confirmacion.
 *
 * Antes el boton grande se convertia en "INSERTAR IGUALMENTE" tras un 409, asi que un
 * segundo clic en el MISMO sitio creaba el duplicado. De ahi salieron el 31610 (anecoop)
 * y el 31731 (daifressh), los dos con forzado=SI en la auditoria.
 *
 * No necesita navegador ni backend. Uso: node tests/insertarForzado.test.js
 */
import manager from '../src/js/estadoPedidosGarcialaxTestManager.js';

const CAB_TEST = { PED_idpedido: 666328, PED_pedido: 26266, PED_idcliente: 2254 };
const CANDIDATO = { PED_idpedido: 672028, PED_pedido: 30632, PED_referencia: '26/37348-POLONIA' };

/** Backend de mentira: el primer INSERTAR sin forzar da 409; con forzar, OK. */
function montar() {
    const posts = [];
    globalThis.window = {
        env: { IP_BACKEND: '127.0.0.1:0' },
        confirm: () => { throw new Error('confirm no configurado en este caso'); }
    };
    globalThis.fetch = async (url, opts) => {
        if (!opts || opts.method !== 'POST') return { ok: true, status: 200, json: async () => ({}) };
        const body = JSON.parse(opts.body);
        posts.push(body);
        if (body.forzarInsertar) {
            return { ok: true, status: 200, json: async () => ({ ok: true, resultado: { PED_pedido: 99999, PED_idpedido: 7, ejercicio: 26 }, avisos: [], traza: [] }) };
        }
        return {
            ok: false, status: 409,
            json: async () => ({ ok: false, modo: 'MODIFICAR', motivo: 'Ese pedido ya esta en produccion (nº 30632)', candidatos: [CANDIDATO], traza: [] })
        };
    };
    const m = manager();
    m.pedidoDetail = CAB_TEST;
    return { m, posts };
}

const silenciar = async (fn) => {
    const l = console.log, w = console.warn, e = console.error;
    console.log = console.warn = console.error = () => {};
    try { await fn(); } finally { console.log = l; console.warn = w; console.error = e; }
};

let fallos = 0;
const check = (nombre, cond, detalle = '') => {
    if (!cond) fallos++;
    console.log(`${cond ? 'OK  ' : 'FALLA'} ${nombre}`);
    if (!cond && detalle) console.log(`      ${detalle}`);
};

// ── 1. Dos clics seguidos en el boton grande NO pueden duplicar ──
{
    const { m, posts } = montar();
    await silenciar(async () => { await m.traspasoInsertar(); await m.traspasoInsertar(); });
    check('dos clics en INSERTAR: ninguno fuerza',
        posts.length === 2 && posts.every(p => !p.forzarInsertar),
        `posts=${JSON.stringify(posts.map(p => !!p.forzarInsertar))}`);
    check('tras el 409 aparece el boton de forzar', m.traspasoForzar === true);
    check('se guardan los candidatos para nombrarlos', (m.traspasoCandidatos || []).length === 1);
}

// ── 2. Forzar cancelando la confirmacion no manda nada ──
{
    const { m, posts } = montar();
    await silenciar(async () => { await m.traspasoInsertar(); });
    let textoVisto = '';
    window.confirm = (t) => { textoVisto = t; return false; };
    await silenciar(async () => { await m.traspasoInsertarForzado(); });
    check('cancelar la confirmacion NO envia nada', posts.length === 1, `posts=${posts.length}`);
    check('la confirmacion nombra el pedido que se va a duplicar', textoVisto.includes('30632'),
        `texto=${JSON.stringify(textoVisto)}`);
}

// ── 3. Forzar aceptando envia forzarInsertar ──
{
    const { m, posts } = montar();
    await silenciar(async () => { await m.traspasoInsertar(); });
    window.confirm = () => true;
    await silenciar(async () => { await m.traspasoInsertarForzado(); });
    check('aceptar envia forzarInsertar y permitirRepetir',
        posts.length === 2 && posts[1].forzarInsertar === true && posts[1].permitirRepetir === true,
        `ultimo=${JSON.stringify(posts[1])}`);
    check('tras insertar OK se esconde el boton de forzar', m.traspasoForzar === false);
}

console.log(`\n${fallos === 0 ? 'todo OK' : fallos + ' comprobacion(es) FALLAN'}`);
process.exit(fallos === 0 ? 0 : 1);
