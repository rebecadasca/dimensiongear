import { type FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { apiRequest, jsonBody } from '../../shared/api/client'
import { formatCurrency } from '../../shared/utils/formatCurrency'
import styles from './AccountPage.module.scss'

type Address = {
  city: string; country: string; county: string; fullName: string; id: string
  isDefault: boolean; label: string; phone: string; postalCode: string; street: string
}

type SavedConfiguration = {
  createdAt: string; id: string; price: string; status: string
  product: { id: string; imageSrc?: string; name: string }
  selections: Array<{ component: string; option: string; value: string }>
}

const emptyAddress = {
  city: '', country: 'România', county: '', fullName: '', isDefault: false,
  label: '', phone: '', postalCode: '', street: '',
}

const fieldLabels = {
  city: 'Oraș',
  country: 'Țară',
  county: 'Județ',
  fullName: 'Nume complet',
  label: 'Etichetă',
  phone: 'Telefon',
  postalCode: 'Cod poștal',
  street: 'Stradă',
}

export function AccountPage() {
  const { currentUser, isLoading: isAuthLoading, logout, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [configurations, setConfigurations] = useState<SavedConfiguration[]>([])
  const [profile, setProfile] = useState({ name: currentUser?.name ?? '', phone: currentUser?.phone ?? '' })
  const [address, setAddress] = useState(emptyAddress)
  const [message, setMessage] = useState('')
  const [configurationPendingDelete, setConfigurationPendingDelete] = useState<SavedConfiguration | null>(null)

  useEffect(() => {
    if (!currentUser) return
    // Keep the form synchronized after session hydration or profile updates.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile({ name: currentUser.name, phone: currentUser.phone })
    void Promise.all([
      apiRequest<{ addresses: Address[] }>('/users/me/addresses'),
      apiRequest<{ configurations: SavedConfiguration[] }>('/users/me/configurations'),
    ]).then(([addressResult, configurationResult]) => {
      setAddresses(addressResult.addresses)
      setConfigurations(configurationResult.configurations)
    }).catch((error) => setMessage(error instanceof Error ? error.message : 'Datele profilului sunt indisponibile'))
  }, [currentUser])

  if (isAuthLoading) return <section className={styles.page}>Se încarcă pagina contului...</section>
  if (!currentUser) return <Navigate replace to="/auth?next=/account" />

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    const result = await updateProfile(profile)
    setMessage(result.message)
  }

  async function addAddress(event: FormEvent) {
    event.preventDefault()
    const result = await apiRequest<{ address: Address }>('/users/me/addresses', { method: 'POST', body: jsonBody(address) })
    setAddresses((current) => address.isDefault ? [...current.map((item) => ({ ...item, isDefault: false })), result.address] : [...current, result.address])
    setAddress(emptyAddress)
    setMessage('Adresă salvată.')
  }

  async function makeDefault(id: string) {
    await apiRequest(`/users/me/addresses/${id}`, { method: 'PATCH', body: jsonBody({ isDefault: true }) })
    setAddresses((current) => current.map((item) => ({ ...item, isDefault: item.id === id })))
  }

  async function removeAddress(id: string) {
    await apiRequest(`/users/me/addresses/${id}`, { method: 'DELETE' })
    setAddresses((current) => current.filter((item) => item.id !== id))
  }

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  async function confirmDeleteConfiguration() {
    if (!configurationPendingDelete) return
    await apiRequest(`/users/me/configurations/${configurationPendingDelete.id}`, { method: 'DELETE' })
    setConfigurations((current) => current.filter((item) => item.id !== configurationPendingDelete.id))
    setConfigurationPendingDelete(null)
    setMessage('Configuratie stearsa.')
  }

  const loyaltyDiscount = Math.floor((currentUser.loyaltyPoints ?? 0) / 100) * 10

  return (
    <section className={styles.page}>
      <header><p>Cont</p><h1>Bună, {currentUser.name}</h1></header>
      {message ? <p className={styles.message} role="status">{message}</p> : null}
      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>Detalii cont</h2>
          <form className={styles.form} onSubmit={(event) => void saveProfile(event)}>
            <label>Nume<input value={profile.name} onChange={(event) => setProfile((value) => ({ ...value, name: event.target.value }))} required /></label>
            <label>Email<input value={currentUser.email} readOnly /></label>
            <label>Telefon<input value={profile.phone} onChange={(event) => setProfile((value) => ({ ...value, phone: event.target.value }))} /></label>
            <button type="submit">Salvează detaliile</button>
          </form>
          <div className={styles.accountActions}>
            <div className={styles.loyaltyBox}>
              <span>Puncte fidelitate</span>
              <strong>{currentUser.loyaltyPoints ?? 0}</strong>
              <small>{loyaltyDiscount > 0 ? `${loyaltyDiscount} RON disponibili pentru urmatoarea comanda` : '100 puncte = 10 RON reducere'}</small>
            </div>
            <button className={styles.logoutButton} onClick={() => void handleLogout()} type="button">Log out</button>
          </div>
        </section>

        <section className={styles.panel}>
          <h2>Adrese de livrare</h2>
          <div className={styles.addresses}>
            {addresses.map((item) => (
              <article key={item.id}>
                <strong>{item.label || 'Adresă'} {item.isDefault ? '- implicită' : ''}</strong>
                <span>{item.fullName}, {item.street}, {item.city}, {item.county}, {item.postalCode}</span>
                <div>{!item.isDefault ? <button onClick={() => void makeDefault(item.id)} type="button">Setează implicită</button> : null}<button className={styles.deleteButton} onClick={() => void removeAddress(item.id)} type="button">Șterge</button></div>
              </article>
            ))}
          </div>
          <form className={styles.form} onSubmit={(event) => void addAddress(event)}>
            {(['label', 'fullName', 'phone', 'country', 'county', 'city', 'street', 'postalCode'] as const).map((field) => (
              <label key={field}>{fieldLabels[field]}<input value={address[field]} onChange={(event) => setAddress((value) => ({ ...value, [field]: event.target.value }))} required={!['label', 'phone'].includes(field)} /></label>
            ))}
            <label className={styles.checkbox}><input checked={address.isDefault} onChange={(event) => setAddress((value) => ({ ...value, isDefault: event.target.checked }))} type="checkbox" />Adresă implicită</label>
            <button type="submit">Adaugă adresa</button>
          </form>
        </section>
      </div>

      <section className={`${styles.panel} ${styles.history}`}>
        <h2>Istoric configurații 3D</h2>
        {configurations.length ? configurations.map((item) => (
          <article key={item.id}>
            {item.product.imageSrc ? <img alt="" src={item.product.imageSrc} /> : null}
            <div><strong>{item.product.name}</strong><span>{formatCurrency(item.price)} - {new Date(item.createdAt).toLocaleDateString('ro-RO')}</span><small>{item.selections.map((selection) => `${selection.component}: ${selection.value}`).join(' - ')}</small></div>
            <div className={styles.historyActions}>
              <Link to={`/products/${item.product.id}/customize?configurationId=${item.id}`}>Deschide din nou</Link>
              <button className={styles.deleteButton} onClick={() => setConfigurationPendingDelete(item)} type="button">Sterge</button>
            </div>
          </article>
        )) : <p>Nu ai configurații salvate încă.</p>}
      </section>
      {configurationPendingDelete ? (
        <div className={styles.dialogBackdrop}>
          <section aria-modal="true" className={styles.confirmDialog} role="dialog">
            <p>esti sigur ca vrei sa stergi configuratia?</p>
            <div>
              <button className={styles.deleteButton} onClick={() => void confirmDeleteConfiguration()} type="button">Sterge</button>
              <button onClick={() => setConfigurationPendingDelete(null)} type="button">Anuleaza</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
