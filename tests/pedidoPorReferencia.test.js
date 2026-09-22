/**
 * El boton de la Ref. Pedido de la tarjeta: busca en NetAgro los pedidos del MISMO cliente
 * cuya BESTELLNR o referencia CONTENGA esa referencia, y de la linea que se pincha coge
 * SOLO el IdPresentacion (confecciones) o el destino del pedido (transportes).
 *
 * Lo que se comprueba:
 *   - sin resultados no se abre el modal (solo avisa), y el spinner de la tarjeta se apaga;
 *   - con resultados se abre y el selector arranca en el primero (el mas reciente);
 *   - confecciones: pinchar una linea escribe el IdPresentacion en el buscador y lanza la
 *     busqueda; NO rellena id_gensal/id_categoria/id_genero a mano (los pone el usuario al
 *     elegir en el desplegable, que es lo que valida que la presentacion existe);
 *   - transportes: el destino solo se aplica si esta entre las opciones de la tarjeta.
 *
 * No necesita navegador ni backend. Uso: node tests/pedidoPorReferencia.test.js
 */
import mappingManager from '../src/js/mappingManager.js';
import transportesManager from '../src/js/transporteManager.js';

let fallos = 0;
const ok = (cond, msg) => {
    console.log(`${cond ? 'OK  ' : 'FALLA'} ${msg}`);
    if (!cond) fallos++;
};

const PEDIDO = {
    PED_idpedido: 675961,
    PED_idcentro: 10,
    PED_pedido: 1204,
    PED_ejercicio: 27,
    PED_referencia: '1000535834',
    PED_BESTELLNR: '',
    PED_fechasalida: '2026-09-23T00:00:00.000Z',
    destino: { id: 2527, domicilio: 'VA-PRIMAFRIO BELFORT', poblacion: 'BELFORT', numero: 78 },
    lineas: [
        {
            PEL_idlinea: 644981, IdPresentacion: 523, Presentacion: 'PIMIENTO MIX BIO 9*400 EPS 136',
            IdGenero: 3115, NomGenero: 'PIMIENTO MIX BIO', IdCategoria: 101, NombreCategoria: '1a G',
            Marca: 'EPS', bultos: 216, palets: 3, kilos: 864, anulada: false
        }
    ]
};
const PEDIDO_VIEJO = { ...PEDIDO, PED_idpedido: 675000, PED_pedido: 1199, PED_fechasalida: '2026-08-01T00:00:00.000Z' };

const toasts = [];
function entorno(pedidos) {
    const urls = [];
    globalThis.window = { env: { IP_BACKEND: '127.0.0.1:0' } };
    globalThis.Toastify = (opts) => ({ showToast: () => toasts.push(opts.text) });
    globalThis.fetch = async (url) => {
        urls.push(url);
        if (url.includes('/pedidos-por-referencia')) {
            return { ok: true, status: 200, json: async () => ({ idcliente: 2267, pedidos }) };
        }
        // buscador de presentaciones
        return { ok: true, status: 200, json: async () => ([]) };
    };
    return urls;
}

const tarjetaConfeccion = () => ({
    id: 1, id_linea: 1363, idcliente: 2267, ref_pedido: '1000535834',
    descripcion: 'Bio Paprika Mix ES II 400g FP 9 FP EPS136',
    id_categoria: '', id_gensal: '', id_genero: '',
    especificando: false, busquedaPresentacion: '', resultadosPresentacion: [],
    buscandoPresentacion: false, mostrarResultados: false, presentacionSeleccionada: null,
    _debounceTimer: null, buscandoPedidoRef: false
});

const tarjetaTransporte = (contenido) => ({
    _id: 7, id_mapping: 99, ref_pedido: '1000535834', direccion: 'VA-PRIMAFRIO BELFORT',
    seleccion: '', filtroDireccion: '', modoBusqueda: 'nombre', especificando: true,
    buscandoPedidoRef: false, contenido
});

// ---------------------------------------------------------------- CONFECCIONES
{
    console.log('\n--- confecciones: sin pedidos ---');
    toasts.length = 0;
    entorno([]);
    const m = mappingManager();
    const item = tarjetaConfeccion();
    await m.abrirPedidoRef(item);
    ok(m.pedidoRefOpen === false, 'sin resultados no se abre el modal');
    ok(toasts.some(t => t.includes('1000535834')), 'avisa nombrando la referencia buscada');
    ok(item.buscandoPedidoRef === false, 'el spinner de la tarjeta se apaga');
}

