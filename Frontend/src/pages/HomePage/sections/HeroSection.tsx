import { Link } from 'react-router-dom'
import { LazyModelViewer } from '../../../shared/components/LazyModelViewer/LazyModelViewer'
import styles from './HeroSection.module.scss'

export function HeroSection() {
  return (
    <section className={styles.hero} aria-label="Hero pagina principală DimensionGear">
      <div className={styles.copy}>
        <h1 className={styles.logo}>
          <img
            src="/design-reference/assets/hero-logo-dimensiongear.svg"
            alt="DimensionGear"
          />
        </h1>
        <p>
          Personalizează-ți experiența folosind
          <br />
          tehnologia noastră 3D în timp real
        </p>
        <Link className={styles.action} to="/customise">
          Începe acum
        </Link>
      </div>

      <div className={styles.model}>
        <LazyModelViewer
          cameraPosition={[0, 0.45, 5.05]}
          className={styles.modelViewer}
          modelPath="/models/optimized/gaming_chair(1).optimized.glb"
          modelRotation={[0.05, -0.38, 0]}
          modelScale={2.75}
          rootMargin="0px"
          title="Previzualizare 3D scaun de gaming DimensionGear"
        />
      </div>

    </section>
  )
}
