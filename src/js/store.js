export default {
    userEmail: '',
    userPermisos: [],
    bioMode: (typeof localStorage !== 'undefined' && localStorage.getItem('bioMode')) || 'BIO',
    mostrarTodos: (() => {
        if (typeof localStorage === 'undefined') return true;
        const v = localStorage.getItem('mostrarTodos');
        return v === null ? true : v === 'true';
    })(),
    setBioMode(value) {
        if (this.mostrarTodos) return;
        if (value !== 'BIO' && value !== 'Convencional') return;
        this.bioMode = value;
        try { localStorage.setItem('bioMode', value); } catch (e) {}
        this._refreshAllSources();
    },
    setMostrarTodos(value) {
        this.mostrarTodos = !!value;
        try { localStorage.setItem('mostrarTodos', this.mostrarTodos ? 'true' : 'false'); } catch (e) {}
        this._refreshAllSources();
    },
    _refreshAllSources() {
        this.fetchCounts();
        this.fetchEstadoPedidos();
        this.fetchEstadoPedidosEurogroup();
        this.fetchEstadoPedidosEurogroupTest();
        this.fetchEstadoPedidosIberiana();
        this.fetchEstadoPedidosIberianaTest();
        this.fetchEstadoPedidosGreenyard();
        this.fetchEstadoPedidosGreenyardTest();
        this.fetchEstadoPedidosAnecoop();
        this.fetchEstadoPedidosAnecoopTest();
        this.fetchEstadoPedidosAlfruit();
        this.fetchEstadoPedidosAlfruitTest();
    },
    get bioCentro() {
        if (this.mostrarTodos) return null;
        return this.bioMode === 'BIO' ? 10 : 1;
    },
    _centroQuery() {
        return this.bioCentro === null ? '' : `?centro=${this.bioCentro}`;
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
    estadoPedidosEurogroupTest: {
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
    estadoPedidosGreenyard: {
        current: null,
        pilotColor: 'gray'
    },
    estadoPedidosGreenyardTest: {
        current: null,
        pilotColor: 'gray'
    },
    estadoPedidosAnecoop: {
        current: null,
        pilotColor: 'gray'
    },
    estadoPedidosAnecoopTest: {
        current: null,
        pilotColor: 'gray'
    },
    estadoPedidosAlfruit: {
        current: null,
        pilotColor: 'gray'
    },
    estadoPedidosAlfruitTest: {
        current: null,
        pilotColor: 'gray'
    },
    greenyard: {
        pilotColor: 'gray'  // gray = sin comprobar, green = parser activo, red = inactivo
    },
    async fetchGreenyardHealth() {
        // Se consulta al parser a través del backend (proxy /api/mapping/greenyard),
        // porque el navegador no alcanza la ClusterIP interna del parser.
        const backend = window.env?.IP_BACKEND;
        if (!backend) { this.greenyard.pilotColor = 'gray'; return; }
        try {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 4000);
            const res = await fetch(`http://${backend}/api/mapping/greenyard/health`, { signal: ctrl.signal });
            clearTimeout(t);
            this.greenyard.pilotColor = res.ok ? 'green' : 'red';
        } catch (e) {
            this.greenyard.pilotColor = 'red';
        }
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
            // Fetch Pedidos count (filtrado por PED_idCentro en backend si no es Mostrar Todos)
            const resPedidos = await fetch(`http://${window.env.IP_BACKEND}/api/mapping${this._centroQuery()}`);
            const pedidos = await resPedidos.json();
            this.counts.pedidos = pedidos.length;

            // Fetch Transportes count (filtrado por PED_idcentro en backend si no es Mostrar Todos)
            const resTransportes = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/transportes${this._centroQuery()}`);
            const transportes = await resTransportes.json();
            this.counts.transportes = transportes.length;
        } catch (e) {
            console.error("Error fetching counts", e);
        }
    },
    async fetchEstadoPedidos() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos/actual${this._centroQuery()}`);
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
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-eurogroup/actual${this._centroQuery()}`);
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
    async fetchEstadoPedidosEurogroupTest() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-eurogroup-test/actual${this._centroQuery()}`);
            const data = await res.json();
            this.estadoPedidosEurogroupTest.current = data.current;
            if (!data.current) {
                this.estadoPedidosEurogroupTest.pilotColor = 'gray';
            } else if (data.current.estado === 'procesando') {
                this.estadoPedidosEurogroupTest.pilotColor = 'yellow';
            } else if (data.current.estado === 'error') {
                this.estadoPedidosEurogroupTest.pilotColor = 'red';
            } else {
                this.estadoPedidosEurogroupTest.pilotColor = 'gray';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos eurogroup test", e);
        }
    },
    async fetchEstadoPedidosIberiana() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-iberiana/actual${this._centroQuery()}`);
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
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-iberiana-test/actual${this._centroQuery()}`);
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
    async fetchEstadoPedidosGreenyard() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-greenyard/actual${this._centroQuery()}`);
            const data = await res.json();
            this.estadoPedidosGreenyard.current = data.current;
            if (!data.current) {
                this.estadoPedidosGreenyard.pilotColor = 'gray';
            } else if (data.current.estado === 'procesando') {
                this.estadoPedidosGreenyard.pilotColor = 'yellow';
            } else if (data.current.estado === 'error') {
                this.estadoPedidosGreenyard.pilotColor = 'red';
            } else {
                this.estadoPedidosGreenyard.pilotColor = 'gray';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos greenyard", e);
        }
    },
    async fetchEstadoPedidosGreenyardTest() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-greenyard-test/actual${this._centroQuery()}`);
            const data = await res.json();
            this.estadoPedidosGreenyardTest.current = data.current;
            if (!data.current) {
                this.estadoPedidosGreenyardTest.pilotColor = 'gray';
            } else if (data.current.estado === 'procesando') {
                this.estadoPedidosGreenyardTest.pilotColor = 'yellow';
            } else if (data.current.estado === 'error') {
                this.estadoPedidosGreenyardTest.pilotColor = 'red';
            } else {
                this.estadoPedidosGreenyardTest.pilotColor = 'gray';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos greenyard test", e);
        }
    },
    async fetchEstadoPedidosAnecoop() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-anecoop/actual${this._centroQuery()}`);
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
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-anecoop-test/actual${this._centroQuery()}`);
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
    },
    async fetchEstadoPedidosAlfruit() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-alfruit/actual${this._centroQuery()}`);
            const data = await res.json();
            this.estadoPedidosAlfruit.current = data.current;
            if (!data.current) {
                this.estadoPedidosAlfruit.pilotColor = 'gray';
            } else if (data.current.estado === 'procesando') {
                this.estadoPedidosAlfruit.pilotColor = 'yellow';
            } else if (data.current.estado === 'error') {
                this.estadoPedidosAlfruit.pilotColor = 'red';
            } else {
                this.estadoPedidosAlfruit.pilotColor = 'gray';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos alfruit", e);
        }
    },
    async fetchEstadoPedidosAlfruitTest() {
        try {
            const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/estado-pedidos-alfruit-test/actual${this._centroQuery()}`);
            const data = await res.json();
            this.estadoPedidosAlfruitTest.current = data.current;
            if (!data.current) {
                this.estadoPedidosAlfruitTest.pilotColor = 'gray';
            } else if (data.current.estado === 'procesando') {
                this.estadoPedidosAlfruitTest.pilotColor = 'yellow';
            } else if (data.current.estado === 'error') {
                this.estadoPedidosAlfruitTest.pilotColor = 'red';
            } else {
                this.estadoPedidosAlfruitTest.pilotColor = 'gray';
            }
        } catch (e) {
            console.error("Error fetching estado pedidos alfruit test", e);
        }
    }
}
