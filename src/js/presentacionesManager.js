export default function presentacionesManager() {
    return {
        presentaciones: [],
        loading: false,
        busqueda: '',
        filtroCliente: '0',
        _debounceTimer: null,

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
        editFlipped: false,
        editError: '',
        _editDebounce: null,

        clientes: [
            { id: '0', nombre: 'Todos' },
            { id: '2194', nombre: '2194 - Iberiana Francia' },
            { id: '2202', nombre: '2202 - Iberiana Alemania' },
            { id: '4319', nombre: '4319 - Iberiana CZ' }
        ],

        init() {
            this.cargarPresentaciones();
        },

        async cargarPresentaciones() {
            this.loading = true;
            try {
                const params = new URLSearchParams();
                if (this.filtroCliente !== '0') params.set('idcliente', this.filtroCliente);
                if (this.busqueda.trim().length >= 2) params.set('busqueda', this.busqueda.trim());

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
            this.editFlipped = false;
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

            if (this.editBusqueda.length < 2) {
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

        toggleEditFlip() {
            this.editFlipped = !this.editFlipped;
        },

        async guardarEdicion() {
            if (!this.editIdGensal || !this.editIdCategoria) {
                this.editError = 'Por favor completa Presentacion y Categoria antes de guardar.';
                return;
            }
            this.editError = '';

            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/presentaciones/${this.editando.Id}`, {
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
                this.cargarPresentaciones();
            } catch (err) {
                console.error("Error guardando:", err);
                this.editError = 'No se pudo contactar con el servidor';
            }
        }
    };
}
