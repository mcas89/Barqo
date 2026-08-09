# Certificados QZ Tray (CA BALQO)

Gerados para o site `balqo.vercel.app` (SHA-256).

| Arquivo | Uso |
|---------|-----|
| `ca-cert.pem` → `public/qz/override.crt` | CA raiz — download/instalação em cada PC do caixa |
| `site-cert.pem` → `public/qz/digital-certificate.txt` | Certificado apresentado pelo BALQO |
| `site-key.pem` → `src/features/receipts/qz-private-key.pem` | Chave de assinatura no app |
| `ca-key.pem` | Chave da CA (renovação) — **não** colocar em `public/` |

## Regenerar (Git Bash)

```bash
export MSYS_NO_PATHCONV=1
mkdir -p scripts/qz-ca
openssl genrsa -out scripts/qz-ca/ca-key.pem 2048
openssl req -x509 -new -nodes -key scripts/qz-ca/ca-key.pem -sha256 -days 3650 \
  -out scripts/qz-ca/ca-cert.pem -subj '/C=BR/O=BALQO/CN=BALQO Root CA'
openssl genrsa -out scripts/qz-ca/site-key.pem 2048
openssl req -new -key scripts/qz-ca/site-key.pem -out scripts/qz-ca/site.csr \
  -subj '/C=BR/O=BALQO/CN=balqo.vercel.app'
openssl x509 -req -in scripts/qz-ca/site.csr -CA scripts/qz-ca/ca-cert.pem \
  -CAkey scripts/qz-ca/ca-key.pem -CAcreateserial \
  -out scripts/qz-ca/site-cert.pem -days 3650 -sha256

cp scripts/qz-ca/ca-cert.pem public/qz/override.crt
cp scripts/qz-ca/site-cert.pem public/qz/digital-certificate.txt
cp scripts/qz-ca/site-key.pem src/features/receipts/qz-private-key.pem
```

Depois de regenerar, cada loja deve baixar de novo o `override.crt` e substituir no QZ Tray.
