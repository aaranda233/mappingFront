export default {
    userEmail: '',
    userPermisos: [],
    bioMode: (typeof localStorage !== 'undefined' && localStorage.getItem('bioMode')) || 'BIO',
    setBioMode(value) {
        if (value !== 'BIO' && value !== 'Convencional') return;
        this.bioMode = value;
        try { localStorage.setItem('bioMode', value); } catch (e) {}
        // Refrescar fuentes que dependen del filtro
        this.fetchCounts();
        this.fetchEstadoPedidos();
        this.fetchEstadoPedidosEurogroup();
        this.fetchEstadoPedidosIberiana();
        this.fetchEstadoPedidosIberianaTest();
        this.fetchEstadoPedidosAnecoop();
        this.fetchEstadoPedidosAnecoopTest();
    },
    get bioCentro() {
        return this.bioMode === 'BIO' ? 10 : 1;
    },
    counts: {
        pedidos: 0,
        transportes: 0
    },
    estadoPedidos: {
        current: null,
        pilotColor: 'green'
    },
    estadoPedidosEurogroup: {
        current: null,
        pilotColor: 'gray'
    },
    estadoPedidosIberiana: {
        current: null,
        pilotColor: 'green'
    },
    estadoPedidosIberianaTest: {
        current: null,
        pilotColor: 'green'
    },
    estadoPedidosAnecoop: {
        current: null,
        pilotColor: 'gray'
    },
    estadoPedidosAnecoopTest: {
        current: null,
        pilotColor: 'gray'
    },
    async fetchUserInfo() {
        // En modo dev, asignar permisos base sin admin y saltar OAuth/BD
        if (window.env.VERSION && window.env.VERSION.toLowerCase() === 'dev') {
            this.userPermisos = ['pedidos', 'transportes', 'estado-pedidos'];
            return;
        }

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
            this.userPermisos = [];
        }
    },
    async fetchCounts() {
        try {
            // Fetch Pedidos count (filtrado por modo BIO/Convencional)
            const resPedidos = await fetch(`http://${window.env.IP_BACKEND}/api/mapping`);
            const pedidos = await resPedidos.json();
            const isBio = this.bioMode === 'BIO';
            this.counts.pedidos = pedidos.filter(p => {
                const desc = (p.descripcion || '').toUpperCase();
                return isBio ? desc.includes('BIO') : !desc.includes('BIO');
            }).length;

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
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos/actual?centro=${this.bioCentro}`);
            const data = await res.json();
            this.estadoPedidos.current = data.current;
            if (!data.current) {
                this.estadoPedidos.pilotColor = 'green';
            } else if (data.current.estado === 'procesando') {
                this.estadoPedidos.pilotColor = 'yellow';
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
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-eurogroup/actual?centro=${this.bioCentro}`);
            const data = await res.json();
            this.estadoPedidosEurogroup.current = data.current;
            if (!data.current) {
                this.estadoPedidosEurogroup.pilotColor = 'gray';
            } else if (data.current.estado === 'procesando') {
                this.estadoPedidosEurogroup.pilotColor = 'yellow';
            } else if (data.current.estado === 'error') {
                this.estadoPedidosEurogroup.pilotColor = 'red';
            } else {
                this.estadoPedidosEurogroup.pilotColor = 'gray';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos eurogroup", e);
        }
    },
    async fetchEstadoPedidosIberiana() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-iberiana/actual?centro=${this.bioCentro}`);
            const data = await res.json();
            this.estadoPedidosIberiana.current = data.current;
            if (!data.current) {
                this.estadoPedidosIberiana.pilotColor = 'green';
            } else if (data.current.estado === 'procesando') {
                this.estadoPedidosIberiana.pilotColor = 'yellow';
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
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-iberiana-test/actual?centro=${this.bioCentro}`);
            const data = await res.json();
            this.estadoPedidosIberianaTest.current = data.current;
            if (!data.current) {
                this.estadoPedidosIberianaTest.pilotColor = 'green';
            } else if (data.current.estado === 'procesando') {
                this.estadoPedidosIberianaTest.pilotColor = 'yellow';
            } else if (data.current.estado === 'error') {
                this.estadoPedidosIberianaTest.pilotColor = 'red';
            } else {
                this.estadoPedidosIberianaTest.pilotColor = 'green';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos iberiana test", e);
        }
    },
    async fetchEstadoPedidosAnecoop() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-anecoop/actual?centro=${this.bioCentro}`);
            const data = await res.json();
            this.estadoPedidosAnecoop.current = data.current;
            if (!data.current) {
                this.estadoPedidosAnecoop.pilotColor = 'gray';
            } else if (data.current.estado === 'procesando') {
                this.estadoPedidosAnecoop.pilotColor = 'yellow';
            } else if (data.current.estado === 'error') {
                this.estadoPedidosAnecoop.pilotColor = 'red';
            } else {
                this.estadoPedidosAnecoop.pilotColor = 'gray';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos anecoop", e);
        }
    },
    async fetchEstadoPedidosAnecoopTest() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-anecoop-test/actual?centro=${this.bioCentro}`);
            const data = await res.json();
            this.estadoPedidosAnecoopTest.current = data.current;
            if (!data.current) {
                this.estadoPedidosAnecoopTest.pilotColor = 'gray';
            } else if (data.current.estado === 'procesando') {
                this.estadoPedidosAnecoopTest.pilotColor = 'yellow';
            } else if (data.current.estado === 'error') {
                this.estadoPedidosAnecoopTest.pilotColor = 'red';
            } else {
                this.estadoPedidosAnecoopTest.pilotColor = 'gray';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos anecoop test", e);
        }
    }
}