{
    console.log('\n--- confecciones: pedido encontrado ---');
    toasts.length = 0;
    const urls = entorno([PEDIDO, PEDIDO_VIEJO]);
    const m = mappingManager();
    const item = tarjetaConfeccion();
    await m.abrirPedidoRef(item);

    ok(m.pedidoRefOpen === true, 'se abre el modal');
    ok(urls[0].includes('ref_pedido=1000535834') && urls[0].includes('idcliente=2267'),
        'pregunta por referencia y cliente de la tarjeta');
    ok(m.pedidoRefPedidos.length === 2 && m.pedidoRefIndice === 0, 'arranca en el primer pedido');
    ok(m.pedidoRefActual.PED_idpedido === 675961, 'el pedido actual es el primero de la lista');
    ok(m.etiquetaPedidoRef(PEDIDO).startsWith('23/09/2026'), 'la etiqueta del selector lleva la fecha');

    m.pedidoRefIndice = 1;
    ok(m.pedidoRefActual.PED_idpedido === 675000, 'el selector cambia de pedido');
    m.pedidoRefIndice = 0;

    m.aplicarLineaPedido(PEDIDO.lineas[0]);
    ok(item.busquedaPresentacion === '523', 'escribe SOLO el IdPresentacion en el buscador');
    ok(item.especificando === true, 'abre el buscador de la tarjeta');
    ok(m.pedidoRefOpen === false, 'cierra el modal');
    ok(item.id_gensal === '' && item.id_categoria === '' && item.id_genero === '',
        'no rellena los ids a mano: los pone el usuario al elegir en el desplegable');

    // la busqueda va diferida (para no comerse el @click.away) y con debounce de 300 ms
    await new Promise(r => setTimeout(r, 400));
    const busqueda = urls.find(u => u.includes('/presentaciones/buscar'));
    ok(!!busqueda && busqueda.includes('busqueda=523'), 'lanza la busqueda por ese numero');
    ok(busqueda.includes('idcliente=2267'), 'la busqueda mantiene el cliente de la tarjeta');
}

{
    console.log('\n--- confecciones: linea sin presentacion ---');
    toasts.length = 0;
    entorno([PEDIDO]);
    const m = mappingManager();
    const item = tarjetaConfeccion();
    await m.abrirPedidoRef(item);
    m.aplicarLineaPedido({ PEL_idlinea: 1, IdPresentacion: null });
    ok(item.busquedaPresentacion === '', 'no escribe nada si la linea no tiene presentacion');
    ok(m.pedidoRefOpen === true, 'el modal sigue abierto para elegir otra linea');
}

// ---------------------------------------------------------------- TRANSPORTES
{
    console.log('\n--- transportes: destino disponible ---');
    toasts.length = 0;
    const urls = entorno([PEDIDO]);
    const t = transportesManager();
    const item = tarjetaTransporte([
        { id: 2527, direccion: 'VA-PRIMAFRIO BELFORT', numero: 78, cliente: 2267 },
        { id: 1762, direccion: 'OTRO DESTINO', numero: 12, cliente: 2267 }
    ]);
    await t.abrirPedidoRef(item);

    ok(t.pedidoRefOpen === true, 'se abre el modal');
    ok(urls[0].includes('contenido_id=2527'), 'deriva el cliente por el CLD_Id del contenido');
    ok(t.destinoDisponible(t.pedidoRefActual) === true, 'el destino esta entre las opciones');

    t.aplicarDestinoPedido(t.pedidoRefActual);
    ok(item.seleccion === '2527', 'escribe el destino en el selector de la tarjeta');
    ok(item.especificando === false, 'cierra el selector');
    ok(t.pedidoRefOpen === false, 'cierra el modal');
}

{
    console.log('\n--- transportes: destino que no esta en las opciones ---');
    toasts.length = 0;
    entorno([PEDIDO]);
    const t = transportesManager();
    const item = tarjetaTransporte([{ id: 1762, direccion: 'OTRO DESTINO', numero: 12, cliente: 2267 }]);
    await t.abrirPedidoRef(item);

    ok(t.destinoDisponible(t.pedidoRefActual) === false, 'lo detecta como no disponible');
    t.aplicarDestinoPedido(t.pedidoRefActual);
    ok(item.seleccion === '', 'no ensucia el selector con un destino que no esta en la lista');
    ok(toasts.some(t2 => t2.includes('opciones')), 'lo dice en un aviso');
}

{
    console.log('\n--- transportes: tarjeta sin direcciones ---');
    toasts.length = 0;
    entorno([PEDIDO]);
    const t = transportesManager();
    const item = tarjetaTransporte([]);
    await t.abrirPedidoRef(item);
    ok(t.pedidoRefOpen === false, 'sin contenido no se puede saber el cliente: no abre');
}

console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLOS`);
process.exit(fallos === 0 ? 0 : 1);
