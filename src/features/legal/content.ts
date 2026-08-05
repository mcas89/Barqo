import { APP_NAME, BALQO_SUPPORT_WHATSAPP } from '../../shared/constants'
import { formatWhatsappDisplay } from '../../shared/lib/whatsapp'

export const FISCAL_DISCLAIMER =
  'O BALQO não emite NF-e, NFC-e nem SAT. O cupom é comprovante interno da loja e não substitui documento fiscal. A obrigação fiscal continua sendo da loja.'

export const TERMS_UPDATED_LABEL = 'Atualizado em 5 de agosto de 2026'

export const TERMS_SECTIONS = [
  {
    title: '1. O que é o BALQO',
    body: `${APP_NAME} é um sistema de PDV na nuvem (SaaS) para organizar vendas, caixa, estoque, equipe e cobrança da assinatura. Ao criar conta ou loja, você concorda com estes Termos.`,
  },
  {
    title: '2. Conta e uso',
    body: 'A conta do proprietário é pessoal. A loja é responsável pelos operadores, PINs, aparelhos e pelo que for lançado no sistema. Use o BALQO de forma lícita e de acordo com o plano contratado.',
  },
  {
    title: '3. Documento fiscal',
    body: `${FISCAL_DISCLAIMER} Se a sua atividade exigir nota fiscal, use o emissor ou o contador da loja. O BALQO não substitui essa obrigação.`,
  },
  {
    title: '4. Planos e pagamento',
    body: 'O plano Entrada inclui período de teste gratuito. Depois, a assinatura é cobrada pelo meio de pagamento indicado (hoje InfinitePay). Upgrade no mesmo ciclo cobra só a diferença. Não há downgrade no ciclo já pago. Sem pagamento após o vencimento e a carência, o acesso operacional pode ser bloqueado.',
  },
  {
    title: '5. Disponibilidade',
    body: 'O serviço depende de internet, navegador e serviços de terceiros (como Firebase e o gateway de pagamento). Podemos corrigir falhas, atualizar o app e interromper o uso em caso de abuso ou inadimplência.',
  },
  {
    title: '6. Suporte e contato',
    body: `Dúvidas de uso, cobrança ou privacidade: WhatsApp ${formatWhatsappDisplay(BALQO_SUPPORT_WHATSAPP)}.`,
  },
]

export const PRIVACY_SECTIONS = [
  {
    title: '1. Quem trata os dados',
    body: `O ${APP_NAME} trata dados para prestar o PDV à loja cadastrada. Pedidos sobre privacidade podem ser feitos pelo WhatsApp ${formatWhatsappDisplay(BALQO_SUPPORT_WHATSAPP)}.`,
  },
  {
    title: '2. Quais dados usamos',
    body: 'Dados da conta (nome, e-mail, senha criptografada no Firebase Auth), dados da loja, produtos, vendas, caixa, clientes, fiado, equipe (incluindo hash do PIN), aparelhos e pagamentos da assinatura. Também usamos identificadores locais do PWA e do aparelho para limite de dispositivos.',
  },
  {
    title: '3. Para que usamos',
    body: 'Operar o PDV, autenticar usuários, aplicar o plano, processar a assinatura, melhorar o produto e cumprir obrigação legal quando existir.',
  },
  {
    title: '4. Com quem compartilhamos',
    body: 'Firebase (Google) para autenticação e banco; InfinitePay para cobrança da assinatura; a própria loja, que enxerga os dados do seu comércio. Não vendemos cadastro para marketing de terceiros.',
  },
  {
    title: '5. Seus direitos (LGPD)',
    body: 'Você pode pedir acesso, correção, exclusão, portabilidade e informação sobre o uso dos dados, na medida da lei. A exclusão da conta/loja pode impedir o uso do sistema. Alguns registros podem ser mantidos pelo tempo necessário para cobrança, segurança ou obrigação legal.',
  },
  {
    title: '6. Segurança e retenção',
    body: 'Usamos autenticação, regras de acesso por loja e hash de PIN. Nenhum sistema é 100% invulnerável. Os dados ficam enquanto a loja usar o BALQO ou pelo prazo necessário após o encerramento.',
  },
  {
    title: '7. Menores e atualizações',
    body: 'O BALQO é voltado a comércios e contas de responsáveis pela loja. Esta política pode ser atualizada; a data no topo da página indica a versão vigente.',
  },
]
