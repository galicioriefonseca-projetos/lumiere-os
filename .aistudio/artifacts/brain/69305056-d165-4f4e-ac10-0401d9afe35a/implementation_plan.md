# Plano de Implementação: Gestão Adaptativa LumièreOS

## Objetivo
Transformar o LumièreOS em uma plataforma de gestão adaptável, que se molda automaticamente para atender desde profissionais liberais (agilidade e simplicidade) até empresas com estruturas complexas (métricas avançadas e hierarquia).

## Fases de Implementação

### Fase 1: Módulo de Configuração de "Modo de Gestão"
*   **Settings Hub:** Criar uma nova área de configuração em `src/pages/dashboard/SettingsPage.tsx` para o dono da empresa selecionar seu "Modo de Gestão" (Simples/Liberal vs. Completo/Empresa).
*   **Persistência:** Atualizar o Firestore `salons` para armazenar a preferência de modo (`simple` ou `advanced`).

### Fase 2: Adaptação Dinâmica de Interface (UI)
*   **Navigation Factory:** Refatorar `src/components/layouts/dashboard/getNavigationByRole.ts` para cruzar o `role` do usuário com o `modo de gestão` definido pelo dono.
*   **Dashboard Condicional:** Criar layouts adaptáveis para o `DashboardHome.tsx`. Modo Simples foca em agenda/financeiro; Modo Empresa adiciona widgets de metas, performance da equipe e comissões.

### Fase 3: Escalabilidade de Métricas
*   **Métricas Escaláveis:** Desenvolver componentes de dashboard que detectam o modo de gestão para exibir dados (ex: Modo Simples mostra total de vendas; Modo Empresa mostra DRE, comissões acumuladas e métricas por profissional).
*   **Customização Modular:** Permitir que o dono, no modo avançado, escolha quais módulos (comissões, estoque, gamificação) deseja ativar ou ocultar.

## Impacto Técnico
*   `AuthContext`: Adicionar o estado `managementMode` para fácil acesso em toda a aplicação.
*   `Firestore`: Atualizar schema de `salons` para incluir a preferência de modo de gestão.
*   `DashboardLayout`: Atualizar lógica para renderizar dinamicamente a sidebar e as páginas permitidas.

## Cronograma
1.  Configuração e Banco (2 dias)
2.  Refatoração de Navegação e Layout (3 dias)
3.  Adaptação de Dashboards e Métricas (4 dias)
4.  Testes e Refinamento de UX (2 dias)
