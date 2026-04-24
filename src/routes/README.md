# Rotas da Aplicação

Roteamento principal em `Routes.tsx`, usando React Router (`BrowserRouter` + rotas protegidas).

## Rotas públicas

- `/login`: autenticação do usuário
- `/loading`: tela de carregamento

## Rotas privadas (com `Layout`)

- `/dashboard`: visão consolidada do negócio
- `/notifications`: notificações do sistema
- `/clients`: gestão de clientes
- `/payments`: gestão de empréstimos e parcelas
- `/agenda`: tarefas e eventos
- `/reports`: relatórios

## Redirecionamentos

- `/` redireciona para `/dashboard`
- usuário autenticado em `/login` é redirecionado para `/dashboard`

## Observações

- `ProtectedRoute` protege todas as rotas privadas.
- `Layout` é aplicado automaticamente nas rotas privadas.
- Atualmente não existe rota ativa de `/settings`.