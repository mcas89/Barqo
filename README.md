# BALQO

PDV SaaS para pequenos comerciantes (balcão).  
Cupom interno — **não emite NF-e**. Sem e-mail/WhatsApp automático de comprovante neste lançamento.

## Stack inicial

- React + TypeScript (Vite)
- Firebase (Auth, Firestore, Storage)
- Dexie (IndexedDB) para offline do núcleo (venda/caixa)
- PWA (`vite-plugin-pwa`)
- Deploy: GitHub + Vercel

## Firebase

1. Copie `.env.example` → `.env` para desenvolver no PC
2. No Firebase Console, ative **Authentication → E-mail/senha**
3. Publique `firestore.rules` no Console antes de produção
4. As chaves públicas do Firebase de produção estão em `.env.production` (sobe no GitHub).
   A Vercel usa esse arquivo no `vite build`. Não precisa cadastrar de novo no painel.

```bash
npm install
npm run dev
```

## Estrutura

```text
src/
  app/          # shell, rotas, layouts, providers
  features/     # domínios (pos, caixa, estoque, ...)
  shared/       # UI e utilitários compartilhados
  infra/        # firebase, offline, sync
  styles/
```

## Planos (V0.1)

| Plano | Preço | Foco |
|---|---|---|
| Entrada | R$ 19,90/mês | PDV, caixa, estoque e fiado · 10 dias grátis |
| Essencial | R$ 39,90/mês | Equipe, mais aparelhos e relatórios do período |
| Controle | R$ 59,90/mês | Permissões finas e visão gerencial |

Depois de assinar, só é possível subir de plano, pagando a diferença.

Catálogo e gates: `src/features/billing/plans/`.

## O que não prometer (ainda)

- NF-e / NFC-e
- Comprovante por e-mail ou WhatsApp automático
- Offline total (clientes/fiado/estoque multiaparelho)

## Deploy (GitHub + Vercel)

Repositório: https://github.com/mcas89/Barqo

No Vercel, importe o repo. As variáveis `VITE_*` de produção vêm de `.env.production`.

No Firebase Auth, autorize o domínio `balqo.vercel.app` e o domínio final.

## PWA e atualizações

O BALQO instala no celular ou no caixa (`standalone`). Com o app aberto, o service worker
verifica atualização a cada minuto, ao focar a janela e ao voltar online.

Quando há versão nova, aparece o aviso **Atualizar agora** com barra de progresso.
Não é preciso desinstalar e instalar de novo. Finalize a venda no PDV antes de aplicar.
