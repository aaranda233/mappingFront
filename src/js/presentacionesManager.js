export default function presentacionesManager() {
    return {
        presentaciones: [],
        loading: false,
        busqueda: '',
        filtroCliente: '0',
        filtroGenero: '',
        _debounceTimer: null,
        sortField: '',
        sortDirection: 'asc',
        modoAaMapping: false,   // true cuando venimos del preview con id_mapping
        idAaMapping: null,

        // Edicion
        editando: null, // el item que se esta editando
        editBusqueda: '',
        editResultados: [],
        editBuscando: false,
        editMostrarResultados: false,
        editSeleccionada: null,
        editIdGensal: '',
        editIdCategoria: '',
        editIdGenero: '',
        editError: '',
        _editDebounce: null,

        clientes: [
            { id: '0', nombre: 'Todos' },
            { id: '2194', nombre: '2194 - Iberiana Francia' },
            { id: '2202', nombre: '2202 - Iberiana Alemania' },
            { id: '4319', nombre: '4319 - Iberiana CZ' }
        ],

        init() {
            const params = new URLSearchParams(window.location.search);
            if (params.get('id_mapping')) {
                this.modoAaMapping = true;
                this.idAaMapping = params.get('id_mapping');
                if (params.get('idcliente')) this.filtroCliente = params.get('idcliente');
                this.cargarAaMapping();
            } else {
                if (params.get('busqueda')) this.busqueda = params.get('busqueda');
                if (params.get('idcliente')) this.filtroCliente = params.get('idcliente');
                this.cargarPresentaciones();
            }
        },

        async cargarAaMapping() {
            this.loading = true;
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/aa-confecciones/${this.idAaMapping}`);
                if (!res.ok) throw new Error('No encontrado');
                const item = await res.json();
                this.presentaciones = [item];
                this.abrirEdicion(item);
            } catch (err) {
                console.error("Error cargando aa-mapping:", err);
                this.presentaciones = [];
            } finally {
                this.loading = false;
            }
        },

        async cargarPresentaciones() {
            this.loading = true;
            try {
                const params = new URLSearchParams();
                if (this.filtroCliente !== '0') params.set('idcliente', this.filtroCliente);
                if (this.busqueda.trim().length >= 2) params.set('busqueda', this.busqueda.trim());
                if (this.filtroGenero && parseInt(this.filtroGenero, 10) > 0) params.set('idgenero', this.filtroGenero);

                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/presentaciones?${params}`);
                this.presentaciones = await res.json();
            } catch (err) {
                console.error("Error cargando presentaciones:", err);
            } finally {
                this.loading = false;
            }
        },

        buscar() {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => this.cargarPresentaciones(), 400);
        },

        cambiarCliente() {
            this.cargarPresentaciones();
        },

        sortBy(field) {
            if (this.sortField === field) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = field;
                this.sortDirection = 'asc';
            }
            const dir = this.sortDirection === 'asc' ? 1 : -1;
            this.presentaciones.sort((a, b) => {
                const aVal = a[field] ?? '';
                const bVal = b[field] ?? '';
                const aBlank = aVal === '' || aVal === null || aVal === undefined;
                const bBlank = bVal === '' || bVal === null || bVal === undefined;
                if (aBlank && !bBlank) return 1;
                if (!aBlank && bBlank) return -1;
                if (aBlank && bBlank) return 0;
                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return (aVal - bVal) * dir;
                }
                return String(aVal).localeCompare(String(bVal), 'es') * dir;
            });
        },

        // ---- Edicion con card ----
        abrirEdicion(item) {
            this.editando = { ...item };
            this.editBusqueda = '';
            this.editResultados = [];
            this.editBuscando = false;
            this.editMostrarResultados = false;
            this.editSeleccionada = null;
            this.editIdGensal = String(item.IdPresentacion || '');
            this.editIdCategoria = String(item.Categoria || '');
            this.editIdGenero = '';
            this.editError = '';
        },

        cerrarEdicion() {
            this.editando = null;
            this.editError = '';
        },

        buscarEditPresentaciones() {
            clearTimeout(this._editDebounce);
            this.editSeleccionada = null;
            this.editIdGenero = '';
            this.editIdGensal = '';
            this.editIdCategoria = '';

            if (this.editBusqueda.length < 1) {
                this.editResultados = [];
                this.editMostrarResultados = false;
                return;
            }

            this.editBuscando = true;
            this.editMostrarResultados = true;

            this._editDebounce = setTimeout(async () => {
                try {
                    const res = await fetch(
                        `http://${window.env.IP_BACKEND}/api/mapping/presentaciones/buscar?busqueda=${encodeURIComponent(this.editBusqueda)}&idcliente=${this.editando.IdCliente || 0}&idlinea=${this.editando.Id || 0}`
                    );
                    this.editResultados = await res.json();
                } catch (err) {
                    console.error("Error buscando presentaciones:", err);
                    this.editResultados = [];
                } finally {
                    this.editBuscando = false;
                }
            }, 300);
        },

        seleccionarEditPresentacion(pres) {
            this.editIdGenero = String(pres.IdGenero);
            this.editIdGensal = String(pres.IdPresentacion);
            this.editIdCategoria = String(pres.IdCategoria);
            this.editSeleccionada = pres;
            this.editMostrarResultados = false;
            this.editBusqueda = pres.Presentacion;
        },

        limpiarEditPresentacion() {
            this.editBusqueda = '';
            this.editResultados = [];
            this.editMostrarResultados = false;
            this.editSeleccionada = null;
            this.editIdGenero = '';
            this.editIdGensal = '';
            this.editIdCategoria = '';
        },

        async guardarEdicion() {
            if (!this.editIdGensal || !this.editIdCategoria) {
                this.editError = 'Por favor completa Presentacion y Categoria antes de guardar.';
                return;
            }
            this.editError = '';

            try {
                const endpoint = this.modoAaMapping
                    ? `http://${window.env.IP_BACKEND}/api/mapping/aa-confecciones/${this.editando.Id}`
                    : `http://${window.env.IP_BACKEND}/api/mapping/presentaciones/${this.editando.Id}`;
                const res = await fetch(endpoint, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_gensal: this.editIdGensal,
                        id_categoria: this.editIdCategoria
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    this.editError = data.message || 'Error al actualizar';
                    return;
                }

                Toastify({
                    text: "Presentacion actualizada correctamente",
                    duration: 3000,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "#16a34a",
                    stopOnFocus: true
                }).showToast();

                this.cerrarEdicion();
                if (this.modoAaMapping) {
                    this.cargarAaMapping();
                } else {
                    this.cargarPresentaciones();
                }
            } catch (err) {
                console.error("Error guardando:", err);
                this.editError = 'No se pudo contactar con el servidor';
            }
        }
    };
}
