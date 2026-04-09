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
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/transportes`);
                const data = await res.json();

                // Añade campo seleccion para cada item
                this.transportes = data.map(item => ({
                    ...item,
                    seleccion: ""
                }));
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
                    this.transportes = this.transportes.filter(t => t._id !== item._id);
                    this.showToast("✅ Transporte procesado correctamente");
                } else {
                    item.error = "❌ Error: " + (result.message || "Respuesta inesperada");
                }

            } catch (err) {
                console.error("Error enviando transporte:", err);
                item.error = "⚠️ No se pudo contactar con el servidor";
            }
        }
        ,

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

    };
}
