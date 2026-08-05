# Lançamento BALQO V0.1

Status recomendado hoje: **piloto com 2–5 lojas**.  
Trava operacional de cobrança (rules, domínio, InfinitePay, termos/LGPD, aviso sem NF-e) está feita.  
Ainda **não** está fechado para cobrar em escala — falta **fechamento offline confirmado** + lease de aparelho/assinatura (e API de e-mail).

- App: https://balqo.vercel.app
- Repo: https://github.com/mcas89/Barqo
- Versão: `0.1.13`
- Suporte: WhatsApp `5531983919015`
- Atualizado: 5 ago 2026

Marque com `[x]` o que for concluído.

---

## 1. Já está no ar

Não precisa refazer para o piloto.

- [x] Cadastro, loja, tema, logo
- [x] PDV com PIN, aparelhos e limites de plano
- [x] Produtos, estoque, caixa, clientes, fornecedores, equipe
- [x] Fiado só com cliente (Essencial+)
- [x] Relatório do dia; período/exportação conforme o plano
- [x] Planos Entrada R$19,90 / Essencial R$39,90 / Controle R$59,90
- [x] Trial 10 dias, aviso, 3 dias de carência, bloqueio
- [x] Upgrade só com diferença de preço; sem downgrade no ciclo
- [x] InfinitePay + tela de plano / comprovante / histórico
- [x] PWA com atualização sem desinstalar
- [x] Bip no código de barras
- [x] Cupom + 2ª via (PDV, Início, Relatórios)
- [x] WhatsApp de suporte

---

## 2. Trava cobrança (fazer antes de vender mensalidade)

Sem isso, não cobre cliente novo de verdade.

- [x] Publicar `firestore.rules` no Firebase Console  
      Arquivo local: `firestore.rules` · o GitHub **não** publica sozinho.
- [x] Autorizar `balqo.vercel.app` em Authentication → Settings → Authorized domains
- [x] Teste InfinitePay ponta a ponta  
      Trial → pagar → voltar → plano ativo → upgrade com diferença → recibo na tela de Planos
- [x] Termos de uso + Privacidade / LGPD no site e aceite no cadastro
- [x] Texto claro: cupom **não é documento fiscal** / sem NF-e neste lançamento
- [x] Rodar 2 a 5 lojas piloto no trial e anotar o que quebra no balcão

### Como publicar as rules

1. Firebase Console → projeto `balqo-pdv`
2. Firestore → Rules
3. Colar o conteúdo de `firestore.rules`
4. Publicar

### Como autorizar o domínio

1. Authentication → Settings → Authorized domains
2. Incluir `balqo.vercel.app` (e o domínio customizado, se houver)

---

## 3. Ainda falta no produto

Dá para pilotoar sem isso. **Não venda como pronto.**

- [x] Offline confiável (núcleo) — venda/caixa na fila, sync idempotente, tela Sync
- [x] Escolher impressora da lista do Windows (agente local + modal em Configurações)
- [ ] API de e-mail do comprovante (`VITE_RECEIPT_API_URL`) — UI em manutenção por enquanto
- [x] Travar escrita de `subscriptions` nas rules (só o dono grava; republicar no Console)
- [x] PDV: cadastro rápido, venda avulsa, alterar preço na hora
- [x] Plano Controle: permissões finas (Equipe → checkboxes por funcionário)
- [x] Operador + dispositivo em vendas/caixa/estoque/fiado + evento `operator.switch`
- [x] Fechar versão `0.1.13`

### Offline — status

**Pronto no núcleo:**
1. [x] Venda e abertura de caixa offline → `enqueueOperation` (ids `sale_*` / `cash_*`)
2. [x] Cache local de produtos no PDV (`cacheProducts` / `listCachedProducts`)
3. [x] Espelho local de vendas/caixa
4. [x] `runSyncPass` grava no Firestore (ordem: caixa → venda); movimentos/fiado com ids estáveis
5. [x] Sync ao voltar online, no boot e após enfileirar
6. [x] Tela `/app/sync` + badge com contagem de pendências
7. [x] Retries com limite (8) e “Tentar de novo”

**Ainda aberto (não bloqueia o núcleo):**
- Fechamento de caixa offline com status `local_pending` / `confirmed` / `review_required`
- Cache de clientes / fiado picker offline
- Política de conflito multiaparelho no estoque
- Login/PIN sem internet (lease de dispositivo / assinatura offline — etapas 4–5)
- Sangria/suprimento/fechamento na fila

Até fechar fechamento offline + lease, **não prometa offline de ponta a ponta em marketing**.
---

## 4. Fora deste lançamento

Não entra no V0.1. Não prometer.

- [ ] ~~NF-e / NFC-e~~ — fora de propósito
- [ ] ~~Multiempresa~~ — escopo travado em 1 loja
- [ ] Webhook InfinitePay via Cloud Function — a volta do pagamento hoje é no app
- [ ] Ícone PWA só com símbolo (hoje é a marca completa)

---

## 5. O que falar para a loja piloto

Pode:

- Vender no balcão, controlar estoque e caixa, equipe com PIN, fiado, relatórios do plano.

Não pode (ainda):

- Nota fiscal eletrônica
- Fechamento de caixa offline com confirmação de sync (núcleo de venda offline já existe)
- Receber comprovante por e-mail automático
- Impressão silenciosa sem configurar impressora / agente local

---

## 6. Ordem sugerida

1. ~~Rules + domínio Auth~~
2. ~~Pagamento E2E~~
3. ~~Texto fiscal + termos~~
4. ~~2–5 pilotos~~ (em teste)
5. ~~Impressora / PDV rápido / rules / permissões Controle~~ · ~~identidade operador/dispositivo~~ · **offline núcleo** (republicar `firestore.rules` se ainda não — inclui `audit_events`)
6. Fechamento offline + lease de aparelho/assinatura → depois abrir cobrança em escala
