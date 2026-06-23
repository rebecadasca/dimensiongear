import { Link } from 'react-router-dom'
import styles from './NotFoundPage.module.scss'

export function NotFoundPage() {
  return (
    <section className={styles.page}>
      <h1>Pagina nu a fost găsită</h1>
      <Link to="/">Înapoi acasă</Link>
    </section>
  )
}
