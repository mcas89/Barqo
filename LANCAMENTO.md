# Lançamento BALQO V0.1

Status recomendado hoje: **piloto / primeiras lojas pagantes**, com comunicação honesta.  
Trava operacional de cobrança (rules, domínio, InfinitePay, termos/LGPD, aviso sem NF-e) está feita.  
**Não prometa** e-mail/WhatsApp automático do cupom nem NF-e. Offline = núcleo (venda/caixa).

- App: https://balqo.vercel.app
- Repo: https://github.com/mcas89/Barqo
- Versão: `1.0.13`
- Suporte: WhatsApp `5531983919015`
- Atualizado: 7 ago 2026

Marque com `[x]` o que for concluído.

---

## 1. Já está no ar

Não precisa refazer para o piloto.

- [x] Cadastro, loja, tema, logo
- [x] PDV com PIN, aparelhos e limites de plano
- [x] Produtos, estoque, caixa, clientes, fornecedores, equipe
- [x] Fiado só com cliente (todos os planos)
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
- [x] Passo 3: lease dispositivo 24h/72h + assinatura offline 7d + admin aparelhos
- [x] Escolher impressora da lista do Windows (agente local + modal em Configurações)
- [ ] API de e-mail do comprovante (`VITE_RECEIPT_API_URL`) — **fora da oferta atual** (UI ocultada)
- [x] Travar escrita de `subscriptions` nas rules (só o dono grava; republicar no Console)
- [x] PDV: cadastro rápido, venda avulsa, alterar preço na hora
- [x] Plano Controle: permissões finas (Equipe → checkboxes por funcionário)
- [x] Operador + dispositivo em vendas/caixa/estoque/fiado + evento `operator.switch`
- [x] PIN: 5 falhas → lock 5 min + log `pin_attempts` + reset ao redefinir PIN
- [x] Sync: recusa ops criadas após bloqueio/remoção do aparelho
- [x] Assinatura bloqueada online: vendas off; consulta/export/sync/billing on
- [x] Fechar versão `1.0.13`

### Offline — status

**Pronto no núcleo:**
1. [x] Venda, abertura e fechamento de caixa offline → `enqueueOperation` (ids `sale_*` / `cash_*` / `cashclose_*`)
2. [x] Cache local de produtos no PDV (`cacheProducts` / `listCachedProducts`)
3. [x] Espelho local de vendas/caixa
4. [x] `runSyncPass` grava no Firestore (ordem: `cash.open` → `sale.create` → `cash.close`); movimentos/fiado com ids estáveis
5. [x] Sync ao voltar online, no boot e após enfileirar
6. [x] Tela `/app/sync` + badge com contagem de pendências
7. [x] Retries com limite (8) e “Tentar de novo”
8. [x] Fechamento de caixa offline — snapshot congelado, fila `cash.close`, status `local_pending` / `confirmed` / `review_required`

**Ainda aberto (não bloqueia o núcleo):**
- Cache de clientes / fiado picker offline
- Política de conflito multiaparelho no estoque
- Sangria/suprimento na fila

Offline de venda + abertura/fechamento de caixa está coberto; **não prometa** ainda fiado/estoque multiaparelho offline em marketing.
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
- Receber comprovante por e-mail ou WhatsApp automático
- Offline total (clientes/fiado/estoque multiaparelho)
- Impressão silenciosa sem configurar impressora / agente local

---

## 6. Ordem sugerida

1. ~~Rules + domínio Auth~~
2. ~~Pagamento E2E~~
3. ~~Texto fiscal + termos~~
4. ~~2–5 pilotos~~ (em teste / primeiras vendas)
5. ~~Impressora / PDV rápido / rules / permissões~~ · ~~identidade operador~~ · ~~offline núcleo~~ · ~~lease aparelho/assinatura~~ · ~~fechamento offline~~ · ~~textos honestos de marketing~~
6. Novas implantações (e-mail/WhatsApp do cupom, etc.) **depois** de validar com os primeiros clientes
