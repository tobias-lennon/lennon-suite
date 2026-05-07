import { lazy, Suspense } from 'react'
import './index.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import UpdatePrompt from './components/UpdatePrompt'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/AppLayout'
import Spinner from './components/Spinner'
import Login from './pages/Login'

const Dashboard    = lazy(() => import('./pages/Dashboard'))
const CustomerList = lazy(() => import('./pages/customers/CustomerList'))
const CustomerDetail = lazy(() => import('./pages/customers/CustomerDetail'))
const CustomerForm = lazy(() => import('./pages/customers/CustomerForm'))
const JobList      = lazy(() => import('./pages/jobs/JobList'))
const JobDetail    = lazy(() => import('./pages/jobs/JobDetail'))
const JobForm      = lazy(() => import('./pages/jobs/JobForm'))
const WorkLogForm  = lazy(() => import('./pages/jobs/WorkLogForm'))
const LeadList     = lazy(() => import('./pages/leads/LeadList'))
const LeadForm     = lazy(() => import('./pages/leads/LeadForm'))
const InvoiceList  = lazy(() => import('./pages/invoices/InvoiceList'))
const InvoiceDetail = lazy(() => import('./pages/invoices/InvoiceDetail'))
const Profile      = lazy(() => import('./pages/Profile'))
const Settings     = lazy(() => import('./pages/Settings'))
const Schedule     = lazy(() => import('./pages/Schedule'))
const Office       = lazy(() => import('./pages/Office'))
const ContactList  = lazy(() => import('./pages/contacts/ContactList'))
const ContactForm  = lazy(() => import('./pages/contacts/ContactForm'))

function PageFallback() {
  return (
    <div className="flex justify-center py-16">
      <Spinner className="w-6 h-6 text-brand-lime" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UpdatePrompt />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard"             element={<Dashboard />} />
              <Route path="/customers"             element={<CustomerList />} />
              <Route path="/customers/new"         element={<CustomerForm />} />
              <Route path="/customers/:id"         element={<CustomerDetail />} />
              <Route path="/customers/:id/edit"    element={<CustomerForm />} />
              <Route path="/jobs"                  element={<JobList />} />
              <Route path="/jobs/new"              element={<JobForm />} />
              <Route path="/jobs/:id"              element={<JobDetail />} />
              <Route path="/jobs/:id/edit"         element={<JobForm />} />
              <Route path="/jobs/:id/logs/new"     element={<WorkLogForm />} />
              <Route path="/jobs/:id/logs/:logId/edit" element={<WorkLogForm />} />
              <Route path="/leads"                 element={<LeadList />} />
              <Route path="/leads/new"             element={<LeadForm />} />
              <Route path="/leads/:id/edit"        element={<LeadForm />} />
              <Route path="/invoices"              element={<InvoiceList />} />
              <Route path="/invoices/:id"          element={<InvoiceDetail />} />
              <Route path="/schedule"              element={<Schedule />} />
              <Route path="/office"                element={<Office />} />
              <Route path="/contacts"              element={<ContactList />} />
              <Route path="/contacts/new"          element={<ContactForm />} />
              <Route path="/contacts/:id/edit"     element={<ContactForm />} />
              <Route path="/profile"               element={<Profile />} />
              <Route path="/settings"              element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
