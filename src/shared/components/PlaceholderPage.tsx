import './PlaceholderPage.css'

interface PlaceholderPageProps {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <h1>{title}</h1>
      <p>{description}</p>
      <p className="placeholder-page__hint">Módulo preparado — implementação na sequência da V0.1.</p>
    </section>
  )
}
