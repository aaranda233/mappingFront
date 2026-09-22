export default function transportesManager() {
    return {
        transportes: [],
        loading: false,
        primeraCarga: true,
        toast: null,
        pdfModalOpen: false,
        pdfBlobUrl: null,

        // Modal "pedido de NetAgro" (se abre desde la Ref. Pedido de la tarjeta)
        pedidoRefOpen: false,
        pedidoRefItem: null,
        pedidoRefPedidos: [],
        pedidoRefIndice: 0,

        init() {
            this.loadTransportes();
            setInterval(() => this.loadTransportes(), 10000);
        },

        async loadTransportes() {
            if (this.primeraCarga) this.loading = true;

            try {
                const url = `http://${window.env.IP_BACKEND}/api/mapping/transportes${this.$store.global._centroQuery()}`;
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
                            mostrarHistorico: false,
                            buscandoPedidoRef: false
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

        showToast(msg, backgroundColor = "#2563eb") {
            Toastify({
                text: msg,
                duration: 3000,
                gravity: "top",
                position: "right",
                backgroundColor,
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

        // Pedido de NetAgro cuya BESTELLNR/referencia CONTIENE la ref_pedido de la tarjeta.
        get pedidoRefActual() {
            return this.pedidoRefPedidos[this.pedidoRefIndice] || null;
        },

        etiquetaPedidoRef(pedido) {
            if (!pedido) return '';
            const partes = [this.formatFecha(pedido.PED_fechasalida)];
            if (pedido.PED_pedido) partes.push(`Pedido ${pedido.PED_pedido}`);
            const ref = pedido.PED_referencia || pedido.PED_BESTELLNR;
            if (ref) partes.push(String(ref).trim());
            return partes.join(' - ');
        },

        // El destino del pedido solo es aplicable si esta entre las opciones de la tarjeta.
        destinoDisponible(pedido) {
            const item = this.pedidoRefItem;
            if (!item || !pedido || !pedido.destino) return false;
            return (item.contenido || []).some(c => String(c.id) === String(pedido.destino.id));
        },

        async abrirPedidoRef(item) {
            const ref = (item.ref_pedido || '').toString().trim();
            if (!ref) {
                this.showToast("Este transporte no tiene referencia de pedido", "#dc2626");
                return;
            }
            if (item.buscandoPedidoRef) return;

            // El cliente de NetAgro se deriva del CLD_Id de cualquier opcion de la tarjeta.
            if (!item.contenido || item.contenido.length === 0) {
                this.showToast("Esta tarjeta no tiene direcciones con las que localizar el cliente", "#dc2626");
                return;
            }

            item.buscandoPedidoRef = true;
            try {
                const params = new URLSearchParams({
                    ref_pedido: ref,
                    contenido_id: item.contenido[0].id
                });
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/pedidos-por-referencia?${params.toString()}`);
                if (!res.ok) throw new Error('Respuesta no OK');
                const data = await res.json();
                const pedidos = data.pedidos || [];

                if (pedidos.length === 0) {
                    this.showToast(`Sin pedidos en NetAgro con la referencia ${ref}`, "#f59e0b");
                    return;
                }

                this.pedidoRefItem = item;
                this.pedidoRefPedidos = pedidos;
                this.pedidoRefIndice = 0;
                this.pedidoRefOpen = true;
            } catch (err) {
                console.error('Error buscando el pedido por referencia:', err);
                this.showToast("No se pudo consultar el pedido en NetAgro", "#dc2626");
            } finally {
                item.buscandoPedidoRef = false;
            }
        },

        cerrarPedidoRef() {
            this.pedidoRefOpen = false;
            this.pedidoRefItem = null;
            this.pedidoRefPedidos = [];
            this.pedidoRefIndice = 0;
        },

        // Del pedido solo se coge el destino (PED_iddestino = CLD_Id), que es lo que
        // se escribe en el selector de "Especificar Destino".
        aplicarDestinoPedido(pedido) {
            const item = this.pedidoRefItem;
            if (!item || !pedido || !pedido.destino) {
                this.showToast("Este pedido no tiene destino asignado", "#dc2626");
                return;
            }
            if (!this.destinoDisponible(pedido)) {
                this.showToast("Ese destino no esta entre las opciones de esta tarjeta", "#f59e0b");
                return;
            }

            item.seleccion = String(pedido.destino.id);
            item.especificando = false;
            this.cerrarPedidoRef();
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
