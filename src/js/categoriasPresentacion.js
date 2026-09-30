// Categorias comerciales validas de una presentacion (GenerosCategorias), las mas usadas
// por el cliente primero. El buscador ya elige una sola; esto es para poder cambiarla.
// Si la categoria actual no esta en la lista (un mapeo viejo o del historico) se anade
// para que el <select> no la pierda al abrirse.
export async function cargarCategoriasPresentacion(idGensal, idCliente, actual) {
    const lista = [];
    try {
        const res = await fetch(
            `http://${window.env.IP_BACKEND}/api/mapping/presentaciones/${encodeURIComponent(idGensal)}/categorias?idcliente=${idCliente || 0}`
        );
        if (res.ok) lista.push(...await res.json());
    } catch (err) {
        console.error("Error cargando categorias:", err);
    }
    if (actual?.IdCategoria != null && actual.IdCategoria !== ''
        && !lista.some(c => String(c.IdCategoria) === String(actual.IdCategoria))) {
        lista.unshift({ IdCategoria: actual.IdCategoria, NombreCategoria: actual.NombreCategoria || '' });
    }
    return lista;
}
