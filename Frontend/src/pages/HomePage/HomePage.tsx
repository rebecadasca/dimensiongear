import { HeroSection } from './sections/HeroSection'
import { RecommendationsSection } from './sections/RecommendationsSection'
import styles from './HomePage.module.scss'

export function HomePage() {
  return (
    <div className={styles.page}>
      <HeroSection />
      <RecommendationsSection />
    </div>
  )
}
