// Reprocesar el correo del pedido al rellenar su ultima card de mapping.
//
// Mientras falta un mapping el PHP no crea el pedido: crea las cards y deja el correo apartado.
// El backend devuelve `reprocesar` al consumir una card (confeccion o transporte) con cuantas
// cards quedan de ese mismo correo. Si no queda ninguna, se ofrece volver a pasar el correo
// por el flujo entero (POST /api/mapping/reprocesar -> outlook-* /reprocesar).
// Con cards pendientes no se pregunta: volveria a fallar y a crear cards.
// Un correo se reprocesa una sola vez con exito (lo controla el backend): repetirlo duplicaria el
// pedido en los clientes cuyo PHP no detecta el reenvio.
export async function ofrecerReprocesar(reprocesar, showToast) {
    if (!reprocesar || !reprocesar.internet_message_id) return;
    if (reprocesar.pendientes > 0) {
        showToast(`Quedan ${reprocesar.pendientes} mapping(s) de este correo antes de poder reprocesarlo`, "#f59e0b");
        return;
    }
    if (reprocesar.estado === 'ok') {
        showToast(`El pedido ${reprocesar.ref_pedido || ''} ya se reproceso`, "#f59e0b");
        return;
    }
    if (!reprocesar.disponible) return;          // servicio de correo no habilitado para reprocesar

    const ref = reprocesar.ref_pedido || '';
    if (!confirm(`Ya no quedan mappings pendientes del pedido ${ref}.\n\n¿Reprocesar el correo para crear el pedido?`)) return;

    showToast(`Reprocesando el pedido ${ref}...`, "#2563eb");
    let email = null;
    try { email = window.Alpine?.store('global')?.userEmail || null; } catch (e) { /* sin store */ }
    try {
        const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/reprocesar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ internet_message_id: reprocesar.internet_message_id, email })
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
