import { Link } from 'react-router-dom'
import styles from './Footer.module.scss'

const footerGroups = [
  {
    title: 'Produse',
    links: ['Căști', 'Tastaturi', 'Scaune', 'Mouse'],
  },
  {
    title: 'Explorează',
    links: ['Personalizare', 'Blog'],
  },
  {
    title: 'Companie',
    links: ['Despre noi', 'Parteneri', 'Clienți', 'Contact'],
  },
  {
    title: 'Legal',
    links: ['Politica de confidențialitate', 'Termeni și condiții', 'Cookies'],
  },
]

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.about}>
          <Link className={styles.brand} to="/">
            DimensionGear
          </Link>
          <p>
            Echipamente de gaming gata de joc și personalizabile, create pentru
            confort, performanță și propriul tău stil.
          </p>
          <div className={styles.socials} aria-label="Linkuri sociale">
            <a href="/" aria-label="Facebook">
              <img src="/design-reference/icons/facebook.svg" alt="" />
            </a>
            <a href="/" aria-label="Vimeo">
              <img src="/design-reference/icons/vimeo.svg" alt="" />
            </a>
          </div>
        </div>

        {footerGroups.map((group) => (
          <section className={styles.group} key={group.title}>
            <h2>{group.title}</h2>
            <ul>
              {group.links.map((link) => (
                <li key={link}>
                  <Link to="/products">{link}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </footer>
  )
}
