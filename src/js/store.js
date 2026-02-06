export default {
    counts: {
        pedidos: 0,
        transportes: 0
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
    }
}
