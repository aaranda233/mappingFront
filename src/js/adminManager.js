export default function adminManager() {
    return {
        email: '',
        role: 'admin',
        adminUsers: [],
        developerUsers: [],
        loading: false,
        toast: '',
        successMessage: '',
        errorMessage: '',

        async init() {
            await this.fetchRoles();
        },

        async fetchRoles() {
            this.loading = true;
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/user-roles`);
                const data = await res.json();
                this.adminUsers = data.adminUsers || [];
                this.developerUsers = data.developerUsers || [];
            } catch (e) {
                console.error("Error fetching user roles", e);
                // Fallback a env.js
                this.adminUsers = [...(window.env.ADMIN_USERS || [])];
                this.developerUsers = [...(window.env.DEVELOPER_USERS || [])];
                this.errorMessage = 'No se pudieron cargar los roles desde el servidor. Mostrando datos locales.';
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

            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/user-roles`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: emailTrimmed, role: this.role })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Error al añadir usuario');
                }

                this.successMessage = `${emailTrimmed} añadido como ${this.role === 'developer' ? 'Desarrollador' : 'Admin'}`;
                setTimeout(() => this.successMessage = '', 3000);
                this.email = '';
                await this.fetchRoles();
            } catch (e) {
                this.errorMessage = e.message;
                setTimeout(() => this.errorMessage = '', 3000);
            }
        },

        async removeUser(email, fromRole) {
            try {
                const res = await fetch(`http://${window.env.IP_BACKEND}/api/mapping/user-roles/${encodeURIComponent(email)}`, {
                    method: 'DELETE'
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || 'Error al eliminar usuario');
                }

                this.successMessage = `${email} eliminado de ${fromRole === 'developer' ? 'Desarrolladores' : 'Admins'}`;
                setTimeout(() => this.successMessage = '', 3000);
                await this.fetchRoles();
            } catch (e) {
                this.errorMessage = e.message;
                setTimeout(() => this.errorMessage = '', 3000);
            }
        }
    };
}
