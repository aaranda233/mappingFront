/**
 * El check "Ocultar errores" del historial de los apartados de Estado Pedidos.
 *
 * Es un filtro de VISTA: no toca las peticiones ni el historial que llega del backend, solo
 * decide que filas se pintan (la tabla recorre historialVisible(), no historial). Se prueba
 * sobre un manager de produccion y uno de test, porque el mixin va en los 21 y en los de test
 * conviven con el mixin del traspaso.
 *
 * No necesita navegador ni backend. Uso: node tests/ocultarErrores.test.js
 */
import managerProd from '../src/js/estadoPedidosAnecoopManager.js';
import managerTest from '../src/js/estadoPedidosAnecoopTestManager.js';
import mixin from '../src/js/ocultarErrores.js';

const FILAS = [
    { id: 1, estado: 'procesado', ref_pedido: '25/1' },
    { id: 2, estado: 'error', ref_pedido: '25/2' },
    { id: 3, estado: 'procesado', ref_pedido: '25/3' },
    { id: 4, estado: 'error', ref_pedido: '25/4' },
    { id: 5, estado: 'procesando', ref_pedido: '25/5' }
];

let fallos = 0;
const check = (nombre, cond, detalle = '') => {
    if (!cond) fallos++;
    console.log(`${cond ? 'OK  ' : 'FALLA'} ${nombre}`);
    if (!cond && detalle) console.log(`      ${detalle}`);
};

// localStorage de mentira, para que el mixin no dependa del navegador.
function montarWindow({ guardado = null, romper = false } = {}) {
    const almacen = new Map();
    if (guardado !== null) almacen.set('ocultarErrores:/estado-pedidos-anecoop.html', guardado);
    globalThis.window = {
        env: { IP_BACKEND: '127.0.0.1:0' },
        location: { pathname: '/estado-pedidos-anecoop.html' },
        localStorage: {
            getItem: (k) => { if (romper) throw new Error('bloqueado'); return almacen.has(k) ? almacen.get(k) : null; },
            setItem: (k, v) => { if (romper) throw new Error('bloqueado'); almacen.set(k, v); }
        }
    };
    return almacen;
}

// ── 1. El filtro ──
{
    montarWindow();
    const m = managerProd();
    m.historial = FILAS;
    check('sin marcar se ven todas', m.historialVisible().length === 5);
    m.ocultarErrores = true;
    const v = m.historialVisible();
    check('marcado desaparecen las 2 de error', v.length === 3, JSON.stringify(v.map(x => x.estado)));
    check('no se cuela ninguna de error', v.every(x => x.estado !== 'error'));
    check('las procesadas siguen ahi', v.filter(x => x.estado === 'procesado').length === 2);
    check('cuenta cuantas esconde', m.erroresOcultos() === 2, String(m.erroresOcultos()));
    // No es destructivo: el historial de verdad se queda entero, asi que desmarcar lo devuelve
    // sin tener que volver a pedirlo al backend.
    check('el historial original no se toca', m.historial.length === 5);
    m.ocultarErrores = false;
    check('al desmarcar vuelven todas', m.historialVisible().length === 5);
}

// ── 2. Casos de borde ──
{
    montarWindow();
    const m = managerProd();
    m.historial = [];
    check('historial vacio no revienta', m.historialVisible().length === 0 && m.erroresOcultos() === 0);
    m.historial = null;
    check('historial null tampoco', m.historialVisible().length === 0 && m.erroresOcultos() === 0);
    m.historial = [null, { id: 1, estado: 'error' }, undefined];
    m.ocultarErrores = true;
    check('una fila null no cuenta como pedido', m.historialVisible().length === 0);
}

// ── 3. Se recuerda por pagina ──
{
    const almacen = montarWindow();
    const m = managerProd();
    check('por defecto no esta marcado', m.ocultarErrores === false);
    m.ocultarErrores = true;
    m.recordarOcultarErrores();
    check('al marcar se guarda', almacen.get('ocultarErrores:/estado-pedidos-anecoop.html') === '1');
    m.ocultarErrores = false;
    m.recordarOcultarErrores();
    check('al desmarcar tambien', almacen.get('ocultarErrores:/estado-pedidos-anecoop.html') === '0');
}
{
    montarWindow({ guardado: '1' });
    check('al entrar se recupera lo guardado', managerProd().ocultarErrores === true);
}
{
    montarWindow({ guardado: '0' });
    check('un 0 guardado no marca el check', managerProd().ocultarErrores === false);
}
{
    // Ventana privada o cookies bloqueadas: el check tiene que seguir funcionando.
    montarWindow({ romper: true });
    const m = managerProd();
    check('sin localStorage arranca sin marcar', m.ocultarErrores === false);
    m.ocultarErrores = true;
    m.recordarOcultarErrores();
    m.historial = FILAS;
    check('y el filtro sigue filtrando', m.historialVisible().length === 3);
}

// ── 4. En los apartados de test convive con el mixin del traspaso ──
{
    montarWindow();
    const m = managerTest();
    m.historial = FILAS;
    m.ocultarErrores = true;
    check('el manager de test filtra igual', m.historialVisible().length === 3);
    check('y no pierde nada del traspaso',
        typeof m.traspasoDocDeFila === 'function' && typeof m.traspasoInsertar === 'function' &&
        typeof m.traspasoListo === 'function');
}

// ── 5. El mixin no pisa claves del manager ──
{
    montarWindow();
    const soloMixin = Object.keys(mixin());
    const m = managerProd();
    check('el mixin aporta exactamente sus 4 claves',
        soloMixin.length === 4 && soloMixin.every(k => k in m), JSON.stringify(soloMixin));
    check('no toca historial ni current', !soloMixin.includes('historial') && !soloMixin.includes('current'));
}

console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
