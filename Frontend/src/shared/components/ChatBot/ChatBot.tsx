import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import styles from './ChatBot.module.scss'

type Topic = 'buy' | 'customize' | 'order'
type ProductChoice = 'chair' | 'mouse' | 'headset' | 'keyboard' | 'unsure'
type ShoppingNeed = 'creative' | 'budget' | 'gift' | 'competitive'

type Message = {
  id: number
  role: 'bot' | 'user'
  text: string
}

type Option = {
  label: string
  onSelect: () => void
}

type Recommendation = {
  description: string
  name: string
  path: string
}

const initialMessage =
  'Salut! Sunt GearBot. Alege o categorie și te ghidez.'

const productLabels: Record<ProductChoice, string> = {
  chair: 'Scaun de gaming',
  headset: 'Căști',
  keyboard: 'Tastatură',
  mouse: 'Mouse',
  unsure: 'Nu sunt sigur încă',
}

const needLabels: Record<ShoppingNeed, string> = {
  budget: 'Cea mai bună opțiune pentru bugetul meu',
  competitive: 'Gaming competitiv',
  creative: 'Editare sau lucru creativ',
  gift: 'Cadou pentru cineva',
}

const productsByChoice: Record<Exclude<ProductChoice, 'unsure'>, Recommendation> = {
  chair: {
    description: 'O alegere orientată spre confort pentru sesiuni lungi, cu suport complet de personalizare.',
    name: 'Vortex X7 Racing 3D Custom Gaming Chair',
    path: '/products/vortex-x7-racing-3d-custom',
  },
  headset: {
    description: 'O alegere audio flexibilă pentru gaming, apeluri și un setup reușit.',
    name: 'Corsair Virtuoso SE Wireless Gaming Headset',
    path: '/products/corsair-virtuoso-se-wireless',
  },
  keyboard: {
    description: 'Potrivită pentru input precis, scurtături de editare și layouturi personalizate.',
    name: 'Tastatură wireless Vertex K68 Pastel 3D Custom',
    path: '/products/vertex-k68-pastel-3d-custom',
  },
  mouse: {
    description: 'Cel mai accesibil mod de a îmbunătăți viteza și precizia fără costuri mari.',
    name: 'Razer Viper V3 HyperSpeed Wireless Gaming Mouse',
    path: '/products/razer-viper-v3-hyperspeed-wireless',
  },
}

const productsByNeed: Record<ShoppingNeed, Recommendation> = {
  budget: productsByChoice.mouse,
  competitive: productsByChoice.mouse,
  creative: productsByChoice.keyboard,
  gift: productsByChoice.headset,
}

let nextMessageId = 1

