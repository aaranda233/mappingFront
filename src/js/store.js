export default {
    counts: {
        pedidos: 0,
        transportes: 0
    },
    estadoPedidos: {
        current: null,
        pilotColor: 'gray'
    },
    async fetchCounts() {
        try {
            // Fetch Pedidos count
            const resPedidos = await fetch(`http://${window.env.IP_BACKEND}/api/mapping`);
            const pedidos = await resPedidos.json();
            this.counts.pedidos = pedidos.length;

            // Fetch Transportes count
            const resTransportes = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/transportes`);
            const transportes = await resTransportes.json();
            this.counts.transportes = transportes.length;
        } catch (e) {
            console.error("Error fetching counts", e);
        }
    },
    async fetchEstadoPedidos() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos/actual`);
            const data = await res.json();
            this.estadoPedidos.current = data.current;
            if (!data.current) {
                this.estadoPedidos.pilotColor = 'gray';
            } else if (data.current.estado === 'error') {
                this.estadoPedidos.pilotColor = 'red';
            } else {
                this.estadoPedidos.pilotColor = 'green';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos", e);
        }
    }
}
