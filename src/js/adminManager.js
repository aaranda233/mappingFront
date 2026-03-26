export default function adminManager() {
    return {
        email: '',
        permisos: {
            pedidos: false,
            transportes: false,
            'estado-pedidos': false,
            admin: false
        },
        users: [],
        loading: false,
        toast: '',
        successMessage: '',
        errorMessage: '',
        editingUser: null,
        editPermisos: {},

        permisosConfig: [
            { key: 'pedidos', label: 'Pedidos', icon: 'box', color: '#003a4b' },
            { key: 'transportes', label: 'Transportes', icon: 'truck', color: '#f17533' },
            { key: 'estado-pedidos', label: 'Estado Pedidos', icon: 'signal', color: '#003a4b' },
            { key: 'admin', label: 'Admin', icon: 'shield', color: '#f17533' }
        ],

        async init() {
            await this.fetchRoles();
        },

        async fetchRoles() {
            this.loading = true;
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/user-roles`);
                const data = await res.json();
                this.users = data.users || [];
            } catch (e) {
                console.error("Error fetching user roles", e);
                this.users = [];
                this.errorMessage = 'No se pudieron cargar los usuarios desde el servidor.';
                setTimeout(() => this.errorMessage = '', 5000);
            }
            this.loading = false;
        },

        async addUser() {
            const emailTrimmed = this.email.trim().toLowerCase();
            if (!emailTrimmed) {
                this.errorMessage = 'Escribe un correo electrónico';
                setTimeout(() => this.errorMessage = '', 3000);
                return;
            }

            const selectedPermisos = Object.entries(this.permisos)
                .filter(([, v]) => v)
                .map(([k]) => k);

            if (selectedPermisos.length === 0) {
                this.errorMessage = 'Selecciona al menos un permiso';
                setTimeout(() => this.errorMessage = '', 3000);
                return;
            }

            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/user-roles`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailTrimmed, permisos: selectedPermisos })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Error al añadir usuario');
                }

                this.successMessage = `${emailTrimmed} añadido con ${selectedPermisos.length} permiso(s)`;
                setTimeout(() => this.successMessage = '', 3000);
                this.email = '';
                this.permisos = { pedidos: false, transportes: false, 'estado-pedidos': false, admin: false };
                await this.fetchRoles();
            } catch (e) {
                this.errorMessage = e.message;
                setTimeout(() => this.errorMessage = '', 3000);
            }
        },

        async removeUser(email) {
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/user-roles/${encodeURIComponent(email)}`, {
                    method: 'DELETE'
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Error al eliminar usuario');
                }

                this.successMessage = `${email} eliminado`;
                setTimeout(() => this.successMessage = '', 3000);
                this.editingUser = null;
                await this.fetchRoles();
            } catch (e) {
                this.errorMessage = e.message;
                setTimeout(() => this.errorMessage = '', 3000);
            }
        },

        startEdit(user) {
            this.editingUser = user.email;
            this.editPermisos = {
                pedidos: user.permisos.includes('pedidos'),
                transportes: user.permisos.includes('transportes'),
                'estado-pedidos': user.permisos.includes('estado-pedidos'),
                admin: user.permisos.includes('admin')
            };
        },

        cancelEdit() {
            this.editingUser = null;
            this.editPermisos = {};
        },

        async saveEdit(email) {
            const selectedPermisos = Object.entries(this.editPermisos)
                .filter(([, v]) => v)
                .map(([k]) => k);

            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/user-roles`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, permisos: selectedPermisos })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Error al actualizar permisos');
                }

                this.successMessage = `Permisos de ${email} actualizados`;
                setTimeout(() => this.successMessage = '', 3000);
                this.editingUser = null;
                await this.fetchRoles();
            } catch (e) {
                this.errorMessage = e.message;
                setTimeout(() => this.errorMessage = '', 3000);
            }
        },

        hasPermiso(user, key) {
            return user.permisos.includes(key);
        },

        selectAll() {
            this.permisos = { pedidos: true, transportes: true, 'estado-pedidos': true, admin: true };
        },

        selectNone() {
            this.permisos = { pedidos: false, transportes: false, 'estado-pedidos': false, admin: false };
        }
    };
}
