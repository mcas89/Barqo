import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME, BALQO_LOGO_SRC } from '../../../shared/constants'
import {
  ENTRADA_TRIAL_DAYS,
  PLAN_CATALOG,
  PLAN_IDS,
  type PlanId,
} from '../../billing/plans'
import { formatMoney } from '../../../shared/lib/money'
import './LandingPage.css'

const PLAN_ORDER: PlanId[] = [
  PLAN_IDS.ENTRADA,
  PLAN_IDS.ESSENCIAL,
  PLAN_IDS.CONTROLE,
  PLAN_IDS.SALAO,
]

const PLAN_DIFF: Record<PlanId, string> = {
  [PLAN_IDS.ENTRADA]:
    'Para quem está começando a organizar vendas, caixa e estoque.',
  [PLAN_IDS.ESSENCIAL]:
    'Mais de uma pessoa no caixa, com PIN e controle de quem vendeu.',
  [PLAN_IDS.CONTROLE]:
    'Permissões, relatórios e visão do negócio além do balcão.',
  [PLAN_IDS.SALAO]:
    'Mesas, garçom e cozinha — para quem atende mesa, não só balcão.',
}

const BENEFITS = [
  {
    title: 'Venda rápido',
    text: 'Encontre produtos por nome ou código, monte o carrinho e receba em dinheiro, PIX ou cartão.',
  },
  {
    title: 'Saiba quanto vendeu',
    text: 'Acompanhe o movimento do dia e veja como cada venda foi recebida.',
  },
  {
    title: 'Controle seu estoque',
    text: 'Cada venda atualiza o estoque e você acompanha saldo, movimentações e produtos acabando.',
  },
  {
    title: 'Feche o caixa sem confusão',
    text: 'Dinheiro, PIX e cartão separados para você saber exatamente quanto deveria ter no fechamento.',
  },
] as const

const DAY_POINTS = [
  {
    title: 'Vendas do dia',
    text: 'Acompanhe o movimento enquanto trabalha.',
  },
  {
    title: 'Formas de pagamento',
    text: 'Veja quanto entrou em dinheiro, PIX e cartão.',
  },
  {
    title: 'Mais vendidos',
    text: 'Entenda quais produtos movimentam seu comércio.',
  },
] as const

const OFFLINE_POINTS = [
  {
    title: 'Venda offline',
    text: 'Continue registrando vendas mesmo sem conexão.',
  },
  {
    title: 'Caixa offline',
    text: 'Abertura, movimentações e fechamento continuam disponíveis.',
  },
  {
    title: 'Sincronização automática',
    text: 'A conexão voltou? O BALQO cuida do restante.',
  },
] as const

const EXTRAS = [
  {
    title: 'Fiado organizado',
    text: 'Registre vendas fiadas por cliente e acompanhe quem ainda precisa pagar.',
  },
  {
    title: 'Sangria de caixa',
    text: 'Registre retiradas sem perder o controle do movimento.',
  },
  {
    title: 'Estoque mínimo',
    text: 'Saiba quais produtos precisam de reposição.',
  },
  {
    title: 'Venda por dose',
    text: 'Para adegas e bares: doses sem perder o estoque da garrafa.',
  },
] as const

const AUDIENCES = [
  'Mercearias',
  'Conveniências',
  'Adegas',
  'Lojas',
  'Pequeno varejo',
] as const

const FAQ = [
  {
    q: 'Preciso de internet o tempo todo?',
    a: 'Não. Você continua vendendo e movimentando o caixa sem conexão. Quando a internet voltar, o BALQO sincroniza os dados.',
  },
  {
    q: 'Funciona no celular?',
    a: 'Sim. Use no computador ou no celular — e pode instalar o app na tela inicial.',
  },
  {
    q: 'O BALQO emite NF-e?',
    a: 'Não. O sistema emite comprovante interno de venda. Não realiza emissão fiscal de NF-e ou NFC-e.',
  },
  {
    q: 'Preciso de cartão para testar?',
    a: `Não. Você começa com ${ENTRADA_TRIAL_DAYS} dias grátis no Solo, sem cartão para iniciar.`,
  },
  {
    q: 'Posso subir de plano depois?',
    a: 'Sim. Comece no Solo e avance para Equipe, Gestão ou Salão quando o comércio pedir.',
  },
] as const

function useRevealOnScroll() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const nodes = root.querySelectorAll<HTMLElement>('[data-reveal]')
    if (nodes.length === 0) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach((node) => node.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  return rootRef
}

