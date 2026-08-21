/**
 * El modal de resultado sale al crear Y al modificar, y lleva dentro la pregunta de imprimir.
 *
 * Antes la confirmacion no se veia: el texto se escribia en traspasoMensaje y acto seguido
 * openPedidoDetail() llamaba a _resetTraspaso(), que lo borraba. Y el "¿imprimir?" salia al
 * final de un modal muy largo. Al modificar un pedido de eurogroup el backend habia archivado
 * y re-sellado el PDF (auditoria id 28) y aun asi no se llego a ver la pregunta.
 *
 * No necesita navegador ni backend. Uso: node tests/modalResultado.test.js
 */
import manager from '../src/js/estadoPedidosGarcialaxTestManager.js';

const DOC_OK = { ok: true, idnuxeo: 'AUTO-PE26.1.31727-2-20260820-120754', resellado: { ok: true, codigo: 'PE26.1.31727' } };
const DOC_SIN_RESELLAR = { ok: true, idnuxeo: 'AUTO-PE26.1.31727-2-x', resellado: { ok: false, motivo: 'apartado no resellable' } };

function montar({ modo, documental, sinCambios = false }) {
    globalThis.window = { env: { IP_BACKEND: '127.0.0.1:0' }, confirm: () => true };
    globalThis.fetch = async (url, opts) => {
        if (opts && opts.method === 'POST') {
            return {
                ok: true, status: 200, json: async () => ({
                    ok: true, sinCambios,
                    resultado: {
                        PED_pedido: 31727, PED_idpedido: 673555, ejercicio: 26,
                        lineas: [{}], almacenes: 1, camposCabecera: 0,
                        lineasActualizadas: 1, lineasNuevas: 0, lineasAnuladas: 0,
                        documental
                    },
                    avisos: [], traza: []
                })
            };
        }
        return { ok: true, status: 200, json: async () => ({}) };
    };
    const m = manager();
    m.pedidoDetail = { PED_idpedido: 666328, PED_pedido: 26266, PED_idcliente: 2254 };
    m._traspasoItem = { id_pedido_net: 666328, pedido: 26266, cliente: 2254 };
    m.traspasoForm = { ejercicio: '26', numeroPedido: '31727', idPedido: '' };
    m.traspasoMostrarForm = modo === 'MODIFICAR';
    return m;
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

// ── CREAR ──
{
    const m = montar({ modo: 'INSERTAR', documental: DOC_OK });
    await silenciar(() => m.traspasoInsertar());
    check('crear: sale el modal', !!m.traspasoResultado);
    check('crear: dice CREADO y el numero', m.traspasoResultado?.accion === 'INSERTAR' && m.traspasoResultado?.pedido === 31727,
        JSON.stringify(m.traspasoResultado));
    check('crear: el detalle sobrevive a la recarga', /INSERTADO en produccion/.test(m.traspasoResultado?.detalle || ''),
        `detalle=${JSON.stringify(m.traspasoResultado?.detalle)}`);
    check('crear: ofrece imprimir', !!m.traspasoDoc && m.traspasoDoc.codigo === 'PE26.1.31727');
}

// ── MODIFICAR: es el caso que fallo en eurogroup ──
{
    const m = montar({ modo: 'MODIFICAR', documental: DOC_OK });
    await silenciar(() => m.traspasoModificarClick());
    check('modificar: sale el modal', !!m.traspasoResultado);
    check('modificar: dice MODIFICADO', m.traspasoResultado?.accion === 'MODIFICAR');
    check('modificar: TAMBIEN ofrece imprimir', !!m.traspasoDoc, `traspasoDoc=${JSON.stringify(m.traspasoDoc)}`);
    await silenciar(() => m.traspasoNoImprimir());
    check('modificar: "NO IMPRIMIR" cierra el modal', m.traspasoResultado === null && m.traspasoDoc === null);
}

// ── Sin documento que imprimir: se dice por que, no se calla ──
{
    const m = montar({ modo: 'INSERTAR', documental: null });
    await silenciar(() => m.traspasoInsertar());
    check('sin documental: sale el modal igual', !!m.traspasoResultado);
    check('sin documental: no ofrece imprimir', m.traspasoDoc === null);
    check('sin documental: explica el motivo', /no esta activo en este entorno/.test(m.traspasoDocMotivo),
        `motivo=${JSON.stringify(m.traspasoDocMotivo)}`);
    m.traspasoCerrarResultado();
    check('sin documental: CERRAR cierra', m.traspasoResultado === null);
}

// ── Archivado pero sin re-sellar: no se ofrece, y se dice por que ──
{
    const m = montar({ modo: 'INSERTAR', documental: DOC_SIN_RESELLAR });
    await silenciar(() => m.traspasoInsertar());
    check('sin re-sellar: no ofrece imprimir', m.traspasoDoc === null);
    check('sin re-sellar: avisa de que apuntaria al pedido de test', /pedido de test/.test(m.traspasoDocMotivo),
        `motivo=${JSON.stringify(m.traspasoDocMotivo)}`);
}

// ── Sin cambios: el modal lo dice en vez de fingir una modificacion ──
{
    const m = montar({ modo: 'MODIFICAR', documental: DOC_OK, sinCambios: true });
    await silenciar(() => m.traspasoModificarClick());
    check('sin cambios: el detalle lo dice', /ya estaba igual/.test(m.traspasoResultado?.detalle || ''),
        `detalle=${JSON.stringify(m.traspasoResultado?.detalle)}`);
}

console.log(`\n${fallos === 0 ? 'todo OK' : fallos + ' comprobacion(es) FALLAN'}`);
process.exit(fallos === 0 ? 0 : 1);
