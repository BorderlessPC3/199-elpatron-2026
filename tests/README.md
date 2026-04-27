# Testes das regras do Firestore

Os testes em `firestore.rules.test.ts` usam o **Emulador do Firestore** via `@firebase/rules-unit-testing`.

## Como rodar

Na raiz do projeto:

```bash
npm run test:rules
```

O script chama `firebase emulators:exec` (via `npx`) com `--only firestore`, compila as regras e executa o Vitest. É necessário ter rede na primeira execução para baixar o `firebase-tools`.

## Cenários cobertos

1. Usuário A tenta ler `clients` de outro usuário B → deve falhar (`permission-denied`).
2. Criar cliente com `name` vazio → deve falhar.
3. Criar empréstimo com `loanAmount` / `amount` negativos → deve falhar.
4. Criar cliente com campo extra (`isAdmin`) → deve falhar (whitelist).

Há também um caso positivo: dono cria cliente e empréstimo com payload válido.