export function ChatBot() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { id: nextMessageId++, role: 'bot', text: initialMessage },
  ])
  const [options, setOptions] = useState<Option[] | null>(null)
  const [action, setAction] = useState<{ label: string; path: string } | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductChoice>('unsure')
  const logRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    logRef.current?.scrollTo({
      behavior: 'smooth',
      top: logRef.current.scrollHeight,
    })
  }, [messages])

  function append(role: Message['role'], text: string) {
    setMessages((current) => [
      ...current,
      { id: nextMessageId++, role, text },
    ])
  }

  function reply(userText: string, botText: string) {
    append('user', userText)
    window.setTimeout(() => append('bot', botText), 160)
  }

  function createRootOptions(): Option[] {
    return [
      {
        label: 'Vreau să cumpăr echipamente',
        onSelect: () => selectTopic('buy'),
      },
      {
        label: 'Vreau să personalizez un produs',
        onSelect: () => selectTopic('customize'),
      },
      {
        label: 'Am nevoie de ajutor cu o comandă',
        onSelect: () => selectTopic('order'),
      },
    ]
  }

  function selectTopic(topic: Topic) {
    setAction(null)

    if (topic === 'buy') {
      reply('Vreau să cumpăr echipamente', 'Ce tip de produs cauți?')
      setOptions(
        (Object.keys(productLabels) as ProductChoice[]).map((choice) => ({
          label: productLabels[choice],
          onSelect: () => selectProduct(choice),
        })),
      )
      return
    }

    if (topic === 'customize') {
      reply(
        'Vreau să personalizez un produs',
        'Cu ce te pot ajuta în configurator?',
      )
      setOptions([
        {
          label: 'Cum încep?',
          onSelect: () =>
            showAnswer(
              'Cum încep?',
              'Deschide un produs care acceptă personalizare, apoi alege „Costumizează”. Poți schimba materialele, culorile și opțiunile disponibile înainte să îl adaugi în coș.',
              'Deschide produsele personalizabile',
              '/customise',
            ),
        },
        {
          label: 'Cum navighez previzualizarea 3D?',
          onSelect: () =>
            showAnswer(
              'Cum navighez previzualizarea 3D?',
              'Trage pentru a roti produsul. Folosește panourile de opțiuni pentru a actualiza configurația în timp real.',
              'Încearcă personalizarea scaunului',
              '/products/vortex-x7-racing-3d-custom/customize',
            ),
        },
        {
          label: 'Cum funcționează prețul și plata?',
          onSelect: () =>
            showAnswer(
              'Cum funcționează prețul și plata?',
              'Prețul afișat se actualizează în funcție de opțiunile selectate. Când configurația este gata, adaug-o în coș și continuă spre plată.',
              'Vezi coșul',
              '/cart',
            ),
        },
      ])
      return
    }

    reply(
      'Am nevoie de ajutor cu o comandă',
      'Cu ce parte a comenzii ai nevoie de ajutor?',
    )
    setOptions([
      {
        label: 'Pot anula comanda?',
        onSelect: () =>
          showAnswer(
            'Pot anula comanda?',
            'Anularea depinde de statusul comenzii. Acest prototip nu poate anula comenzi încă, dar fluxul de suport poate fi conectat ulterior.',
            'Vezi coșul',
            '/cart',
          ),
      },
      {
        label: 'Pot cere rambursare?',
        onSelect: () =>
          showAnswer(
            'Pot cere rambursare?',
            'Eligibilitatea rambursării depinde de politica finală a magazinului și de starea produsului.',
            'Verifică coșul',
            '/cart',
          ),
      },
      {
        label: 'Unde este comanda mea?',
        onSelect: () =>
          showAnswer(
            'Unde este comanda mea?',
            'Urmărirea comenzilor nu este conectată încă. După extinderea contului, statusul va apărea în zona de profil.',
            'Continuă cumpărăturile',
            '/products',
          ),
      },
      {
        label: 'Ajutor pentru plată',
        onSelect: () =>
          showAnswer(
            'Ajutor pentru plată',
            'Verifică produsele din coș, apoi continuă spre pagina de plată.',
            'Deschide plata',
            '/checkout',
          ),
      },
    ])
  }

  function selectProduct(choice: ProductChoice) {
    setSelectedProduct(choice)
    reply(productLabels[choice], 'Ce contează cel mai mult pentru această achiziție?')
    setOptions(
      (Object.keys(needLabels) as ShoppingNeed[]).map((need) => ({
        label: needLabels[need],
        onSelect: () => showRecommendation(choice, need),
      })),
    )
  }

  function showRecommendation(product: ProductChoice, need: ShoppingNeed) {
    const recommendation =
      product === 'unsure' ? productsByNeed[need] : productsByChoice[product]

    reply(
      needLabels[need],
      `Îți recomand ${recommendation.name}. ${recommendation.description}`,
    )
    setAction({ label: `Vezi ${recommendation.name}`, path: recommendation.path })
    setOptions([
      {
        label: 'Alege alt produs',
        onSelect: () => selectTopic('buy'),
      },
      {
        label: 'Reîncepe',
        onSelect: resetConversation,
      },
    ])
  }

  function showAnswer(
    userText: string,
    botText: string,
    actionLabel: string,
    actionPath: string,
  ) {
    reply(userText, botText)
    setAction({ label: actionLabel, path: actionPath })
    setOptions([
      {
        label: 'Înapoi la categorii',
        onSelect: resetConversation,
      },
    ])
  }

  function resetConversation() {
    setMessages([
      { id: nextMessageId++, role: 'bot', text: initialMessage },
    ])
    setAction(null)
    setSelectedProduct('unsure')
    setOptions(null)
  }

  return (
    <aside className={styles.chatBot}>
      {isOpen ? (
        <section
          aria-label="Asistent GearBot"
          aria-live="polite"
          className={styles.panel}
        >
          <header className={styles.header}>
            <div>
              <span className={styles.status} />
              <strong>GearBot</strong>
              <small>Suport ghidat</small>
            </div>
            <div className={styles.headerActions}>
              <button onClick={resetConversation} type="button">
                Restart
              </button>
              <button
                aria-label="Închide GearBot"
                className={styles.closeButton}
                onClick={() => setIsOpen(false)}
                type="button"
              >
                X
              </button>
            </div>
          </header>

          <div className={styles.messages} ref={logRef}>
            {messages.map((message) => (
              <div
                className={`${styles.message} ${styles[message.role]}`}
                key={message.id}
              >
                {message.role === 'bot' ? (
                  <span className={styles.botAvatar} aria-hidden="true">
                    <i />
                  </span>
                ) : null}
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          <div className={styles.options}>
            {(options ?? createRootOptions()).map((option) => (
              <button
                key={option.label}
                onClick={option.onSelect}
                type="button"
              >
                {option.label}
              </button>
            ))}
            {action ? (
              <Link
                className={styles.action}
                onClick={() => setIsOpen(false)}
                to={action.path}
              >
                {action.label}
              </Link>
            ) : null}
          </div>

          <span className={styles.context} aria-hidden="true">
            {selectedProduct !== 'unsure' ? productLabels[selectedProduct] : ''}
          </span>
        </section>
      ) : null}

      <button
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Închide GearBot' : 'Deschide GearBot'}
        className={styles.trigger}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span aria-hidden="true" />
      </button>
    </aside>
  )
}
