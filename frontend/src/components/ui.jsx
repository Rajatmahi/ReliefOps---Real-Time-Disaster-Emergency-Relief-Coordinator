import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react'

export function PageHeading({ eyebrow, title, description, action }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div> }
export function Card({ children, className = '' }) { return <section className={`card ${className}`}>{children}</section> }
export function ErrorNotice({ error }) { return error ? <div className="notice error"><AlertCircle size={17}/>{error}</div> : null }
export function SuccessNotice({ children }) { return children ? <div className="notice success"><CheckCircle2 size={17}/>{children}</div> : null }
export function Loading() { return <div className="loading"><LoaderCircle className="spin" size={20}/> Loading data…</div> }
export function Empty({ children = 'No records found.' }) { return <div className="empty-state">{children}</div> }
export function StatusPill({ value }) { const key = String(value || '').toLowerCase(); return <span className={`pill pill-${key}`}>{key.replaceAll('_', ' ')}</span> }
export function SeverityPill({ value }) { const key = String(value || '').toLowerCase(); return <span className={`severity severity-${key}`}><i/>{key}</span> }
export function Field({ label, children, className = '' }) { return <label className={`field ${className}`}><span>{label}</span>{children}</label> }
export function Button({ children, variant = '', className = '', ...props }) { return <button className={`button ${variant} ${className}`.trim()} {...props}>{children}</button> }
