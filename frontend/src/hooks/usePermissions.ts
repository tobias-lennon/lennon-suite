import { useAuth } from '../contexts/AuthContext'

export function usePermissions() {
  const { user } = useAuth()
  const role = user?.role ?? 'field'

  return {
    isAdmin:    role === 'admin',
    isField:    role === 'field',
    isCustomer: role === 'customer',

    canCreateJob:      role === 'admin',
    canEditJob:        role === 'admin',
    canDeleteJob:      role === 'admin',

    canLogWork:        role === 'admin' || role === 'field',

    canCreateInvoice:  role === 'admin',
    canManageInvoice:  role === 'admin',

    canCreateCustomer: role === 'admin',
    canEditCustomer:   role === 'admin',
    canEditRates:      role === 'admin',

    canManageLeads:    role === 'admin',

    canViewSettings:   role === 'admin' || role === 'field',
    canEditSettings:   role === 'admin',
  }
}
