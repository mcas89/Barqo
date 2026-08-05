import { Link } from 'react-router-dom'
import { PRIVACY_SECTIONS, TERMS_UPDATED_LABEL } from '../content'
import './LegalPage.css'

export function PrivacyPage() {
  return (
    <article className="legal-page">
      <h1>Política de privacidade</h1>
      <p className="legal-page__updated">{TERMS_UPDATED_LABEL} · LGPD</p>
      {PRIVACY_SECTIONS.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}
      <nav className="legal-page__nav">
        <Link to="/termos">Termos de uso</Link>
        <Link to="/">Voltar ao início</Link>
      </nav>
    </article>
  )
}
