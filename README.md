# El Patron - Gestao de Clientes e Emprestimos

Aplicacao web em React + TypeScript para controle de clientes, emprestimos, agenda, notificacoes e relatorios.

## Stack

- React 18 + TypeScript
- Vite
- React Router
- Firebase (Auth + Firestore)
- Recharts (graficos)
- FontAwesome

## Requisitos

- Node.js 18+ (recomendado)
- NPM 9+
- Projeto Firebase configurado

## Configuracao

1. Instale dependencias:

```bash
npm install
```

2. Configure variaveis de ambiente (arquivo `.env`).
3. Rode em desenvolvimento:

```bash
npm run dev
```

## Scripts

- `npm run dev`: inicia ambiente local
- `npm run build`: gera build de producao
- `npm run lint`: executa ESLint
- `npm run preview`: sobe build local para validacao

## Estrutura principal

- `src/routes`: configuracao de rotas da aplicacao
- `src/contexts`: providers globais (auth, tema, toasts)
- `src/pages`: paginas de dominio (`dashboard`, `clients`, `payments`, `agenda`, `reports`, `notifications`)
- `src/services`: integracao com Firebase e regras de negocio de dados
- `src/utils`: normalizacao e utilitarios

## Rotas ativas

- Publicas: `/login`, `/loading`
- Privadas: `/dashboard`, `/notifications`, `/clients`, `/payments`, `/agenda`, `/reports`

## Observacoes

- A navegacao principal fica no `Layout` (sidebar).
- As rotas privadas exigem autenticacao via `ProtectedRoute`.
- Este projeto nao usa Next.js; diretivas como `"use client"` nao sao necessarias aqui.
