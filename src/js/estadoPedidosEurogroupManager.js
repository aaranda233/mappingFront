export default function estadoPedidosEurogroupManager() {
    return {
        current: null,
        historial: [],
        loaded: false,
        loading: false,
        loadingHistorial: false,
        showHistorial: false,

        init() {
            this._hydrateFromCache();
            this.loadEstadoActual();
            setInterval(() => this.loadEstadoActual(), 1000);
            setInterval(() => { if (this.showHistorial) this.loadHistorial(); }, 5000);
            if (window.Alpine) {
                let primero = true;
                window.Alpine.effect(() => {
                    void window.Alpine.store('global').bioCentro;
                    if (primero) { primero = false; return; }
                    this._hydrateFromCache();
                    this.loadEstadoActual();
                    if (this.showHistorial) this.loadHistorial();
                });
            }
        },

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
                const c = sessionStorage.getItem(this._cacheKeyCurrent());
                const h = sessionStorage.getItem(this._cacheKeyHistorial());
                if (c !== null) {
                    this.current = JSON.parse(c);
                    this.loaded = true;
                } else {
                    this.current = null;
                    this.loaded = false;
                }
                this.historial = h !== null ? JSON.parse(h) : [];
            } catch (e) {
                this.current = null;
                this.historial = [];
                this.loaded = false;
            }
        },

        async loadEstadoActual() {
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-eurogroup/actual${this._centroQuery()}`);
                const data = await res.json();
                if (JSON.stringify(this.current) !== JSON.stringify(data.current)) {
                    this.current = data.current;
                }
                try { sessionStorage.setItem(this._cacheKeyCurrent(), JSON.stringify(data.current ?? null)); } catch (e) {}
            } catch (err) {
                console.error("Error cargando estado actual Eurogroup:", err);
            } finally {
                this.loaded = true;
            }
        },

        async loadHistorial() {
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-eurogroup/historial${this._centroQuery()}`);
                const incoming = await res.json();
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
            } catch (err) {
                console.error("Error cargando historial Eurogroup:", err);
            }
        },

        toggleHistorial() {
            this.showHistorial = !this.showHistorial;
            if (this.showHistorial) {
                this.loadHistorial();
            }
        },

        pilotColor() {
            if (!this.current) return 'gray';
            if (this.current.estado === 'procesando') return 'yellow';
            if (this.current.estado === 'error') return 'red';
            return 'gray';
        },

        formatFecha(fecha) {
            if (!fecha) return '-';
            const d = new Date(fecha);
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
