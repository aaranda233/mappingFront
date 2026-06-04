export default function direccionesManager() {
    return {
        direcciones: [],
        loading: false,
        busqueda: '',
        filtroCliente: '0',
        _debounceTimer: null,
        sortField: '',
        sortDirection: 'asc',

        // Edicion inline
        editandoId: null,
        opciones: [],
        cargandoOpciones: false,
        seleccion: '',

        clientes: [
            { id: '0', nombre: 'Todos' },
            { id: '2194', nombre: '2194 - Iberiana Francia' },
            { id: '2202', nombre: '2202 - Iberiana Alemania' },
            { id: '4319', nombre: '4319 - Iberiana CZ' },
            { id: '1172', nombre: '1172 - Eurogroup' }
        ],

        init() {
            this.cargarDirecciones();
        },

        async cargarDirecciones() {
            this.loading = true;
            try {
                const params = new URLSearchParams();
                if (this.filtroCliente !== '0') params.set('idcliente', this.filtroCliente);
                if (this.busqueda.trim().length >= 2) params.set('busqueda', this.busqueda.trim());

                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/direcciones?${params}`);
                this.direcciones = await res.json();
            } catch (err) {
                console.error("Error cargando direcciones:", err);
            } finally {
                this.loading = false;
            }
        },

        buscar() {
            clearTimeout(this._debounceTimer);
            this._debounceTimer = setTimeout(() => this.cargarDirecciones(), 400);
        },

        cambiarFiltro() {
            this.cargarDirecciones();
        },

        async abrirEdicion(item) {
            if (this.editandoId === item.Id) {
                this.editandoId = null;
                return;
            }

            this.editandoId = item.Id;
            this.seleccion = String(item.IdDireccion || '');
            this.opciones = [];
            this.cargandoOpciones = true;

            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/direcciones/opciones?idcliente=${item.IdCliente}`);
                this.opciones = await res.json();
            } catch (err) {
                console.error("Error cargando opciones:", err);
            } finally {
                this.cargandoOpciones = false;
            }
        },

        async guardarEdicion(item) {
            if (!this.seleccion || this.seleccion === '0') return;

            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/direcciones/${item.Id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idDireccion: parseInt(this.seleccion, 10) })
                });

                if (res.ok) {
                    item.IdDireccion = parseInt(this.seleccion, 10);
                    this.editandoId = null;
                    Toastify({
                        text: "Dirección actualizada correctamente",
                        duration: 3000,
                        gravity: "top",
                        position: "right",
                        backgroundColor: "#16a34a",
                        stopOnFocus: true
                    }).showToast();
                }
            } catch (err) {
                console.error("Error guardando:", err);
            }
        },

        sortBy(field) {
            if (this.sortField === field) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = field;
                this.sortDirection = 'asc';
            }
            const dir = this.sortDirection === 'asc' ? 1 : -1;
            this.direcciones.sort((a, b) => {
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

        formatFecha(fecha) {
            if (!fecha) return '';
            const s = fecha.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
            const d = new Date(s);
            if (isNaN(d)) return fecha;
            return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
    };
}