export function LandingPage() {
  const rootRef = useRevealOnScroll()
  const [planId, setPlanId] = useState<PlanId>(PLAN_IDS.ENTRADA)
  const plan = PLAN_CATALOG[planId]
  const isSolo = planId === PLAN_IDS.ENTRADA

  return (
    <div className="landing" ref={rootRef}>
      <header className="landing__nav">
        <Link to="/" className="landing__nav-brand" aria-label={APP_NAME}>
          <img src={BALQO_LOGO_SRC} alt="" />
          <span>{APP_NAME}</span>
        </Link>
        <nav className="landing__nav-links" aria-label="Seções">
          <a href="#recursos">Recursos</a>
          <a href="#precos">Preços</a>
        </nav>
        <div className="landing__nav-actions">
          <Link to="/entrar" className="landing__link">
            Entrar
          </Link>
          <Link to="/entrar?modo=cadastro" className="landing__btn landing__btn--sm">
            Começar grátis
          </Link>
        </div>
      </header>

      <section className="landing__hero">
        <div className="landing__hero-copy">
          <p className="landing__brand">{APP_NAME}</p>
          <h1>
            Venda. Controle.
            <br />
            Continue.
          </h1>
          <p className="landing__lead">
            O BALQO reúne PDV, caixa e estoque em um sistema simples para o dia a
            dia do seu comércio. Venda pelo computador ou celular e continue
            trabalhando mesmo quando a internet cair.
          </p>
          <div className="landing__cta-row">
            <Link to="/entrar?modo=cadastro" className="landing__btn landing__btn--pulse">
              Começar grátis
            </Link>
            <a href="#produto" className="landing__btn landing__btn--ghost">
              Ver como funciona
            </a>
          </div>
          <ul className="landing__trust">
            <li>{ENTRADA_TRIAL_DAYS} dias grátis</li>
            <li>Sem cartão para começar</li>
            <li>Funciona mesmo sem internet</li>
          </ul>
        </div>
        <div className="landing__hero-visual">
          <div className="landing__hero-glow" aria-hidden />
          <img src="/page/pdv.png" alt="Tela do PDV BALQO" />
        </div>
      </section>

      <section className="landing__intro" id="recursos" data-reveal>
        <h2>Tudo o que acontece no balcão, em um só lugar.</h2>
        <p>
          Menos caderno, menos planilha e mais controle sobre o seu comércio.
        </p>
      </section>

      <section className="landing__benefits" aria-label="Benefícios">
        <ul>
          {BENEFITS.map((item, index) => (
            <li
              key={item.title}
              data-reveal
              style={{ ['--reveal-delay' as string]: `${index * 70}ms` }}
            >
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing__showcase" id="produto">
        <div className="landing__showcase-copy" data-reveal>
          <h2>Um PDV feito para o ritmo do seu balcão</h2>
          <p>
            Venda sem navegar por telas complicadas. Busque o produto, adicione ao
            carrinho, escolha a forma de pagamento e finalize.
          </p>
          <p className="landing__showcase-note">
            Do primeiro produto ao pagamento em poucos passos.
          </p>
        </div>
        <figure className="landing__showcase-media" data-reveal>
          <img src="/page/pdv.png" alt="PDV BALQO com carrinho e pagamento" loading="lazy" />
        </figure>
      </section>

      <section className="landing__showcase landing__showcase--flip">
        <div className="landing__showcase-copy" data-reveal>
          <h2>Abra o BALQO e saiba como está o seu dia</h2>
          <p>
            Veja rapidamente quanto vendeu, como recebeu e quais produtos estão
            saindo mais. Sem precisar montar planilhas no fim do expediente.
          </p>
          <ul className="landing__mini-list">
            {DAY_POINTS.map((item) => (
              <li key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <figure className="landing__showcase-media" data-reveal>
          <img src="/page/inicio.png" alt="Painel do dia no BALQO" loading="lazy" />
        </figure>
      </section>

      <section className="landing__showcase">
        <div className="landing__showcase-copy" data-reveal>
          <h2>Estoque que acompanha suas vendas</h2>
          <p>
            O produto saiu no caixa? O estoque acompanha. Consulte saldos,
            movimentações e produtos com estoque baixo sem atualizar tudo na mão.
          </p>
        </div>
        <figure className="landing__showcase-media" data-reveal>
          <img src="/page/estoque.png" alt="Estoque de produtos no BALQO" loading="lazy" />
        </figure>
      </section>

      <section className="landing__showcase landing__showcase--flip">
        <div className="landing__showcase-copy" data-reveal>
          <h2>Feche o caixa sem confusão</h2>
          <p>
            Dinheiro na gaveta, PIX e cartão separados. Você sabe quanto deveria
            ter no fechamento — sem misturar fiado com a gaveta.
          </p>
        </div>
        <figure className="landing__showcase-media" data-reveal>
          <img src="/page/caixa.png" alt="Caixa do BALQO" loading="lazy" />
        </figure>
      </section>

      <section className="landing__offline" aria-labelledby="landing-offline-title">
        <div className="landing__offline-inner">
          <p className="landing__offline-eyebrow" data-reveal>
            Diferencial
          </p>
          <h2 id="landing-offline-title" data-reveal>
            A internet caiu. Seu caixa não precisa parar.
          </h2>
          <p className="landing__offline-lead" data-reveal>
            O BALQO foi pensado para o comércio real. Se a conexão cair durante o
            expediente, você continua vendendo e movimentando o caixa. Quando a
            internet voltar, os dados sincronizam.
          </p>
          <ul className="landing__offline-points">
            {OFFLINE_POINTS.map((item, index) => (
              <li
                key={item.title}
                data-reveal
                style={{ ['--reveal-delay' as string]: `${index * 80}ms` }}
              >
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing__extras" aria-labelledby="landing-extras-title">
        <div className="landing__extras-head" data-reveal>
          <h2 id="landing-extras-title">Mais controle para o dia a dia</h2>
          <p>Situações comuns do comércio, sem planilha à parte.</p>
        </div>
        <div className="landing__extras-grid">
          {EXTRAS.map((item, index) => (
            <article
              key={item.title}
              data-reveal
              style={{ ['--reveal-delay' as string]: `${index * 70}ms` }}
            >
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
        <figure className="landing__extras-media" data-reveal>
          <img src="/page/fiado.png" alt="Fiado e contas a receber no BALQO" loading="lazy" />
        </figure>
      </section>

      <section className="landing__audience" data-reveal>
        <h2>Feito para pequenos comércios</h2>
        <p>
          Mercearias, conveniências, adegas, lojas e outros pequenos varejistas
          que querem um caixa simples sem abrir mão de controle.
        </p>
        <p className="landing__audience-note">
          Você não precisa adaptar seu comércio a um sistema complicado. O BALQO
          se adapta ao seu balcão.
        </p>
        <ul>
          {AUDIENCES.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="landing__pricing" id="precos" aria-labelledby="landing-pricing-title">
        <div className="landing__pricing-head" data-reveal>
          <p className="landing__pricing-eyebrow">Comece simples</p>
          <h2 id="landing-pricing-title">Escolha o ritmo do seu comércio</h2>
          <p>Comece no Solo. Suba de plano quando a equipe ou o salão pedirem.</p>
        </div>

        <div className="landing__plan-tabs" role="tablist" aria-label="Planos" data-reveal>
          {PLAN_ORDER.map((id) => {
            const item = PLAN_CATALOG[id]
            const active = id === planId
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                className={
                  active
                    ? 'landing__plan-tab landing__plan-tab--active'
                    : 'landing__plan-tab'
                }
                onClick={() => setPlanId(id)}
              >
                {item.name}
              </button>
            )
          })}
        </div>

        <div className="landing__pricing-copy" role="tabpanel" key={planId}>
          <h3>{plan.name}</h3>
          <p className="landing__plan-diff">{PLAN_DIFF[planId]}</p>
          <p className="landing__plan-audience">{plan.audience}</p>
          <p className="landing__pricing-amount">
            <strong>{formatMoney(plan.priceMonthlyCents)}</strong>
            <span>/mês</span>
          </p>
          <ul>
            {plan.includedHighlights
              .filter((line) => !/nf-e/i.test(line))
              .slice(0, 8)
              .map((line) => (
                <li key={line}>{line}</li>
              ))}
          </ul>
          <Link to="/entrar?modo=cadastro" className="landing__btn">
            {isSolo
              ? `Começar ${ENTRADA_TRIAL_DAYS} dias grátis`
              : `Criar conta e escolher ${plan.name}`}
          </Link>
          {isSolo ? (
            <p className="landing__pricing-note">Sem cartão para começar.</p>
          ) : null}
        </div>
      </section>

      <section className="landing__faq" aria-labelledby="landing-faq-title">
        <h2 id="landing-faq-title" data-reveal>
          Perguntas frequentes
        </h2>
        <div className="landing__faq-list">
          {FAQ.map((item, index) => (
            <details
              key={item.q}
              data-reveal
              style={{ ['--reveal-delay' as string]: `${index * 50}ms` }}
            >
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing__final" data-reveal>
        <h2>Seu comércio em movimento.</h2>
        <p>
          Pare de depender de caderno e planilhas para saber o que aconteceu no
          seu caixa. Experimente o BALQO gratuitamente por {ENTRADA_TRIAL_DAYS}{' '}
          dias.
        </p>
        <Link to="/entrar?modo=cadastro" className="landing__btn landing__btn--pulse">
          Criar minha conta grátis
        </Link>
        <p className="landing__final-note">Funciona no computador e no celular.</p>
      </section>

      <footer className="landing__footer">
        <p className="landing__footer-brand">{APP_NAME}</p>
        <nav>
          <Link to="/termos">Termos</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/entrar">Entrar</Link>
        </nav>
        <p className="landing__footer-legal">
          O BALQO emite comprovante interno de venda. Não realiza emissão fiscal
          de NF-e/NFC-e.
        </p>
      </footer>
    </div>
  )
}
