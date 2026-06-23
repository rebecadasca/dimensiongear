import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useCart } from '../../features/cart/CartContext'
import type { CartPaymentMode, CartTotals } from '../../features/cart/types'
import { apiRequest, jsonBody } from '../../shared/api/client'
import { formatCurrency } from '../../shared/utils/formatCurrency'
import styles from './CheckoutPage.module.scss'

type Address = { id: string; isDefault: boolean; label: string; fullName: string; street: string; city: string; country: string }
type IntentResponse = { clientSecret: string; orderId: string; totals: CartTotals }

const publishableKey = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ?? ''
const stripePromise = publishableKey ? loadStripe(publishableKey) : null

function StripePaymentForm({ orderId, totals }: { orderId: string; totals: CartTotals }) {
  const stripe = useStripe()
  const elements = useElements()
  const [message, setMessage] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  async function pay(event: FormEvent) {
    event.preventDefault()
    if (!stripe || !elements) return
    setIsProcessing(true)
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/checkout?orderId=${orderId}` },
    })
    if (result.error) {
      setMessage(result.error.message ?? 'Plata a eșuat.')
      setIsProcessing(false)
    }
  }

  return (
    <form className={styles.formPanel} onSubmit={(event) => void pay(event)}>
      <h2>Plată securizată cu cardul</h2>
      <PaymentElement />
      <button disabled={!stripe || isProcessing} type="submit">
        {isProcessing ? 'Se procesează...' : `Plătește ${formatCurrency(totals.payNow)}`}
      </button>
      {message ? <p role="alert">{message}</p> : null}
    </form>
  )
}

export function CheckoutPage() {
  const { currentUser } = useAuth()
  const { items, totals } = useCart()
  const [searchParams] = useSearchParams()
  const orderIdFromReturn = searchParams.get('orderId')
  const [addresses, setAddresses] = useState<Address[]>([])
  const [addressId, setAddressId] = useState('')
  const [paymentMode, setPaymentMode] = useState<CartPaymentMode>('full')
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false)
  const [intent, setIntent] = useState<IntentResponse | null>(null)
  const [orderStatus, setOrderStatus] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!currentUser) return
    void apiRequest<{ addresses: Address[] }>('/users/me/addresses').then((result) => {
      setAddresses(result.addresses)
      setAddressId(result.addresses.find((item) => item.isDefault)?.id ?? result.addresses[0]?.id ?? '')
    }).catch((error) => setMessage(error instanceof Error ? error.message : 'Adrese indisponibile'))
  }, [currentUser])

  useEffect(() => {
    if (!orderIdFromReturn || !currentUser) return
    void apiRequest<{ order: { status: string } }>(`/orders/${orderIdFromReturn}`)
      .then((result) => setOrderStatus(result.order.status))
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Comandă indisponibilă'))
  }, [currentUser, orderIdFromReturn])

  const elementsOptions = useMemo(() => intent ? ({ clientSecret: intent.clientSecret, appearance: { theme: 'night' as const } }) : undefined, [intent])
  const displayedTotals = intent?.totals ?? totals
  const availableLoyaltyDiscount = Math.floor((currentUser?.loyaltyPoints ?? 0) / 100) * 10

  async function createPayment() {
    try {
      setIntent(await apiRequest<IntentResponse>('/checkout/payment-intent', {
        method: 'POST',
        body: jsonBody({ addressId, paymentMode, useLoyaltyPoints }),
      }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nu s-a putut porni plata')
    }
  }

  if (!currentUser) return <section className={styles.page}><div className={styles.emptyState}><p>Plată blocată</p><h1>Autentifică-te pentru a finaliza comanda.</h1><Link to="/auth?next=/checkout">Autentificare sau înregistrare</Link></div></section>
  if (orderIdFromReturn) return <section className={styles.page}><div className={styles.confirmation}><p>Plată Stripe trimisă</p><h1>Status comandă: {orderStatus || 'se verifică...'}</h1><span>Webhook-ul confirmă oficial plata.</span><Link to="/products">Continuă cumpărăturile</Link></div></section>
  if (!items.length) return <section className={styles.page}><div className={styles.emptyState}><p>Plată</p><h1>Coșul tău este gol.</h1><Link to="/products">Vezi produse</Link></div></section>

  return (
    <section className={styles.page}>
      <header className={styles.header}><p>Plată securizată Stripe</p><h1>Finalizare comandă</h1></header>
      <div className={styles.checkoutShell}>
        <div className={styles.formStack}>
          <section className={styles.formPanel}>
            <h2>Adresă de livrare</h2>
            {addresses.length ? (
              <select value={addressId} onChange={(event) => setAddressId(event.target.value)}>
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label || 'Adresă'} - {address.street}, {address.city}
                  </option>
                ))}
              </select>
            ) : <p>Nu există adresă salvată. <Link to="/account">Adaugă una în cont.</Link></p>}
            <h2>Program plată</h2>
            <label><input checked={paymentMode === 'full'} onChange={() => setPaymentMode('full')} type="radio" /> Plată integrală</label>
            <label><input checked={paymentMode === 'advance'} onChange={() => setPaymentMode('advance')} type="radio" /> 30% avans + livrare acum</label>
            <h2>Puncte fidelitate</h2>
            <label><input checked={useLoyaltyPoints} disabled={availableLoyaltyDiscount <= 0 || Boolean(intent)} onChange={(event) => setUseLoyaltyPoints(event.target.checked)} type="checkbox" /> FoloseÈ™te punctele disponibile ({currentUser.loyaltyPoints ?? 0} puncte)</label>
            <p>{availableLoyaltyDiscount > 0 ? `PoÈ›i reduce comanda cu ${formatCurrency(String(availableLoyaltyDiscount))}.` : 'Ai nevoie de minimum 100 puncte pentru 10 RON reducere.'}</p>
          </section>
          {intent && stripePromise && elementsOptions ? (
            <Elements options={elementsOptions} stripe={stripePromise}>
              <StripePaymentForm orderId={intent.orderId} totals={intent.totals} />
            </Elements>
          ) : null}
          {message ? <p role="alert">{message}</p> : null}
        </div>
        <aside className={styles.summary}>
          <p>Sumar comandă</p>
          <div className={styles.summaryItems}>
            {items.map((item) => (
              <div className={styles.summaryItem} key={item.id}>
                <span>{item.quantity} x {item.productName}</span>
                <strong>{formatCurrency(item.subtotal)}</strong>
              </div>
            ))}
          </div>
          <dl>
            <div><dt>Subtotal</dt><dd>{formatCurrency(displayedTotals.subtotal)}</dd></div>
            <div><dt>Livrare</dt><dd>{formatCurrency(displayedTotals.shipping)}</dd></div>
            {Number(displayedTotals.discount) > 0 ? <div><dt>Puncte fidelitate</dt><dd>-{formatCurrency(displayedTotals.discount)}</dd></div> : null}
            <div><dt>Total</dt><dd>{formatCurrency(displayedTotals.total)}</dd></div>
          </dl>
          <button disabled={!addressId || Boolean(intent) || !publishableKey} onClick={() => void createPayment()} type="button">
            {publishableKey ? 'Continuă la plata cu cardul' : 'Stripe nu este configurat'}
          </button>
        </aside>
      </div>
    </section>
  )
}
