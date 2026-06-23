import { type FormEvent, useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import styles from './AuthPage.module.scss'

type AuthMode = 'login' | 'signup'
type FieldName = 'confirmPassword' | 'email' | 'name' | 'password' | 'terms'

const passwordRules = [
  { id: 'length', label: 'Parola trebuie sa aiba minim 12 caractere.', test: (value: string) => value.length >= 12 },
  { id: 'uppercase', label: 'Parola trebuie sa contina cel putin o litera mare.', test: (value: string) => /[A-Z]/.test(value) },
  { id: 'number', label: 'Parola trebuie sa contina cel putin o cifra.', test: (value: string) => /\d/.test(value) },
  { id: 'special', label: 'Parola trebuie sa contina un caracter special: ! ? * @ $', test: (value: string) => /[!?*@$]/.test(value) },
]

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function unmetPasswordRules(value: string) {
  return passwordRules.filter((rule) => !rule.test(value))
}

export function AuthPage() {
  const { currentUser, googleLogin, login, logout, signup } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const nextPath = searchParams.get('next') ?? '/cart'
  const [mode, setMode] = useState<AuthMode>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [touchedFields, setTouchedFields] = useState<Partial<Record<FieldName, boolean>>>({})

  const missingPasswordRules = unmetPasswordRules(password)
  const isPasswordValid = password.length > 0 && missingPasswordRules.length === 0
  const isConfirmPasswordValid = mode === 'login' || (confirmPassword.length > 0 && confirmPassword === password)
  const isNameValid = mode === 'login' || name.trim().length >= 2
  const isEmailValidValue = isValidEmail(email)
  const isTermsValid = mode === 'login' || acceptedTerms
  const canSubmit = isNameValid && isEmailValidValue && isPasswordValid && isConfirmPasswordValid && isTermsValid

  function markTouched(field: FieldName) {
    setTouchedFields((current) => ({ ...current, [field]: true }))
  }

  function fieldState(field: FieldName, valid: boolean, hasValue: boolean) {
    const shouldShow = submitted || touchedFields[field] || hasValue
    if (!shouldShow) return ''
    return valid ? styles.validField : styles.invalidField
  }

  function showFieldError(field: FieldName, valid: boolean, hasValue: boolean) {
    return (submitted || touchedFields[field]) && (!hasValue || !valid)
  }

  function resetFormState(nextMode: AuthMode) {
    setMode(nextMode)
    setMessage('')
    setSubmitted(false)
    setTouchedFields({})
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)

    if (!canSubmit) {
      setTouchedFields({ confirmPassword: true, email: true, name: true, password: true, terms: true })
      setMessage('Completeaza corect toate campurile inainte de a continua.')
      return
    }

    const result = await (
      mode === 'signup' ? signup(name, email, password) : login(email, password)
    )

    setMessage(result.message)

    if (result.ok) {
      navigate(nextPath)
    }
  }

  if (currentUser) {
    return (
      <section className={styles.page}>
        <div className={styles.layout}>
          <div className={styles.sidePanel}>
            <h1>Cumpara alaturi de noi</h1>
            <p>Sesiunea ta securizata DimensionGear este activa.</p>
            <img
              alt=""
              aria-hidden="true"
              className={styles.controller}
              src="/design-reference/assets/pro-controller.svg"
            />
          </div>

          <div className={styles.card}>
            <p className={styles.kicker}>Cont</p>
            <h2>Autentificat ca {currentUser.name}</h2>
            <p className={styles.copy}>
              Deschide profilul pentru a gestiona detaliile contului, adresele
              salvate si istoricul configuratiilor 3D.
            </p>
            <div className={styles.accountMeta}>
              <span>{currentUser.email}</span>
              <span>Client DimensionGear</span>
            </div>
            <div className={styles.actions}>
              <Link to="/account">Deschide contul</Link>
              <button onClick={() => void logout()} type="button">
                Deconectare
              </button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.sidePanel}>
          <span className={styles.chevrons} aria-hidden="true">
            &lt;&lt;&lt;
          </span>
          <h1>Cumpara alaturi de noi</h1>
          <p>Acceseaza produsele si configuratiile tale DimensionGear</p>
          <img
            alt=""
            aria-hidden="true"
            className={styles.controller}
            src="/design-reference/assets/pro-controller.svg"
          />
        </div>

        <div className={styles.card}>
          <header className={styles.cardHeader}>
            <h2>{mode === 'signup' ? 'Creeaza un cont' : 'Bine ai revenit'}</h2>
            <button
              className={styles.modeLink}
              onClick={() => resetFormState(mode === 'signup' ? 'login' : 'signup')}
              type="button"
            >
              {mode === 'signup' ? 'autentifica-te' : 'creeaza cont'}
            </button>
          </header>

          <form className={styles.form} noValidate onSubmit={handleSubmit}>
            {mode === 'signup' ? (
              <label>
                <span>Nume utilizator</span>
                <input
                  autoComplete="name"
                  className={fieldState('name', isNameValid, name.trim().length > 0)}
                  onBlur={() => markTouched('name')}
                  onChange={(event) => setName(event.target.value)}
                  type="text"
                  value={name}
                />
                {showFieldError('name', isNameValid, name.trim().length > 0) ? (
                  <small className={styles.fieldHint}>Completeaza numele utilizatorului.</small>
                ) : null}
              </label>
            ) : null}

            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                className={fieldState('email', isEmailValidValue, email.trim().length > 0)}
                onBlur={() => markTouched('email')}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
              {showFieldError('email', isEmailValidValue, email.trim().length > 0) ? (
                <small className={styles.fieldHint}>Introdu o adresa de email valida.</small>
              ) : null}
            </label>

            <label>
              <span>Parola</span>
              <div className={styles.passwordInput}>
                <input
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className={fieldState('password', isPasswordValid, password.length > 0)}
                  onBlur={() => markTouched('password')}
                  onChange={(event) => setPassword(event.target.value)}
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={isPasswordVisible ? 'Ascunde parola' : 'Afiseaza parola'}
                  className={styles.visibilityToggle}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setIsPasswordVisible((current) => !current)}
                  type="button"
                >
                  <img
                    alt=""
                    src={isPasswordVisible ? '/design-reference/icons/visibility-off-icon.svg' : '/design-reference/icons/visibility-icon.svg'}
                  />
                </button>
              </div>
              {password.length > 0 && missingPasswordRules.length > 0 ? (
                <ul className={styles.passwordRules}>
                  {missingPasswordRules.map((rule) => (
                    <li key={rule.id}>{rule.label}</li>
                  ))}
                </ul>
              ) : null}
              {showFieldError('password', isPasswordValid, password.length > 0) && password.length === 0 ? (
                <small className={styles.fieldHint}>Completeaza parola.</small>
              ) : null}
            </label>

            {mode === 'signup' ? (
              <>
                <label>
                  <span>Confirma parola</span>
                  <div className={styles.passwordInput}>
                    <input
                      autoComplete="new-password"
                      className={fieldState('confirmPassword', isConfirmPasswordValid, confirmPassword.length > 0)}
                      onBlur={() => markTouched('confirmPassword')}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      type={isConfirmPasswordVisible ? 'text' : 'password'}
                      value={confirmPassword}
                    />
                    <button
                      aria-label={isConfirmPasswordVisible ? 'Ascunde parola' : 'Afiseaza parola'}
                      className={styles.visibilityToggle}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setIsConfirmPasswordVisible((current) => !current)}
                      type="button"
                    >
                      <img
                        alt=""
                        src={isConfirmPasswordVisible ? '/design-reference/icons/visibility-off-icon.svg' : '/design-reference/icons/visibility-icon.svg'}
                      />
                    </button>
                  </div>
                  {showFieldError('confirmPassword', isConfirmPasswordValid, confirmPassword.length > 0) ? (
                    <small className={styles.fieldHint}>Parolele trebuie sa fie identice.</small>
                  ) : null}
                </label>

                <label className={`${styles.terms} ${(submitted || touchedFields.terms) && !acceptedTerms ? styles.invalidTerms : ''}`}>
                  <input
                    checked={acceptedTerms}
                    onBlur={() => markTouched('terms')}
                    onChange={(event) => {
                      setAcceptedTerms(event.target.checked)
                      markTouched('terms')
                    }}
                    type="checkbox"
                  />
                  <span>
                    Prin crearea contului, sunt de acord cu{' '}
                    <a href="/auth">Termenii de utilizare</a> si{' '}
                    <a href="/auth">Politica de confidentialitate</a>
                  </span>
                </label>
              </>
            ) : null}

            <button className={`${styles.submitButton} ${canSubmit ? styles.submitReady : styles.submitDisabled}`} type="submit">
              {mode === 'signup' ? 'Creeaza contul' : 'Autentificare'}
            </button>
          </form>

          <div className={styles.divider}>
            <span />
            <em>SAU</em>
            <span />
          </div>

          {(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ? (
            <div className={styles.googleButtonShell}>
              <div aria-hidden="true" className={styles.googleButtonFace}>
                <img alt="" src="/design-reference/icons/google-icon.svg" />
                <span>Continua prin Google</span>
              </div>
              <GoogleLogin
                containerProps={{ className: styles.googleNativeButton }}
                logo_alignment="left"
                onError={() => setMessage('Autentificarea cu Google a esuat.')}
                onSuccess={(response) => {
                  if (!response.credential) return
                  void googleLogin(response.credential).then((result) => {
                    setMessage(result.message)
                    if (result.ok) navigate(nextPath)
                  })
                }}
                shape="pill"
                text="continue_with"
                type="standard"
                useOneTap={false}
                width="100%"
              />
            </div>
          ) : null}

          {message ? (
            <p className={styles.message} role="status">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
