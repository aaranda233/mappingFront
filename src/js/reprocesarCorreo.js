// Reprocesar el correo del pedido al rellenar su ultima card de mapping.
//
// Mientras falta un mapping el PHP no crea el pedido: crea las cards y deja el correo apartado.
// El backend devuelve `reprocesar` al consumir una card (confeccion o transporte) con cuantas
// cards quedan de ese mismo correo. Si no queda ninguna, se ofrece volver a pasar el correo
// por el flujo entero (POST /api/mapping/reprocesar -> outlook-<cliente> /reprocesar).
// Con cards pendientes no se pregunta: volveria a fallar y a crear cards.
export async function ofrecerReprocesar(reprocesar, showToast) {
    if (!reprocesar || !reprocesar.internet_message_id) return;
    if (!reprocesar.disponible) return;          // cliente sin servicio de correo configurado
    if (reprocesar.pendientes > 0) {
        showToast(`Quedan ${reprocesar.pendientes} mapping(s) de este correo antes de poder reprocesarlo`, "#f59e0b");
        return;
    }

    const ref = reprocesar.ref_pedido || '';
    if (!confirm(`Ya no quedan mappings pendientes del pedido ${ref}.\n\n¿Reprocesar el correo para crear el pedido?`)) return;

    showToast(`Reprocesando el pedido ${ref}...`, "#2563eb");
    try {
        const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/reprocesar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                internet_message_id: reprocesar.internet_message_id,
                idcliente: reprocesar.idcliente
            })
        });
        let data = {};
        try { data = await res.json(); } catch (e) { /* cuerpo vacio o no JSON */ }

        if (res.ok && data.ok) {
            const n = (data.pedidos || []).length;
            showToast(`Pedido ${ref} reprocesado (${n} pedido${n === 1 ? '' : 's'} enviado${n === 1 ? '' : 's'} al ERP)`);
        } else {
            showToast(`No se pudo reprocesar ${ref}: ${data.message || res.status}`, "#dc2626");
        }
    } catch (err) {
        console.error('Error reprocesando el correo:', err);
        showToast(`No se pudo reprocesar ${ref}: sin respuesta del servidor`, "#dc2626");
    }
}
