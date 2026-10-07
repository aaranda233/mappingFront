import { cargarCategoriasPresentacion } from './categoriasPresentacion.js';
import { ofrecerReprocesar } from './reprocesarCorreo.js';

export default function mappingManager() {
    return {
        mappings: [],
        loading: false,
        primeraCarga: true,
        toast: null,
        pdfModalOpen: false,
        pdfBlobUrl: null,

        // Modal "lineas del pedido de NetAgro" (se abre desde la Ref. Pedido de la tarjeta)
        pedidoRefOpen: false,
        pedidoRefItem: null,
        pedidoRefPedidos: [],
        pedidoRefIndice: 0,
        pedidoRefBuscada: '',
        // "Productos de <cliente>": las lineas predefinidas del ERP (Pedidos_Clientes),
        // una por presentacion (IdGenSal) y agrupadas por genero
        prodCliOpen: false,
        prodCliItem: null,
        prodCliGeneros: [],
        prodCliDestinos: [],        // solo para el filtro
        prodCliDestino: '',        // '' = todos los destinos
        prodCliDestinoPedido: null, // destino del pedido de NetAgro con esta referencia, si existe
        prodCliFiltro: '',
        prodCliOrden: 'uso',            // 'uso' = mas pedidas en 12 meses, 'reciente' = ultimo pedido
        prodCliVerBajas: false,         // presentaciones dadas de baja en el ERP (GES_activo = 'N')
        prodCliSoloUsadas: false,       // solo las pedidas en los ultimos 12 meses

        get filteredMappings() {
            // El backend ya filtra por PED_idCentro cuando hay centro en la URL.
            // Devolvemos tal cual lo recibido.
            return this.mappings;
        },

        init() {
            this.loadMappings();
            setInterval(() => this.loadMappings(), 10000); // refresco continuo
            // Recargar al cambiar el filtro BIO/Convencional o Mostrar Todos sin vaciar la lista
            // $watch y no Alpine.effect: el callback corre fuera del ambito de seguimiento,
            // asi que lo que escriba loadMappings() (primeraCarga, loading, mappings) no
            // vuelve a disparar el watcher. Con effect() se recargaba de mas.
            this.$watch('$store.global.bioCentro', () => this.loadMappings());
        },

        async loadMappings() {
            if (this.primeraCarga) this.loading = true;

            try {
                const store = window.Alpine && window.Alpine.store('global');
                const centro = store ? store.bioCentro : null;
                const url = centro === null
                    ? `http://${window.env.IP_BACKEND}/api/mapping`
                    : `http://${window.env.IP_BACKEND}/api/mapping?centro=${centro}`;
                const res = await fetch(url);
                const data = await res.json();

                const nuevos = [];

                // Agrega nuevos si no están ya
                for (const nuevo of data) {
                    const existente = this.mappings.find(m => m.id === nuevo.id);
                    if (existente) {
                        // id_destino puede llegar despues (al mapear la direccion del pedido)
                        existente.id_destino = nuevo.id_destino;
                    } else {
                        nuevos.push({
                            ...nuevo,
                            id_categoria: "",
                            categorias: [],
                            id_gensal: "",
                            error: "",
                            especificando: false,
                            busquedaPresentacion: "",
                            resultadosPresentacion: [],
                            buscandoPresentacion: false,
                            mostrarResultados: false,
                            presentacionSeleccionada: null,
                            _debounceTimer: null,
                            historico: null,
                            buscandoHistorico: false,
                            mostrarHistorico: false,
                            buscandoPedidoRef: false,
                            buscandoProductosCliente: false
                        });
                    }
                }

                // Quita los que ya no están
                this.mappings = this.mappings.filter(m =>
                    data.some(n => n.id === m.id)
                );

                // Añade solo los nuevos
                this.mappings.push(...nuevos);
            } catch (err) {
                console.error("Error cargando mappings:", err);
            } finally {
                this.loading = false;
                this.primeraCarga = false;
            }
        },

        async enviar(item) {
            //comprueba que todos los campos sean correctos
            if (!item.id_categoria || !item.id_gensal || !item.id_genero) {
                item.error = "⚠️ Por favor completa todos los campos antes de enviar.";
                return;
            }
            //Limpiamos el item de errores cuando de envia
            item.error = "";

            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/consumir`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: item.id,
                        id_categoria: item.id_categoria,
                        ref_pedido: item.ref_pedido,
                        id_gensal: item.id_gensal,
                        id_genero: item.id_genero
                    })
                });

                let result = {};

                // Solo intenta leer el body si hay contenido
                if (res.status !== 204) {
                    try {
                        result = await res.json();
                    } catch (e) {
                        console.warn("Respuesta sin JSON, pero no es 204:", e);
                    }
                }

                //comprobación de que todos php ha podido generar el mapping
                if (res.ok) {
                    const resultValue = (result.result || result.Result || "").toString().toLowerCase();

                    if (resultValue !== "error") {
                        // Eliminar solo este mapping (por id)
                        this.mappings = this.mappings.filter(m => m.id !== item.id);
                        this.showToast("Enviado correctamente");
                        // Si era la ultima card del correo, ofrece reprocesarlo
                        ofrecerReprocesar(result.reprocesar, (msg, color) => this.showToast(msg, color));
                    } else {
                        item.error = "❌ " + (result.message || result.Message || "Error desconocido desde el servidor externo.");
                    }
                } else {
                    item.error = "❌ " + (result.message || result.Message || "Respuesta no exitosa del servidor externo.");
                }

            } catch (err) {
                console.error("Error enviando:", err);
                item.error = "⚠️ No se pudo contactar con el servidor";
            }
        },

        showToast(msg, backgroundColor = "#16a34a") {
            Toastify({
                text: msg,
                duration: 3000,
                gravity: "top", // "top" or "bottom"
                position: "right", // "left", "center" or "right"
                backgroundColor, // verde tailwind por defecto
                stopOnFocus: true
            }).showToast();
        },
        buscarPresentaciones(item) {
            clearTimeout(item._debounceTimer);
            item.presentacionSeleccionada = null;
            item.id_genero = "";
            item.id_gensal = "";
            item.id_categoria = "";
            item.categorias = [];

            if (item.busquedaPresentacion.length < 1) {
                item.resultadosPresentacion = [];
                item.mostrarResultados = false;
                return;
            }

            item.buscandoPresentacion = true;
            item.mostrarResultados = true;

            item._debounceTimer = setTimeout(async () => {
                try {
                    const res = await fetch(
                        `http://${window.env.IP_BACKEND}/api/mapping/presentaciones/buscar?busqueda=${encodeURIComponent(item.busquedaPresentacion)}&idcliente=${item.idcliente || 0}&idlinea=${item.id_linea || 0}`
                    );
                    const data = await res.json();
                    item.resultadosPresentacion = data;
                } catch (err) {
                    console.error("Error buscando presentaciones:", err);
                    item.resultadosPresentacion = [];
                } finally {
                    item.buscandoPresentacion = false;
                }
            }, 300);
        },

        seleccionarPresentacion(item, presentacion) {
            item.id_genero = String(presentacion.IdGenero);
            item.id_gensal = String(presentacion.IdPresentacion);
            item.id_categoria = String(presentacion.IdCategoria);
            item.presentacionSeleccionada = presentacion;
            item.mostrarResultados = false;
            item.busquedaPresentacion = presentacion.Presentacion;
            item.especificando = false;
            this.cargarCategorias(item);
        },

        async cargarCategorias(item) {
            const idGensal = item.id_gensal;
            item.categorias = [];
            if (!idGensal) return;
            const lista = await cargarCategoriasPresentacion(idGensal, item.idcliente, {
                IdCategoria: item.id_categoria,
                NombreCategoria: item.presentacionSeleccionada?.NombreCategoria
            });
            // Si entretanto se eligio otra presentacion, esta respuesta ya no vale
            if (item.id_gensal === idGensal) item.categorias = lista;
        },

        limpiarPresentacion(item) {
            item.busquedaPresentacion = "";
            item.resultadosPresentacion = [];
            item.mostrarResultados = false;
            item.presentacionSeleccionada = null;
            item.id_genero = "";
            item.id_gensal = "";
            item.id_categoria = "";
            item.categorias = [];
        },

        async consultarHistorico(item) {
            // Toggle: si ya estaba abierto, cerrar
            if (item.mostrarHistorico) {
                item.mostrarHistorico = false;
                return;
            }
            item.mostrarHistorico = true;

            // Cache: si ya se consultó, no repetir
            if (item.historico) return;

            item.buscandoHistorico = true;
            try {
                const params = new URLSearchParams({
                    idcliente: item.idcliente || 0,
                    descripcion: item.descripcion || ''
                });
                if (item.ref_pedido) params.set('ref_pedido', item.ref_pedido);

                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/historico-referencia?${params.toString()}`);
                if (!res.ok) throw new Error('Respuesta no OK');
                item.historico = await res.json();
            } catch (err) {
                console.error('Error consultando histórico:', err);
                item.historico = { pedidoActual: null, candidatos: [], error: true };
            } finally {
                item.buscandoHistorico = false;
            }
        },

        aplicarHistorico(item, candidato) {
            // Salvaguarda: si alguno de los IDs es null/undefined, el candidato está roto
            if (!candidato || candidato.IdGenero == null || candidato.IdPresentacion == null || candidato.IdCategoria == null) {
                this.showToast("Este candidato no tiene datos válidos");
                return;
            }
            item.id_genero = String(candidato.IdGenero);
            item.id_gensal = String(candidato.IdPresentacion);
            item.id_categoria = String(candidato.IdCategoria);
            item.presentacionSeleccionada = {
                Presentacion: candidato.Presentacion,
                Genero: candidato.NomGenero,
                IdGenero: candidato.IdGenero,
                IdPresentacion: candidato.IdPresentacion,
                IdCategoria: candidato.IdCategoria,
                NombreCategoria: candidato.NombreCategoria
            };
            item.busquedaPresentacion = candidato.Presentacion || '';
            item.mostrarResultados = false;
            item.mostrarHistorico = false;
            item.especificando = false;
            this.cargarCategorias(item);
        },

        // Pedido de NetAgro cuya BESTELLNR/referencia CONTIENE la ref_pedido de la tarjeta.
        get pedidoRefActual() {
            return this.pedidoRefPedidos[this.pedidoRefIndice] || null;
        },

        etiquetaPedidoRef(pedido) {
            if (!pedido) return '';
            const partes = [this.formatFecha(pedido.PED_fechasalida)];
            if (pedido.PED_pedido) partes.push(`Pedido ${pedido.PED_pedido}`);
            const ref = pedido.PED_referencia || pedido.PED_BESTELLNR;
            if (ref) partes.push(String(ref).trim());
            partes.push(`${(pedido.lineas || []).length} lineas`);
            return partes.join(' - ');
        },

        async abrirPedidoRef(item) {
            const ref = (item.ref_pedido || '').toString().trim();
            if (!ref) {
                this.showToast("Esta linea no tiene referencia de pedido", "#dc2626");
                return;
            }
            if (item.buscandoPedidoRef) return;

            item.buscandoPedidoRef = true;
            try {
                const params = new URLSearchParams({
                    ref_pedido: ref,
                    idcliente: item.idcliente || 0
                });
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/pedidos-por-referencia?${params.toString()}`);
                if (!res.ok) throw new Error('Respuesta no OK');
                const data = await res.json();
                const pedidos = data.pedidos || [];
                // El backend reintenta sin el sufijo de parte (_2) si con la referencia
                // entera no sale nada, y dice con cual acabo buscando.
                const buscada = data.ref_buscada || ref;

                if (pedidos.length === 0) {
                    this.showToast(`Sin pedidos en NetAgro con la referencia ${buscada}`, "#f59e0b");
                    return;
                }

                this.pedidoRefItem = item;
                this.pedidoRefPedidos = pedidos;
                this.pedidoRefIndice = 0;
                this.pedidoRefBuscada = buscada;
                this.pedidoRefOpen = true;
            } catch (err) {
                console.error('Error buscando el pedido por referencia:', err);
                this.showToast("No se pudo consultar el pedido en NetAgro", "#dc2626");
            } finally {
                item.buscandoPedidoRef = false;
            }
        },

        cerrarPedidoRef() {
            this.pedidoRefOpen = false;
            this.pedidoRefItem = null;
            this.pedidoRefPedidos = [];
            this.pedidoRefIndice = 0;
            this.pedidoRefBuscada = '';
        },

        // Del pedido solo se coge el IdPresentacion: se escribe en el buscador de
        // "Especificar Presentacion" y se lanza la busqueda (el backend resuelve un
        // texto numerico como IdGenSal exacto), para que el usuario confirme el resultado.
        aplicarLineaPedido(linea) {
            const item = this.pedidoRefItem;
            if (!item || !linea || linea.IdPresentacion == null) {
                this.showToast("Esta linea del pedido no tiene presentacion asignada", "#dc2626");
                return;
            }

            item.especificando = true;
            item.busquedaPresentacion = String(linea.IdPresentacion);
            this.cerrarPedidoRef();
            // Diferido: el click que cierra el modal dispara el @click.away del buscador,
            // que apagaria mostrarResultados justo despues de encenderlo.
            setTimeout(() => this.buscarPresentaciones(item), 0);
        },

        // ---- Productos de <cliente> (Pedidos_Clientes del ERP, por destino) ----
        async abrirProductosCliente(item) {
            if (!item.idcliente) {
                this.showToast("Esta linea no tiene cliente", "#dc2626");
                return;
            }
            if (item.buscandoProductosCliente) return;

            item.buscandoProductosCliente = true;
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/productos-cliente?idcliente=${encodeURIComponent(item.idcliente)}`);
                if (!res.ok) throw new Error('Respuesta no OK');
                const data = await res.json();
                const generos = data.generos || [];
                if (generos.length === 0) {
                    this.showToast(`${item.cliente || 'Este cliente'} no tiene productos predefinidos en NetAgro`, "#f59e0b");
                    return;
                }

                this.prodCliItem = item;
                this.prodCliGeneros = generos;
                this.prodCliDestinos = data.destinos || [];
                this.prodCliDestino = '';
                this.prodCliDestinoPedido = null;
                this.prodCliFiltro = '';
                this.prodCliOrden = 'uso';
                this.prodCliVerBajas = false;
                this.prodCliSoloUsadas = false;
                this.prodCliOpen = true;
                this.preseleccionarDestinoPedido(item);
            } catch (err) {
                console.error('Error cargando productos del cliente:', err);
                this.showToast("No se pudieron cargar los productos del cliente", "#dc2626");
            } finally {
                item.buscandoProductosCliente = false;
            }
        },

        // El destino del pedido se preselecciona: primero el que trae la card (id_destino, lo
        // manda el PHP o lo rellena el mapping de la direccion) y, si no, el del pedido de
        // NetAgro con esta referencia. Es una pista, no bloquea: si no hay (o ese destino no
        // tiene predefinidos) se quedan todos los destinos.
        async preseleccionarDestinoPedido(item) {
            const idCard = item.id_destino != null ? String(item.id_destino) : '';
            if (idCard && this.prodCliDestinos.some(d => String(d.IdDestino) === idCard)) {
                this.prodCliDestinoPedido = idCard;
                if (this.prodCliDestino === '') this.prodCliDestino = idCard;
                return;
            }
            const ref = (item.ref_pedido || '').toString().trim();
            if (!ref) return;
            try {
                const params = new URLSearchParams({ ref_pedido: ref, idcliente: item.idcliente || 0 });
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/pedidos-por-referencia?${params.toString()}`);
                if (!res.ok) return;
                const data = await res.json();
                const id = (data.pedidos || [])[0]?.destino?.id;
                if (id == null || this.prodCliItem !== item) return;
                if (!this.prodCliDestinos.some(d => String(d.IdDestino) === String(id))) return;
                this.prodCliDestinoPedido = String(id);
                // Solo si el usuario no ha elegido ya otro
                if (this.prodCliDestino === '') this.prodCliDestino = String(id);
            } catch (err) {
                console.error('Error buscando el destino del pedido:', err);
            }
        },

        // Una tarjeta por presentacion, agrupadas por genero. Con un destino elegido solo
        // cuentan las categorias que se pidieron en ese destino; la propuesta es la primera
        // valida (el backend las manda de la mas reciente a la mas antigua).
        // 'uso' = mas pedidos en 12 meses; 'reciente' = ultimo pedido (real o predefinido).
        get prodCliGrupos() {
            const palabras = this.prodCliFiltro.toLowerCase().split(/\s+/).filter(Boolean);
            const destino = this.prodCliDestino;
            const fecha = d => (d ? new Date(d).getTime() : 0);
            const orden = this.prodCliOrden === 'reciente'
                ? (a, b) => fecha(b.UltimoPedido) - fecha(a.UltimoPedido) || b.Pedidos12m - a.Pedidos12m
                : (a, b) => b.Pedidos12m - a.Pedidos12m || fecha(b.UltimoPedido) - fecha(a.UltimoPedido);
            return this.prodCliGeneros
                .map(g => {
                    const productos = g.productos
                        .filter(p => (this.prodCliVerBajas || p.Activa) && (!this.prodCliSoloUsadas || p.Pedidos12m > 0))
                        .map(p => {
                            const cats = destino === ''
                                ? p.Categorias
                                : p.Categorias.filter(c => c.Destinos.some(d => String(d) === destino));
                            return { ...p, cats, catSel: cats.find(c => c.Valido) || cats[0] };
                        })
                        .filter(p => {
                            if (p.cats.length === 0) return false;
                            if (palabras.length === 0) return true;
                            const texto = [p.Presentacion, p.Genero, p.Marca, p.IdPresentacion,
                                ...p.cats.flatMap(c => [c.IdCategoria, c.NombreCategoria])]
                                .join(' ').toLowerCase();
                            return palabras.every(w => texto.includes(w));
                        })
                        .sort(orden);
                    // El genero se ordena por la suma de pedidos o por su ultimo pedido
                    return {
                        ...g,
                        productos,
                        Pedidos12m: productos.reduce((n, p) => n + p.Pedidos12m, 0),
                        UltimoPedido: productos.reduce((m, p) => (fecha(p.UltimoPedido) > fecha(m) ? p.UltimoPedido : m), null)
                    };
                })
                .filter(g => g.productos.length > 0)
                .sort(orden);
        },

        // Cuantas presentaciones esconden los dos filtros, para ensenarlo en los checkbox
        get prodCliOcultas() {
            const todas = this.prodCliGeneros.flatMap(g => g.productos);
            return {
                bajas: todas.filter(p => !p.Activa).length,
                sinUso: todas.filter(p => !p.Pedidos12m).length
            };
        },

        get prodCliTotal() {
            return this.prodCliGrupos.reduce((n, g) => n + g.productos.length, 0);
        },

        etiquetaDestino(d) {
            const partes = [];
            if (d.NumeroDestino != null) partes.push(d.NumeroDestino);
            partes.push(d.Destino);
            return `${partes.join(' - ')} (${d.NumProductos})`;
        },

        cerrarProductosCliente() {
            this.prodCliOpen = false;
            this.prodCliItem = null;
            this.prodCliGeneros = [];
            this.prodCliDestinos = [];
            this.prodCliDestino = '';
            this.prodCliDestinoPedido = null;
            this.prodCliFiltro = '';
        },

        // La linea predefinida trae presentacion, genero y categoria ya validados por el
        // ERP, asi que se rellenan directamente, como con el historico. `cat` es una de las
        // categorias con las que el cliente ha pedido esa presentacion.
        aplicarProductoCliente(producto, cat) {
            const item = this.prodCliItem;
            const prod = producto && cat ? { ...producto, ...cat } : null;
            if (!item || !prod || !prod.Valido || prod.IdGenero == null || prod.IdPresentacion == null || prod.IdCategoria == null) {
                this.showToast("Este producto no tiene datos validos", "#dc2626");
                return;
            }
            item.id_genero = String(prod.IdGenero);
            item.id_gensal = String(prod.IdPresentacion);
            item.id_categoria = String(prod.IdCategoria);
            item.presentacionSeleccionada = {
                Presentacion: prod.Presentacion,
                Genero: prod.Genero,
                IdGenero: prod.IdGenero,
                IdPresentacion: prod.IdPresentacion,
                IdCategoria: prod.IdCategoria,
                NombreCategoria: prod.NombreCategoria
            };
            item.busquedaPresentacion = prod.Presentacion || '';
            item.mostrarResultados = false;
            item.mostrarHistorico = false;
            item.especificando = false;
            this.cerrarProductosCliente();
            this.cargarCategorias(item);
        },

        abrirPdf(item) {
            if (!item.pdf) return;
            const byteChars = atob(item.pdf);
            const byteArray = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
                byteArray[i] = byteChars.charCodeAt(i);
            }
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            this.pdfBlobUrl = URL.createObjectURL(blob);
            this.pdfModalOpen = true;
        },

        cerrarPdf() {
            this.pdfModalOpen = false;
            if (this.pdfBlobUrl) {
                URL.revokeObjectURL(this.pdfBlobUrl);
                this.pdfBlobUrl = null;
            }
        },

        formatFecha(fecha) {
            if (!fecha) return '-';
            const s = fecha.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
            const d = new Date(s);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        },

        async eliminar(item) {
            if (!confirm('¿Estás seguro de eliminar este mapping? Se eliminará de ambas bases de datos.')) {
                return;
            }

            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/${item.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.message || 'Error al eliminar');
                }

                // Eliminar del array local
                this.mappings = this.mappings.filter(m => m.id !== item.id);

                // Toast de éxito
                this.showToast("✅ Mapping eliminado correctamente de ambas bases de datos");

            } catch (error) {
                console.error('Error:', error);
                Toastify({
                    text: `❌ ${error.message}`,
                    duration: 4000,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "#ef4444",
                    stopOnFocus: true
                }).showToast();
            }
        }
    };
}
