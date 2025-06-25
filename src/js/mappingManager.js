export default function mappingManager() {
    return {
        mappings: [],
        loading: false,
        primeraCarga: true,
        toast: null,

        init() {
            this.loadMappings();
            setInterval(() => this.loadMappings(), 10000); // refresco continuo
        },

        async loadMappings() {
            if (this.primeraCarga) this.loading = true;

            try {
                const res = await fetch("http://192.168.2.202:5008/api/mapping");
                const data = await res.json();

                const nuevos = [];

                // Agrega nuevos si no están ya
                for (const nuevo of data) {
                    const yaExiste = this.mappings.some(m => m._id === nuevo._id);
                    if (!yaExiste) {
                        nuevos.push({ ...nuevo, id_categoria: "", id_gensal: "" });
                    }
                }

                // Quita los que ya no están
                this.mappings = this.mappings.filter(m =>
                    data.some(n => n._id === m._id)
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
            if (!item.id_categoria) {
                alert("Por favor, introduce un ID de categoría.");
                return;
            }

            try {
                const res = await fetch("http://192.168.2.202:5008/api/mapping/consumir", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id_categoria: item.id_categoria,
                        ref_pedido: item.ref_pedido,
                        id_gensal: item.id_gensal
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

                if (res.ok || result.message === "Mapping no encontrado") {
                    this.mappings = this.mappings.filter(m => m._id !== item._id);
                    this.showToast("✅ Enviado correctamente");
                } else {
                    alert("❌ Error al enviar: " + (result.message || "Respuesta inesperada del servidor"));
                }
            } catch (err) {
                console.error("Error enviando:", err);
                this.showToast("⚠️ No se pudo contactar con el servidor");
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
        }

    };
}
