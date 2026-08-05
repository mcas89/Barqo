import { Link } from 'react-router-dom'
import { TERMS_SECTIONS, TERMS_UPDATED_LABEL } from '../content'
import './LegalPage.css'

export function TermsPage() {
  return (
    <article className="legal-page">
      <h1>Termos de uso</h1>
      <p className="legal-page__updated">{TERMS_UPDATED_LABEL}</p>
      {TERMS_SECTIONS.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}
      <nav className="legal-page__nav">
        <Link to="/privacidade">Política de privacidade</Link>
        <Link to="/">Voltar ao início</Link>
      </nav>
    </article>
  )
}
