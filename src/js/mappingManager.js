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
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping`);
                const data = await res.json();

                const nuevos = [];

                // Agrega nuevos si no están ya
                for (const nuevo of data) {
                    const yaExiste = this.mappings.some(m => m.id === nuevo.id);
                    if (!yaExiste) {
                        nuevos.push({ ...nuevo, id_categoria: "", id_gensal: "", error: "" });
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
                    // Analizamos la respuesta del PHP
                    if (result.result && result.result.toLowerCase() === "ok") {
                        this.mappings = this.mappings.filter(m => m.id !== item.id);
                        this.showToast("✅ Enviado correctamente");
                    } else {
                        item.error = "❌ " + (result.message || "Error desconocido desde el servidor externo.");
                    }
                } else {
                    item.error = "❌ " + (result.message || "Respuesta no exitosa del servidor externo.");
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
        enviarAI(item, event) {
            const ball = document.getElementById('aiBall');
            const chatBtn = document.getElementById('chat-toggle-button');

            if (!ball || !chatBtn || !event) return;

            const start = event.target.getBoundingClientRect();
            const end = chatBtn.getBoundingClientRect();

            // Pelota animada hacia el chat
            ball.style.top = `${start.top + window.scrollY}px`;
            ball.style.left = `${start.left + window.scrollX}px`;
            ball.style.opacity = '1';
            ball.style.transform = 'translate(0, 0)';
            void ball.offsetWidth;

            const deltaX = end.left - start.left;
            const deltaY = end.top - start.top;

            ball.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.5)`;

            setTimeout(() => {
                ball.style.opacity = '0';
                ball.style.transform = 'none';
                chatBtn.click();
            }, 750);

            // Espera a que se abra el chat y lanza la solicitud a la IA
            setTimeout(() => {
                if (window.chat) {
                    const prompt = `Hola, dame el pedido con la referencia ${item.ref_pedido}`;

                    // Simula que el usuario hizo la pregunta
                    window.chat.messages.push({
                        id: Date.now(),
                        role: 'user',
                        content: prompt
                    });

                    window.chat.proposedMessage = '';
                    window.chat.loading = true;
                    window.chat.useProposedMessage = true;

                    sendToLLMStreamed(prompt, window.chat.sessionId, chunk => {
                        window.chat.proposedMessage += chunk;
                    }).then(() => {
                        window.chat.loading = false;
                        window.chat.scrollToBottom();
                    }).catch(() => {
                        window.chat.loading = false;
                        window.chat.proposedMessage = '❌ Error al obtener respuesta.';
                    });
                }
            }, 800);
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
