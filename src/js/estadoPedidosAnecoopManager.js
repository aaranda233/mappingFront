export default function estadoPedidosAnecoopManager() {
    return {
        current: null,
        historial: [],
        loading: false,
        loadingHistorial: false,
        showHistorial: false,

        init() {
            this.loadEstadoActual();
            setInterval(() => this.loadEstadoActual(), 1000);
            setInterval(() => { if (this.showHistorial) this.loadHistorial(); }, 5000);
        },

        _centroQuery() {
            const c = window.Alpine && window.Alpine.store('global')?.bioCentro;
            return c == null ? '' : `?centro=${c}`;
        },

        async loadEstadoActual() {
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-anecoop/actual${this._centroQuery()}`);
                const data = await res.json();
                this.current = data.current;
            } catch (err) {
                console.error("Error cargando estado actual Anecoop:", err);
            }
        },

        async loadHistorial() {
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-anecoop/historial${this._centroQuery()}`);
                this.historial = await res.json();
            } catch (err) {
                console.error("Error cargando historial Anecoop:", err);
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
