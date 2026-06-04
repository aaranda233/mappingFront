export default function mappingManager() {
    return {
        mappings: [],
        loading: false,
        primeraCarga: true,
        toast: null,
        pdfModalOpen: false,
        pdfBlobUrl: null,

        get filteredMappings() {
            // El backend ya filtra por PED_idCentro cuando hay centro en la URL.
            // Devolvemos tal cual lo recibido.
            return this.mappings;
        },

        init() {
            this.loadMappings();
            setInterval(() => this.loadMappings(), 10000); // refresco continuo
            // Recargar al cambiar el filtro BIO/Convencional o Mostrar Todos sin vaciar la lista
            if (window.Alpine) {
                let primero = true;
                window.Alpine.effect(() => {
                    void window.Alpine.store('global').bioCentro;
                    if (primero) { primero = false; return; }
                    this.loadMappings();
                });
            }
        },

        async loadMappings() {
            if (this.primeraCarga) this.loading = true;

            try {
                const store = window.Alpine && window.Alpine.store('global');
                const centro = store ? store.bioCentro : null;
                const url = centro === null
                    ? `http://${window.env.IP_BACKEND}/api/mapping`
                    : `http://${window.env.IP_BACKEND}/api/mapping?centro=${centro}`;
                const res = await fetch(url);
                const data = await res.json();

                const nuevos = [];

                // Agrega nuevos si no están ya
                for (const nuevo of data) {
                    const yaExiste = this.mappings.some(m => m.id === nuevo.id);
                    if (!yaExiste) {
                        nuevos.push({
                            ...nuevo,
                            id_categoria: "",
                            id_gensal: "",
                            error: "",
                            especificando: false,
                            busquedaPresentacion: "",
                            resultadosPresentacion: [],
                            buscandoPresentacion: false,
                            mostrarResultados: false,
                            presentacionSeleccionada: null,
                            _debounceTimer: null,
                            historico: null,
                            buscandoHistorico: false,
                            mostrarHistorico: false
                        });
                    }
                }

                // Quita los que ya no están
                this.mappings = this.mappings.filter(m =>
                    data.some(n => n.id === m.id)
                );

                // Añade solo los nuevos
                this.mappings.push(...nuevos);
            } catch (err) {
                console.error("Error cargando mappings:", err);
            } finally {
                this.loading = false;
                this.primeraCarga = false;
            }
        },

        async enviar(item) {
            //comprueba que todos los campos sean correctos
            if (!item.id_categoria || !item.id_gensal || !item.id_genero) {
                item.error = "⚠️ Por favor completa todos los campos antes de enviar.";
                return;
            }
            //Limpiamos el item de errores cuando de envia
            item.error = "";

            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/consumir`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id_categoria: item.id_categoria,
                        ref_pedido: item.ref_pedido,
                        id_gensal: item.id_gensal,
                        id_genero: item.id_genero
                    })
                });

                let result = {};

                // Solo intenta leer el body si hay contenido
                if (res.status !== 204) {
                    try {
                        result = await res.json();
                    } catch (e) {
                        console.warn("Respuesta sin JSON, pero no es 204:", e);
                    }
                }

                //comprobación de que todos php ha podido generar el mapping
                if (res.ok) {
                    const resultValue = (result.result || result.Result || "").toString().toLowerCase();

                    if (resultValue !== "error") {
                        // Eliminar este mapping y todos los duplicados con misma descripcion
                        this.mappings = this.mappings.filter(m => m.descripcion !== item.descripcion);
                        const dupCount = result.duplicadosProcesados || 0;
                        const msg = dupCount > 0
                            ? `Enviado correctamente (+${dupCount} duplicados procesados)`
                            : "Enviado correctamente";
                        this.showToast(msg);
                    } else {
                        item.error = "❌ " + (result.message || result.Message || "Error desconocido desde el servidor externo.");
                    }
                } else {
                    item.error = "❌ " + (result.message || result.Message || "Respuesta no exitosa del servidor externo.");
                }

            } catch (err) {
                console.error("Error enviando:", err);
                item.error = "⚠️ No se pudo contactar con el servidor";
            }
        },

        showToast(msg) {
            Toastify({
                text: msg,
                duration: 3000,
                gravity: "top", // "top" or "bottom"
                position: "right", // "left", "center" or "right"
                backgroundColor: "#16a34a", // verde tailwind
                stopOnFocus: true
            }).showToast();
        },
        buscarPresentaciones(item) {
            clearTimeout(item._debounceTimer);
            item.presentacionSeleccionada = null;
            item.id_genero = "";
            item.id_gensal = "";
            item.id_categoria = "";

            if (item.busquedaPresentacion.length < 1) {
                item.resultadosPresentacion = [];
                item.mostrarResultados = false;
                return;
            }

            item.buscandoPresentacion = true;
            item.mostrarResultados = true;

            item._debounceTimer = setTimeout(async () => {
                try {
                    const res = await fetch(
                        `http://${window.env.IP_BACKEND}/api/mapping/presentaciones/buscar?busqueda=${encodeURIComponent(item.busquedaPresentacion)}&idcliente=${item.idcliente || 0}&idlinea=${item.id_linea || 0}`
                    );
                    const data = await res.json();
                    item.resultadosPresentacion = data;
                } catch (err) {
                    console.error("Error buscando presentaciones:", err);
                    item.resultadosPresentacion = [];
                } finally {
                    item.buscandoPresentacion = false;
                }
            }, 300);
        },

        seleccionarPresentacion(item, presentacion) {
            item.id_genero = String(presentacion.IdGenero);
            item.id_gensal = String(presentacion.IdPresentacion);
            item.id_categoria = String(presentacion.IdCategoria);
            item.presentacionSeleccionada = presentacion;
            item.mostrarResultados = false;
            item.busquedaPresentacion = presentacion.Presentacion;
            item.especificando = false;
        },

        limpiarPresentacion(item) {
            item.busquedaPresentacion = "";
            item.resultadosPresentacion = [];
            item.mostrarResultados = false;
            item.presentacionSeleccionada = null;
            item.id_genero = "";
            item.id_gensal = "";
            item.id_categoria = "";
        },

        async consultarHistorico(item) {
            // Toggle: si ya estaba abierto, cerrar
            if (item.mostrarHistorico) {
                item.mostrarHistorico = false;
                return;
            }
            item.mostrarHistorico = true;

            // Cache: si ya se consultó, no repetir
            if (item.historico) return;

            item.buscandoHistorico = true;
            try {
                const params = new URLSearchParams({
                    idcliente: item.idcliente || 0,
                    descripcion: item.descripcion || ''
                });
                if (item.ref_pedido) params.set('ref_pedido', item.ref_pedido);

                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/historico-referencia?${params.toString()}`);
                if (!res.ok) throw new Error('Respuesta no OK');
                item.historico = await res.json();
            } catch (err) {
                console.error('Error consultando histórico:', err);
                item.historico = { pedidoActual: null, candidatos: [], error: true };
            } finally {
                item.buscandoHistorico = false;
            }
        },

        aplicarHistorico(item, candidato) {
            // Salvaguarda: si alguno de los IDs es null/undefined, el candidato está roto
            if (!candidato || candidato.IdGenero == null || candidato.IdPresentacion == null || candidato.IdCategoria == null) {
                this.showToast("Este candidato no tiene datos válidos");
                return;
            }
            item.id_genero = String(candidato.IdGenero);
            item.id_gensal = String(candidato.IdPresentacion);
            item.id_categoria = String(candidato.IdCategoria);
            item.presentacionSeleccionada = {
                Presentacion: candidato.Presentacion,
                Genero: candidato.NomGenero,
                IdGenero: candidato.IdGenero,
                IdPresentacion: candidato.IdPresentacion,
                IdCategoria: candidato.IdCategoria,
                NombreCategoria: candidato.NombreCategoria
            };
            item.busquedaPresentacion = candidato.Presentacion || '';
            item.mostrarResultados = false;
            item.mostrarHistorico = false;
            item.especificando = false;
        },

        abrirPdf(item) {
            if (!item.pdf) return;
            const byteChars = atob(item.pdf);
            const byteArray = new Uint8Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {
                byteArray[i] = byteChars.charCodeAt(i);
            }
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            this.pdfBlobUrl = URL.createObjectURL(blob);
            this.pdfModalOpen = true;
        },

        cerrarPdf() {
            this.pdfModalOpen = false;
            if (this.pdfBlobUrl) {
                URL.revokeObjectURL(this.pdfBlobUrl);
                this.pdfBlobUrl = null;
            }
        },

        formatFecha(fecha) {
            if (!fecha) return '-';
            const s = fecha.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '');
            const d = new Date(s);
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        },

        async eliminar(item) {
            if (!confirm('¿Estás seguro de eliminar este mapping? Se eliminará de ambas bases de datos.')) {
                return;
            }

            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/${item.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.message || 'Error al eliminar');
                }

                // Eliminar del array local
                this.mappings = this.mappings.filter(m => m.id !== item.id);

                // Toast de éxito
                this.showToast("✅ Mapping eliminado correctamente de ambas bases de datos");

            } catch (error) {
                console.error('Error:', error);
                Toastify({
                    text: `❌ ${error.message}`,
                    duration: 4000,
                    gravity: "top",
                    position: "right",
                    backgroundColor: "#ef4444",
                    stopOnFocus: true
                }).showToast();
            }
        }
    };
}
