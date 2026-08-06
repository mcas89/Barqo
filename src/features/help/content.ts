import type { LucideIcon } from 'lucide-react'
import {
  Banknote,
  Boxes,
  CircleHelp,
  CreditCard,
  Package,
  RefreshCw,
  Store,
  Undo2,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'

export interface HelpTopic {
  id: string
  title: string
  summary: string
  icon: LucideIcon
  steps: string[]
  tip?: string
  link?: { to: string; label: string }
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'primeiro-dia',
    title: 'Primeiro dia na loja',
    summary: 'Do login à primeira venda, na ordem certa.',
    icon: CircleHelp,
    steps: [
      'Entre com e-mail e senha. Se ainda não cadastrou o comércio, complete o onboarding (nome, tema e plano).',
      'No PDV, desbloqueie com o PIN do proprietário ou operador.',
      'Abra o caixa informando o dinheiro que já está na gaveta.',
      'Cadastre alguns produtos (ou use cadastro rápido no PDV).',
      'Faça uma venda de teste, feche o caixa e confira o Início.',
    ],
    tip: 'O cupom do BALQO é comprovante interno — não é NF-e.',
    link: { to: '/app/pos', label: 'Abrir PDV' },
  },
  {
    id: 'pdv',
    title: 'PDV — vender no balcão',
    summary: 'Busca, carrinho, formas de pagamento e atalhos.',
    icon: Store,
    steps: [
      'Busque por nome ou código de barras e Enter para incluir.',
      'Ajuste quantidade, preço na hora ou remova item (pode pedir PIN).',
      'Use Avulsa para item sem cadastro; Cadastro rápido cria o produto e já vende.',
      'Cliente: toque no chip Cliente. Sem cliente = caixa livre.',
      'Escolha a forma de pagamento e finalize. Dinheiro pede valor recebido (troco).',
      'Coloque a venda em espera se o cliente for atender depois (até 3 por aparelho).',
      '2ª via reimprime cupons do dia.',
    ],
    tip: 'O botão Fiado só aparece depois de selecionar um cliente.',
    link: { to: '/app/pos', label: 'Ir ao PDV' },
  },
  {
    id: 'produtos',
    title: 'Produtos, códigos e etiquetas',
    summary: 'Catálogo, estoque mínimo e código de barras.',
    icon: Package,
    steps: [
      'Em Produtos, cadastre nome, preço, custo, unidade e estoque.',
      'Código pode ser do fabricante ou gerado pelo BALQO (BQL…).',
      'Gere códigos ausentes em lote e imprima etiquetas quando precisar.',
      'Serviços não controlam estoque; produtos sim.',
    ],
    link: { to: '/app/products', label: 'Ver produtos' },
  },
  {
    id: 'caixa',
    title: 'Caixa e dinheiro na gaveta',
    summary: 'O que entra na gaveta e o que é só registro.',
    icon: Banknote,
    steps: [
      'Abra o caixa com o valor inicial em espécie.',
      'Total vendido = tudo que saiu (inclui fiado).',
      'Recebido (sem fiado) = dinheiro/PIX/cartão registrados.',
      'Fiado a receber = dívida do cliente — não está na gaveta.',
      'Dinheiro esperado na gaveta = só espécie (abertura + vendas em dinheiro − troco ± sangria/suprimento).',
      'Sangria tira dinheiro; suprimento coloca. Feche o caixa contando a gaveta.',
    ],
    tip: 'Ex.: vendeu R$ 30, sendo R$ 10 fiado → a gaveta só “espera” o que foi em dinheiro, não os R$ 30.',
    link: { to: '/app/cash', label: 'Abrir caixa' },
  },
  {
    id: 'fiado',
    title: 'Fiado e contas a receber',
    summary: 'Vender fiado e receber depois.',
    icon: Wallet,
    steps: [
      'Cadastre o cliente em Clientes (ou pelo PDV).',
      'No PDV, selecione o cliente — aí aparece o botão Fiado.',
      'A venda gera uma conta em Fiado / Contas a receber.',
      'Quando o cliente pagar, baixe o valor na tela Fiado (pode ser parcial).',
      'Fiado não aumenta o dinheiro da gaveta até a baixa.',
    ],
    link: { to: '/app/receivables', label: 'Ver fiado' },
  },
  {
    id: 'cancelar',
    title: 'Cancelar ou devolver venda',
    summary: 'Desfaz venda do dia com motivo e autorização.',
    icon: Undo2,
    steps: [
      'Abra Cancelar (menu ou atalho no Caixa).',
      'Escolha a venda de hoje, confira itens e pagamentos.',
      'Informe o motivo e confirme (PIN de gerente/dono se precisar).',
      'A venda sai do faturamento, o estoque volta e o fiado em aberto é cancelado.',
      'Se foi em dinheiro, retire da gaveta ou faça sangria — o físico não some sozinho.',
    ],
    tip: 'Se o fiado já teve pagamento, quite ou resolva o recebimento antes de cancelar.',
    link: { to: '/app/sales', label: 'Cancelar venda' },
  },
  {
    id: 'estoque',
    title: 'Estoque e fornecedores',
    summary: 'Entradas, perdas e alertas.',
    icon: Boxes,
    steps: [
      'Vendas baixam estoque automaticamente (produtos, não avulsas/serviços).',
      'Em Estoque, registre entrada, perda ou ajuste contado.',
      'Estoque baixo aparece no Início quando há mínimo cadastrado.',
      'Fornecedores guardam contatos para compra — não geram NF-e no BALQO.',
    ],
    link: { to: '/app/inventory', label: 'Ver estoque' },
  },
  {
    id: 'equipe',
    title: 'Equipe, PIN e aparelhos',
    summary: 'Quem opera o PDV e quantos dispositivos.',
    icon: UserCog,
    steps: [
      'Em Equipe, cadastre operadores com PIN (planos com multi-usuário).',
      'Proprietário e gerente autorizam ações sensíveis com PIN.',
      'Cada aparelho conta no limite do plano; remova aparelhos antigos em Configurações.',
      'Troca de operador no PDV gera registro de auditoria.',
    ],
    tip: 'Vários PINs errados bloqueiam por alguns minutos.',
    link: { to: '/app/team', label: 'Ver equipe' },
  },
  {
    id: 'clientes',
    title: 'Clientes',
    summary: 'Cadastro para fiado e identificação na venda.',
    icon: Users,
    steps: [
      'Cadastre nome e, se quiser, telefone e documento.',
      'No PDV, selecione o cliente da venda ou use Caixa livre.',
      'Cliente é obrigatório para fiado.',
    ],
    link: { to: '/app/customers', label: 'Ver clientes' },
  },
  {
    id: 'offline',
    title: 'Offline e Sync',
    summary: 'Continuar vendendo sem internet e sincronizar depois.',
    icon: RefreshCw,
    steps: [
      'Com catálogo e caixa já abertos, vendas e movimentos podem ficar na fila local.',
      'Quando a internet voltar, a Sync envia o pendente.',
      'Confira a tela Sync se algo ficar parado.',
      'Cancelar venda e algumas ações ainda pedem internet.',
    ],
    link: { to: '/app/sync', label: 'Ver Sync' },
  },
  {
    id: 'planos',
    title: 'Planos e pagamento',
    summary: 'Trial, assinatura e upgrade.',
    icon: CreditCard,
    steps: [
      'Entrada tem trial; depois o acesso segue o status do plano.',
      'Em Planos, escolha ciclo e pague pelo checkout.',
      'Upgrade cobra a diferença do período; downgrade no ciclo não está liberado.',
      'Se o pagamento atrasar, há aviso e carência antes do bloqueio de vendas.',
    ],
    tip: 'Com assinatura bloqueada você ainda consulta e sincroniza, mas não vende.',
    link: { to: '/app/billing', label: 'Ver planos' },
  },
]
