export default {
    userEmail: '',
    userPermisos: [],
    counts: {
        pedidos: 0,
        transportes: 0
    },
    estadoPedidos: {
        current: null,
        pilotColor: 'gray'
    },
    estadoPedidosEurogroup: {
        current: null,
        pilotColor: 'gray'
    },
    estadoPedidosIberiana: {
        current: null,
        pilotColor: 'gray'
    },
    estadoPedidosIberianaTest: {
        current: null,
        pilotColor: 'gray'
    },
    async fetchUserInfo() {
        try {
            const res = await fetch('/oauth2/userinfo');
            const data = await res.json();
            this.userEmail = data.email || '';

            // Obtener permisos desde la BD
            try {
                const rolesRes = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/user-roles`);
                const rolesData = await rolesRes.json();
                const users = rolesData.users || [];
                const me = users.find(u => u.email === this.userEmail);
                this.userPermisos = me ? [...me.permisos] : [];
            } catch (e) {
                console.warn("No se pudieron obtener permisos de BD, usando env.js", e);
            }

            // Fallback: DEVELOPER_USERS de env.js obtiene todos los permisos
            if (this.userPermisos.length === 0) {
                const devs = window.env.DEVELOPER_USERS || [];
                if (devs.includes(this.userEmail)) {
                    this.userPermisos = ['pedidos', 'transportes', 'estado-pedidos', 'admin'];
                }
            }
        } catch (e) {
            console.error("Error fetching user info", e);
            // Sin OAuth2 (dev), dar acceso completo
            if (window.env.VERSION && window.env.VERSION.toLowerCase() === 'dev') {
                this.userPermisos = ['pedidos', 'transportes', 'estado-pedidos', 'admin'];
            } else {
                this.userPermisos = [];
            }
        }
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
    },
    async fetchEstadoPedidosEurogroup() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-eurogroup/actual`);
            const data = await res.json();
            this.estadoPedidosEurogroup.current = data.current;
            if (!data.current) {
                this.estadoPedidosEurogroup.pilotColor = 'gray';
            } else if (data.current.estado === 'error') {
                this.estadoPedidosEurogroup.pilotColor = 'red';
            } else {
                this.estadoPedidosEurogroup.pilotColor = 'green';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos eurogroup", e);
        }
    },
    async fetchEstadoPedidosIberiana() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-iberiana/actual`);
            const data = await res.json();
            this.estadoPedidosIberiana.current = data.current;
            if (!data.current) {
                this.estadoPedidosIberiana.pilotColor = 'gray';
            } else if (data.current.estado === 'error') {
                this.estadoPedidosIberiana.pilotColor = 'red';
            } else {
                this.estadoPedidosIberiana.pilotColor = 'green';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos iberiana", e);
        }
    },
    async fetchEstadoPedidosIberianaTest() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-iberiana-test/actual`);
            const data = await res.json();
            this.estadoPedidosIberianaTest.current = data.current;
            if (!data.current) {
                this.estadoPedidosIberianaTest.pilotColor = 'gray';
            } else if (data.current.estado === 'error') {
                this.estadoPedidosIberianaTest.pilotColor = 'red';
            } else {
                this.estadoPedidosIberianaTest.pilotColor = 'green';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos iberiana test", e);
        }
    }
}
