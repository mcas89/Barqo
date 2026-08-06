import { Link } from 'react-router-dom'
import { CircleHelp, MessageCircle } from 'lucide-react'
import { APP_NAME, BALQO_SUPPORT_WHATSAPP } from '../../../shared/constants'
import { formatWhatsappDisplay, whatsappUrl } from '../../../shared/lib/whatsapp'
import { useAuth } from '../../../shared/hooks/useAuth'
import { HELP_TOPICS } from '../content'
import './HelpPage.css'

export function HelpPage() {
  const { user, organization } = useAuth()

  const supportHref = whatsappUrl(
    BALQO_SUPPORT_WHATSAPP,
    `Olá, sou ${user?.displayName || 'usuário'} da loja ${organization?.name || APP_NAME}. Preciso de ajuda no tutorial.`,
  )

  return (
    <section className="help-page">
      <header className="help-page__header">
        <div>
          <p className="help-page__eyebrow">
            <CircleHelp size={16} strokeWidth={2} aria-hidden />
            Tutorial
          </p>
          <h1>Ajuda do {APP_NAME}</h1>
          <p>Guia rápido para o dia a dia no balcão — consulte quando precisar.</p>
        </div>
        <a
          className="help-page__support"
          href={supportHref}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={18} strokeWidth={2} aria-hidden />
          WhatsApp suporte
        </a>
      </header>

      <nav className="help-page__toc" aria-label="Índice da ajuda">
        {HELP_TOPICS.map((topic) => {
          const Icon = topic.icon
          return (
            <a key={topic.id} href={`#${topic.id}`} className="help-page__toc-item">
              <Icon size={18} strokeWidth={2} aria-hidden />
              <span>{topic.title}</span>
            </a>
          )
        })}
      </nav>

      <div className="help-page__topics">
        {HELP_TOPICS.map((topic) => {
          const Icon = topic.icon
          return (
            <article key={topic.id} id={topic.id} className="help-page__topic">
              <header className="help-page__topic-head">
                <span className="help-page__topic-icon" aria-hidden>
                  <Icon size={22} strokeWidth={2} />
                </span>
                <div>
                  <h2>{topic.title}</h2>
                  <p>{topic.summary}</p>
                </div>
              </header>

              <ol className="help-page__steps">
                {topic.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              {topic.tip ? (
                <p className="help-page__tip" role="note">
                  <strong>Dica:</strong> {topic.tip}
                </p>
              ) : null}

              {topic.link ? (
                <Link to={topic.link.to} className="help-page__link">
                  {topic.link.label}
                </Link>
              ) : null}
            </article>
          )
        })}
      </div>

      <footer className="help-page__footer">
        <p>
          Ainda com dúvida? Fale conosco no WhatsApp{' '}
          <a href={supportHref} target="_blank" rel="noreferrer">
            {formatWhatsappDisplay(BALQO_SUPPORT_WHATSAPP)}
          </a>
          .
        </p>
        <p className="help-page__fine">
          Cupom interno não é documento fiscal. O {APP_NAME} não emite NF-e neste lançamento.
        </p>
      </footer>
    </section>
  )
}
