export default function transportesManager() {
    return {
        transportes: [],
        loading: false,
        primeraCarga: true,
        toast: null,
        pdfModalOpen: false,
        pdfBlobUrl: null,

        init() {
            this.loadTransportes();
            setInterval(() => this.loadTransportes(), 10000);
        },

        async loadTransportes() {
            if (this.primeraCarga) this.loading = true;

            try {
                const url = `http://${window.env.IP_BACKEND}/api/mapping/transportes`;
                const res = await fetch(url);
                const data = await res.json();

                const nuevos = [];

                for (const nuevo of data) {
                    const yaExiste = this.transportes.some(t => t._id === nuevo._id);
                    if (!yaExiste) {
                        nuevos.push({
                            ...nuevo,
                            seleccion: "",
                            filtroDireccion: "",
                            modoBusqueda: "nombre",
                            especificando: false,
                            historico: null,
                            buscandoHistorico: false,
                            mostrarHistorico: false
                        });
                    }
                }

                // Quita los que ya no estan
                this.transportes = this.transportes.filter(t =>
                    data.some(n => n._id === t._id)
                );

                // Anade solo los nuevos
                this.transportes.push(...nuevos);
            } catch (err) {
                console.error("Error cargando transportes:", err);
            } finally {
                this.loading = false;
                this.primeraCarga = false;
            }
        },
        async enviar(item) {
            if (!item.seleccion) {
                item.error = "Por favor selecciona una dirección antes de enviar.";
                return;
            }

            item.error = ""; // limpiamos errores anteriores

            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/transportes/consumir`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        _id: item._id,
                        id: item.id_mapping,
                        idDireccion: parseInt(item.seleccion)
                    })
                });

                const result = await res.json();

                if (res.ok) {
                    // Eliminar solo este transporte (por id)
                    this.transportes = this.transportes.filter(t => t._id !== item._id);
                    this.showToast("Transporte procesado correctamente");
                } else {
                    item.error = "Error: " + (result.message || "Respuesta inesperada");
                }

            } catch (err) {
                console.error("Error enviando transporte:", err);
                item.error = "No se pudo contactar con el servidor";
            }
        },

        contenidoFiltrado(item) {
            const filtro = item.filtroDireccion.trim();
            if (!filtro) return item.contenido;
            if (item.modoBusqueda === "numero") {
                return item.contenido.filter(c => String(c.numero).includes(filtro));
            }
            return item.contenido.filter(c => c.direccion.toLowerCase().includes(filtro.toLowerCase()));
        },

        // Nombre legible del destino seleccionado (para mostrarlo fuera del selector)
        nombreDestino(item) {
            if (!item.seleccion) return '';
            const c = item.contenido.find(c => String(c.id) === String(item.seleccion));
            return c ? `${c.direccion} - Nº ${c.numero}` : '';
        },

        async consultarHistorico(item) {
            // Toggle: si ya estaba abierto, cerrar
            if (item.mostrarHistorico) {
                item.mostrarHistorico = false;
                return;
            }
            item.mostrarHistorico = true;

            // Cache: si ya se consulto, no repetir
            if (item.historico) return;

            // Necesitamos al menos un contenido para derivar el cliente
            if (!item.contenido || item.contenido.length === 0) {
                item.historico = { candidatos: [], error: true };
                return;
            }

            item.buscandoHistorico = true;
            try {
                const params = new URLSearchParams({
                    direccion: item.direccion || '',
                    contenido_id: item.contenido[0].id
                });

                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/historico-transporte?${params.toString()}`);
                if (!res.ok) throw new Error('Respuesta no OK');
                item.historico = await res.json();
            } catch (err) {
                console.error('Error consultando historico transporte:', err);
                item.historico = { candidatos: [], error: true };
            } finally {
                item.buscandoHistorico = false;
            }
        },

        aplicarHistorico(item, candidato) {
            if (!candidato || !candidato.idDireccion) {
                this.showToast("Este candidato no tiene datos validos");
                return;
            }
            // Auto-seleccionar en el dropdown
            item.seleccion = String(candidato.idDireccion);
            item.especificando = false;
            item.mostrarHistorico = false;
        },

        showToast(msg) {
            Toastify({
                text: msg,
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor: "#2563eb",
                stopOnFocus: true
            }).showToast();
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

        async abrirPdf(item) {
            if (!item.tiene_pdf) return;
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/transportes/${item._id}/pdf`);
                if (!res.ok) {
                    console.error(`[abrirPdf] Error ${res.status} al obtener el PDF del transporte ${item._id}`);
                    return;
                }
                const data = await res.json();
                if (!data.pdf) return;
                const byteChars = atob(data.pdf);
                const byteArray = new Uint8Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) {
                    byteArray[i] = byteChars.charCodeAt(i);
                }
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                this.pdfBlobUrl = URL.createObjectURL(blob);
                this.pdfModalOpen = true;
            } catch (error) {
                console.error(`[abrirPdf] Error al cargar el PDF del transporte ${item._id}: ${error.message}`);
            }
        },

        cerrarPdf() {
            this.pdfModalOpen = false;
            if (this.pdfBlobUrl) {
                URL.revokeObjectURL(this.pdfBlobUrl);
                this.pdfBlobUrl = null;
            }
        },

    };
}
