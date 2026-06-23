import { Outlet } from 'react-router-dom'
import { ChatBot } from '../../components/ChatBot/ChatBot'
import { Footer } from '../../components/Footer/Footer'
import { Navbar } from '../../components/Navbar/Navbar'
import styles from './MainLayout.module.scss'

export function MainLayout() {
  return (
    <div className={styles.shell}>
      <Navbar />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
      <ChatBot />
    </div>
  )
}
