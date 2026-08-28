export default function estadoPedidosEurogroupManager() {
    return {
        current: null,
        historial: [],
        loaded: false,
        historialLoaded: false,
        loading: false,
        loadingHistorial: false,
        showHistorial: false,

        init() {
            this._log('init() montado, filtro=' + this._centroKey());
            this._hydrateFromCache();
            this.loadEstadoActual();
            setInterval(() => this.loadEstadoActual(true), 5000);
            setInterval(() => { if (this.showHistorial) this.loadHistorial(true); }, 5000);
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
                    this.historialLoaded = false; this.historial = [];
                    this.loadEstadoActual();
                    this.loadHistorial();
                });
            }
        },

        _seqActual: 0,
        _seqHist: 0,
        _actualEnVuelo: false,
        _histEnVuelo: false,
        _log(...a) { try { console.log('[' + this._endpoint + ' ' + new Date().toISOString().slice(11, 23) + ']', ...a); } catch (e) {} },

        _centroQuery() {
            const c = window.Alpine && window.Alpine.store('global')?.bioCentro;
            return c == null ? '' : `?centro=${c}`;
        },

        _endpoint: 'estado-pedidos-eurogroup',

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

        // sondeo=true solo desde el setInterval: si la anterior sigue en vuelo se salta.
        // Las llamadas explicitas (filtro, refrescar) entran siempre.
        async loadEstadoActual(sondeo = false) {
            if (sondeo && this._actualEnVuelo) return;
            this._actualEnVuelo = true;
            const seq = ++this._seqActual;
            const filtro = this._centroKey();
            const url = `http://${window.env.IP_BACKEND}/api/mapping/${this._endpoint}/actual${this._centroQuery()}`;
            this._log('loadEstadoActual #' + seq + ' GET ' + url);
            try {
                const res = await fetch(url);
                if (!res.ok) { this._log('loadEstadoActual #' + seq + ' ERROR HTTP ' + res.status); return; }
                const data = await res.json();
                if (filtro !== this._centroKey()) {
                    this._log('loadEstadoActual #' + seq + ' DESCARTADA stale (filtroEnvio=' + filtro + ' filtroActual=' + this._centroKey() + ' seqActual=' + this._seqActual + ')');
                    return;
                }
                const changed = JSON.stringify(this.current) !== JSON.stringify(data.current);
                if (changed) this.current = data.current;
                try { sessionStorage.setItem(this._cacheKeyCurrent(), JSON.stringify(data.current ?? null)); } catch (e) {}
                this._log('loadEstadoActual #' + seq + ' OK status=' + res.status + ' changed=' + changed + ' current=' + (data.current ? ('ref=' + data.current.ref_pedido + ' estado=' + data.current.estado + ' centro=' + data.current.idCentro) : 'null'));
            } catch (err) {
                this._log('loadEstadoActual #' + seq + ' ERROR ' + (err && err.message));
                console.error('Error cargando estado actual ' + this._endpoint + ':', err);
            } finally {
                this._actualEnVuelo = false;
                this.loaded = true;
            }
        },

        async loadHistorial(sondeo = false) {
            if (sondeo && this._histEnVuelo) return;
            this._histEnVuelo = true;
            const seq = ++this._seqHist;
            const filtro = this._centroKey();
            const url = `http://${window.env.IP_BACKEND}/api/mapping/${this._endpoint}/historial${this._centroQuery()}`;
            this._log('loadHistorial #' + seq + ' GET ' + url);
            try {
                const res = await fetch(url);
                if (!res.ok) { this._log('loadHistorial #' + seq + ' ERROR HTTP ' + res.status + ' (se conserva lo que ya hay)'); return; }
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
            } finally {
                this._histEnVuelo = false;
            }
        },

        toggleHistorial() {
            this.showHistorial = !this.showHistorial;
            if (this.showHistorial) {
                this.loadHistorial();
            }
        },

        refrescar() {
            this.historialLoaded = false;
            this.historial = [];
            this.loadEstadoActual();
            this.loadHistorial();
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
        }
    };
}
