export default function estadoPedidosIberianaTestManager() {
    return {
        current: null,
        historial: [],
        loading: false,
        loadingHistorial: false,
        showHistorial: false,
        showPedidoModal: false,
        pedidoDetail: null,
        pedidoLineas: [],
        selectedLinea: null,

        init() {
            this.loadEstadoActual();
            setInterval(() => this.loadEstadoActual(), 1000);
            setInterval(() => { if (this.showHistorial) this.loadHistorial(); }, 5000);
        },

        async loadEstadoActual() {
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-iberiana-test/actual`);
                const data = await res.json();
                this.current = data.current;
            } catch (err) {
                console.error("Error cargando estado actual Iberiana Test:", err);
            }
        },

        async loadHistorial() {
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-iberiana-test/historial`);
                this.historial = await res.json();
            } catch (err) {
                console.error("Error cargando historial Iberiana Test:", err);
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
            console.log('[TEST] Item del historial clicado:', JSON.stringify(item));
            try {
                const idpedido = item.id_pedido_net;
                const numPedido = item.pedido;
                const usarNumPedido = !idpedido || idpedido === 0;
                console.log('[TEST] id_pedido_net:', idpedido, '| pedido:', numPedido, '| buscar por:', usarNumPedido ? 'numPedido' : 'idpedido');
                const urlHeader = usarNumPedido
                    ? `http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-iberiana-test/pedido-by-num/${numPedido}`
                    : `http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-iberiana-test/pedido/${idpedido}`;
                console.log('[TEST] Fetch cabecera URL:', urlHeader);
                const resHeader = await fetch(urlHeader);
                console.log('[TEST] Respuesta cabecera status:', resHeader.status);
                const header = await resHeader.json();
                console.log('[TEST] Datos cabecera:', JSON.stringify(header));
                this.pedidoDetail = header;

                if (this.pedidoDetail?.PED_idpedido) {
                    const urlLineas = `http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-iberiana-test/pedido-lineas/${this.pedidoDetail.PED_idpedido}`;
                    console.log('[TEST] Fetch lineas URL:', urlLineas);
                    const resLineas = await fetch(urlLineas);
                    console.log('[TEST] Respuesta lineas status:', resLineas.status);
                    const lineas = await resLineas.json();
                    console.log('[TEST] Datos lineas:', JSON.stringify(lineas));
                    this.pedidoLineas = lineas;
                } else {
                    console.warn('[TEST] No se encontró PED_idpedido en la cabecera, no se buscan líneas');
                }
            } catch (err) {
                console.error("Error cargando detalle pedido Iberiana Test:", err);
            }
        },

        closePedidoModal() {
            this.showPedidoModal = false;
            this.pedidoDetail = null;
            this.pedidoLineas = [];
            this.selectedLinea = null;
        },

        pilotColor() {
            if (!this.current) return 'gray';
            if (this.current.estado === 'error') return 'red';
            return 'green';
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
