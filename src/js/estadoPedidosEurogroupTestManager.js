export default function estadoPedidosEurogroupTestManager() {
    return {
        current: null,
        historial: [],
        loaded: false,
        historialLoaded: false,
        loading: false,
        loadingHistorial: false,
        showHistorial: false,
        showPedidoModal: false,
        pedidoDetail: null,
        pedidoLineas: [],
        selectedLinea: null,
        // Producción
        pedidoDetailProd: null,
        pedidoLineasProd: [],
        selectedLineaProd: null,
        prodNotFound: false,

        init() {
            this._log('init() montado, filtro=' + this._centroKey());
            this._hydrateFromCache();
            this.loadEstadoActual();
            setInterval(() => this.loadEstadoActual(), 1000);
            setInterval(() => { if (this.showHistorial) this.loadHistorial(); }, 5000);
            if (window.Alpine) {
                let primero = true;
                let centroPrev = this._centroKey();
                window.Alpine.effect(() => {
                    const centroNew = window.Alpine.store('global').bioCentro;
                    void centroNew;
                    if (primero) { primero = false; return; }
                    this._log('CAMBIO DE FILTRO ' + centroPrev + ' -> ' + this._centroKey());
                    centroPrev = this._centroKey();
                    this._hydrateFromCache();
                    this.loadEstadoActual();
                    if (this.showHistorial) this.loadHistorial();
                });
            }
        },

        _seqActual: 0,
        _seqHist: 0,
        _log(...a) { try { console.log('[' + this._endpoint + ' ' + new Date().toISOString().slice(11, 23) + ']', ...a); } catch (e) {} },

        _centroQuery() {
            const c = window.Alpine && window.Alpine.store('global')?.bioCentro;
            return c == null ? '' : `?centro=${c}`;
        },

        _endpoint: 'estado-pedidos-eurogroup-test',

        _centroKey() {
            const c = window.Alpine && window.Alpine.store('global')?.bioCentro;
            return c == null ? 'todos' : String(c);
        },

        _cacheKeyCurrent() { return `${this._endpoint}:current:${this._centroKey()}`; },
        _cacheKeyHistorial() { return `${this._endpoint}:historial:${this._centroKey()}`; },

        _hydrateFromCache() {
            try {
                const kc = this._cacheKeyCurrent();
                const kh = this._cacheKeyHistorial();
                const c = sessionStorage.getItem(kc);
                const h = sessionStorage.getItem(kh);
                if (c !== null) {
                    this.current = JSON.parse(c);
                    this.loaded = true;
                } else {
                    this.current = null;
                    this.loaded = false;
                }
                this.historial = h !== null ? JSON.parse(h) : [];
                this.historialLoaded = (h !== null);
                this._log('hydrateFromCache ' + kc + ' ' + (c !== null ? 'HIT' : 'MISS') + ' | ' + kh + ' historial=' + this.historial.length);
            } catch (e) {
                this.current = null;
                this.historial = [];
                this.loaded = false;
                this._log('hydrateFromCache ERROR ' + (e && e.message));
            }
        },

        async loadEstadoActual() {
            const seq = ++this._seqActual;
            const filtro = this._centroKey();
            const url = `http://${window.env.IP_BACKEND}/api/mapping/${this._endpoint}/actual${this._centroQuery()}`;
            this._log('loadEstadoActual #' + seq + ' GET ' + url);
            try {
                const res = await fetch(url);
                const data = await res.json();
                if (filtro !== this._centroKey()) {
                    this._log('loadEstadoActual #' + seq + ' DESCARTADA stale (filtroEnvio=' + filtro + ' filtroActual=' + this._centroKey() + ' seqActual=' + this._seqActual + ')');
                    return;
                }
                const changed = JSON.stringify(this.current) !== JSON.stringify(data.current);
                if (changed) this.current = data.current;
                try { sessionStorage.setItem(this._cacheKeyCurrent(), JSON.stringify(data.current ?? null)); } catch (e) {}
                this._log('loadEstadoActual #' + seq + ' OK status=' + res.status + ' changed=' + changed + ' current=' + (data.current ? ('ref=' + data.current.ref_pedido + ' estado=' + data.current.estado + ' centro=' + data.current.centro) : 'null'));
            } catch (err) {
                this._log('loadEstadoActual #' + seq + ' ERROR ' + (err && err.message));
                console.error('Error cargando estado actual ' + this._endpoint + ':', err);
            } finally {
                this.loaded = true;
            }
        },

        async loadHistorial() {
            const seq = ++this._seqHist;
            const filtro = this._centroKey();
            const url = `http://${window.env.IP_BACKEND}/api/mapping/${this._endpoint}/historial${this._centroQuery()}`;
            this._log('loadHistorial #' + seq + ' GET ' + url);
            try {
                const res = await fetch(url);
                const incoming = await res.json();
                if (filtro !== this._centroKey()) {
                    this._log('loadHistorial #' + seq + ' DESCARTADA stale (filtroEnvio=' + filtro + ' filtroActual=' + this._centroKey() + ')');
                    return;
                }
                const lista = Array.isArray(incoming) ? incoming : [];
                const ids = new Set(lista.map(h => h.id));
                this.historial = this.historial.filter(h => ids.has(h.id));
                for (const item of lista) {
                    const idx = this.historial.findIndex(h => h.id === item.id);
                    if (idx === -1) this.historial.push(item);
                    else if (JSON.stringify(this.historial[idx]) !== JSON.stringify(item)) this.historial[idx] = item;
                }
                const orden = new Map(lista.map((h, i) => [h.id, i]));
                this.historial.sort((a, b) => orden.get(a.id) - orden.get(b.id));
                try { sessionStorage.setItem(this._cacheKeyHistorial(), JSON.stringify(lista)); } catch (e) {}
                this.historialLoaded = true;
                this._log('loadHistorial #' + seq + ' OK status=' + res.status + ' recibidos=' + lista.length + ' total=' + this.historial.length + ' filtro=' + filtro);
            } catch (err) {
                this._log('loadHistorial #' + seq + ' ERROR ' + (err && err.message));
                console.error('Error cargando historial ' + this._endpoint + ':', err);
            }
        },

        toggleHistorial() {
            this.showHistorial = !this.showHistorial;
            if (this.showHistorial) {
                this.loadHistorial();
            }
        },

        async openPedidoDetail(item) {
            this.showPedidoModal = true;
            this.pedidoDetail = null;
            this.pedidoLineas = [];
            this.selectedLinea = null;
            this.pedidoDetailProd = null;
            this.pedidoLineasProd = [];
            this.selectedLineaProd = null;
            this.prodNotFound = false;
            console.log('[TEST] Item del historial clicado:', JSON.stringify(item));
            try {
                // ── Cargar datos de TEST ──
                const idpedido = item.id_pedido_net;
                const numPedido = item.pedido;
                const usarNumPedido = !idpedido || idpedido === 0;
                console.log('[TEST] id_pedido_net:', idpedido, '| pedido:', numPedido, '| buscar por:', usarNumPedido ? 'numPedido' : 'idpedido');
                const urlHeader = usarNumPedido
                    ? `http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-eurogroup-test/pedido-by-num/${numPedido}?cliente=${encodeURIComponent(item.cliente ?? '')}`
                    : `http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-eurogroup-test/pedido/${idpedido}`;
                console.log('[TEST] Fetch cabecera URL:', urlHeader);
                const resHeader = await fetch(urlHeader);
                console.log('[TEST] Respuesta cabecera status:', resHeader.status);
                const header = await resHeader.json();
                console.log('[TEST] Datos cabecera:', JSON.stringify(header));
                this._log('detalle pedido=' + numPedido + ' -> cliente resuelto=' + (header && header.PED_idcliente) + ' NomCliente=' + (header && header.NomCliente) + ' centro=' + (header && header.PED_idcentro) + ' idpedido=' + (header && header.PED_idpedido));
                this.pedidoDetail = header;

                if (this.pedidoDetail?.PED_idpedido) {
                    const urlLineas = `http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-eurogroup-test/pedido-lineas/${this.pedidoDetail.PED_idpedido}`;
                    console.log('[TEST] Fetch lineas URL:', urlLineas);
                    const resLineas = await fetch(urlLineas);
                    console.log('[TEST] Respuesta lineas status:', resLineas.status);
                    const lineas = await resLineas.json();
                    console.log('[TEST] Datos lineas:', JSON.stringify(lineas));
                    this.pedidoLineas = lineas;
                } else {
                    console.warn('[TEST] No se encontró PED_idpedido en la cabecera, no se buscan líneas');
                }

                // ── Cargar datos de PRODUCCION (cascada: referencia, bestellnr, referencia LIKE) ──
                const bestellnr = this.pedidoDetail?.PED_BESTELLNR;
                const cliente = this.pedidoDetail?.PED_idcliente;
                const fechapedido = this.pedidoDetail?.PED_fechapedido ? new Date(this.pedidoDetail.PED_fechapedido).toISOString().split('T')[0] : '';
                const iddestino = this.pedidoDetail?.PED_iddestino;
                const referencia = this.pedidoDetail?.PED_referencia;
                if (cliente) {
                    const params = new URLSearchParams();
                    params.set('cliente', cliente);
                    if (bestellnr) params.set('bestellnr', bestellnr);
                    if (fechapedido) params.set('fechapedido', fechapedido);
                    if (iddestino) params.set('iddestino', iddestino);
                    if (referencia) params.set('referencia', referencia);
                    console.log('[PROD] Buscando en producción:', params.toString());
                    const urlProd = `http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-eurogroup-test/pedido-prod?${params.toString()}`;
                    const resProd = await fetch(urlProd);
                    if (resProd.status === 404) {
                        console.log('[PROD] No encontrado en producción');
                        this.prodNotFound = true;
                    } else if (resProd.ok) {
                        const prodData = await resProd.json();
                        console.log('[PROD] Datos producción:', JSON.stringify(prodData));
                        this.pedidoDetailProd = prodData.header;
                        this.pedidoLineasProd = prodData.lineas;
                    }
                } else {
                    console.warn('[PROD] No hay cliente para buscar en producción');
                    this.prodNotFound = true;
                }
            } catch (err) {
                console.error("Error cargando detalle pedido Eurogroup Test:", err);
            }
        },

        closePedidoModal() {
            this.showPedidoModal = false;
            this.pedidoDetail = null;
            this.pedidoLineas = [];
            this.selectedLinea = null;
            this.pedidoDetailProd = null;
            this.pedidoLineasProd = [];
            this.selectedLineaProd = null;
            this.prodNotFound = false;
        },

        pilotColor() {
            if (!this.current) return 'gray';
            if (this.current.estado === 'procesando') return 'yellow';
            if (this.current.estado === 'error') return 'red';
            return 'gray';
        },

        formatFecha(fecha) {
            if (!fecha) return '-';
            const s = fecha.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
            const d = new Date(s);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            const ss = String(d.getSeconds()).padStart(2, '0');
            return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss}`;
        },

        // -- Comparacion TEST vs PROD --

        _normalize(v) {
            if (v == null) return '';
            return String(v).trim();
        },

        diffH(field) {
            if (!this.pedidoDetail || !this.pedidoDetailProd) return false;
            return this._normalize(this.pedidoDetail[field]) !== this._normalize(this.pedidoDetailProd[field]);
        },

        diffL(field) {
            const idxT = this.selectedLinea ?? 0;
            const idxP = this.selectedLineaProd ?? 0;
            const lt = this.pedidoLineas[idxT];
            const lp = this.pedidoLineasProd[idxP];
            if (!lt || !lp) return false;
            return this._normalize(lt[field]) !== this._normalize(lp[field]);
        },

        headerDiffs() {
            if (!this.pedidoDetail || !this.pedidoDetailProd) return [];
            const fields = [
                ['PED_pedido', 'Pedido'],
                ['PED_fechapedido', 'F.Pedido'],
                ['PED_fechasalida', 'F.Salida'],
                ['PED_FechaLlegada', 'F.Llegada'],
                ['PED_idcliente', 'ID Cliente'],
                ['NomCliente', 'Cliente'],
                ['PED_referencia', 'Referencia'],
                ['PED_iddestino', 'ID Destino'],
                ['NomDestino', 'Destino'],
                ['PED_idporte', 'ID Porte'],
                ['NomTipoPorte', 'Tipo Porte'],
                ['PED_idtransportista', 'ID Transp.'],
                ['NomTransportista', 'Transportista'],
                ['PED_iddivisa', 'ID Divisa'],
                ['NomDivisa', 'Divisa'],
                ['PED_matriculacamion', 'Matr. Camion'],
                ['PED_matricularemolque', 'Matr. Remolque'],
                ['PED_valorcambio', 'Valor Cambio'],
                ['PED_MovilChofer', 'Movil Chofer'],
                ['PED_TransporteRapidoSN', 'Transp. Rapido'],
                ['PED_Lote', 'Lote'],
                ['PED_BESTELLNR', 'BESTELLNR'],
                ['PED_obs1', 'Obs 1'],
                ['PED_obs2', 'Obs 2'],
                ['PED_obs3', 'Obs 3'],
            ];
            const diffs = [];
            for (const [f, label] of fields) {
                if (this.diffH(f)) {
                    let vT = this.pedidoDetail[f];
                    let vP = this.pedidoDetailProd[f];
                    if (f.toLowerCase().includes('fecha')) {
                        vT = this.formatFecha(vT);
                        vP = this.formatFecha(vP);
                    }
                    diffs.push({ campo: label, test: vT ?? '-', prod: vP ?? '-' });
                }
            }
            return diffs;
        },

        lineaDiffs() {
            const idxT = this.selectedLinea ?? 0;
            const idxP = this.selectedLineaProd ?? 0;
            const lt = this.pedidoLineas[idxT];
            const lp = this.pedidoLineasProd[idxP];
            if (!lt || !lp) return [];
            const fields = [
                ['PEL_idgenero', 'ID Genero'],
                ['NomGenero', 'Genero'],
                ['PEL_idtipoconfeccion', 'ID Confeccion'],
                ['NomConfeccion', 'Confeccion'],
                ['PEL_idgensal', 'ID GenSal'],
                ['Presentacion', 'Presentacion'],
                ['PEL_idcategoria', 'ID Categoria'],
                ['NomCategoria', 'Categoria'],
                ['PEL_idtipopalet', 'ID Tipo Palet'],
                ['TipoPalet', 'Tipo Palet'],
                ['Coeficiente', 'Coeficiente'],
                ['PEL_idmarca', 'ID Marca'],
                ['NomMarca', 'Marca'],
                ['Palets', 'Palets'],
                ['BxPalet', 'B/Palet'],
                ['Bultos', 'Bultos'],
                ['KxBulto', 'K/Bulto'],
                ['KNetos', 'K.Netos'],
                ['PzxBulto', 'Pz/Bulto'],
                ['KBrutos', 'K.Brutos'],
                ['Piezas', 'Piezas'],
                ['Precio', 'Precio'],
                ['KBP', 'KBP'],
                ['Lote', 'Lote'],
                ['ObsConfec1', 'Obs.Confec 1'],
                ['ObsConfec2', 'Obs.Confec 2'],
                ['Calidad', 'Calidad'],
                ['MaxDias', 'Max Dias'],
                ['ReservaPalets', 'Reserva Palets'],
            ];
            const diffs = [];
            for (const [f, label] of fields) {
                if (this._normalize(lt[f]) !== this._normalize(lp[f])) {
                    diffs.push({ campo: label, test: lt[f] ?? '-', prod: lp[f] ?? '-' });
                }
            }
            return diffs;
        }

    };
}
