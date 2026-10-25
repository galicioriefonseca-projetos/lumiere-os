# Plano & Arquitetura: Configuração de Contexto & Vocabulário Adaptativo (LumièreOS)

## Objetivo
Implementar o serviço de **Configuração de Contexto**, permitindo que o LumièreOS reconheça o nicho do negócio ao cadastrar ou finalizar o onboarding (`salão`, `clínica`, `estúdio`, `freelancer`, `agência`, `consultoria`), salvando as preferências no Firestore e adaptando dinamicamente a interface e o vocabulário (ex: "cliente" vs "paciente", "cadeira" vs "sala / consultório", "comanda" vs "prontuário").

---

## 1. Estrutura de Tipos & Schemas (`src/types/index.ts`)
- **`NicheType`**: `'salon' | 'clinic' | 'studio' | 'freelancer' | 'agency' | 'consulting'`.
- **`VocabularyConfig`**:
  - `clientTerm` / `clientTermPlural` (ex: Cliente vs Paciente vs Contratante)
  - `workstationTerm` / `workstationTermPlural` (ex: Cadeira vs Sala / Consultório vs Estação vs Meu Espaço)
  - `professionalTerm` / `professionalTermPlural` (ex: Profissional vs Especialista vs Artista vs Consultor)
  - `serviceTerm` / `serviceTermPlural` (ex: Serviço vs Consulta vs Sessão vs Trabalho)
  - `flowItemTerm` / `flowItemTermPlural` (ex: Comanda vs Prontuário vs Ordem de Serviço vs Proposta)
  - `workplaceTerm` / `workplaceTermPlural` (ex: Salão vs Clínica vs Estúdio vs Escritório)
- **`UiPreferences`**: Preferências de visualização (ex: visão de fluxo vs calendário, badges, comissões, portal do cliente).
- **`ContextConfig`**: Armazenado diretamente no documento do tenant `salons/{salonId}.contextConfig`.

---

## 2. Backend & Rotas Express (`server/routes/contextConfig.ts`)
- `GET /api/context-config`: Consulta as configurações de contexto e vocabulário do salão autenticado.
- `GET /api/context-config/templates`: Retorna os modelos pré-definidos para cada nicho.
- `POST /api/context-config/initialize`: Executado ao concluir o onboarding para persistir o nicho, configurar módulos padrões e salvar no Firestore.
- `PUT /api/context-config`: Permite alterações manuais de termos e preferências de UI.

---

## 3. Serviços e Hooks Frontend
- **`src/services/contextConfigService.ts`**: Cliente HTTP autenticado com Firebase Bearer Token.
- **`src/hooks/useLexicon.ts`**: Hook unificado que integra `salonData.contextConfig` com fallback inteligente, expondo termos diretos (`clientTerm`, `workstationTerm`, `flowItemTerm`, etc.) e flags (`isClinic`, `isStudio`, `isFreelancer`, `isBeauty`, etc.).
- **`src/hooks/useLumiLexicon.ts`**: Sincronizado para garantir uniformidade em todos os componentes legados e novos.

---

## 4. Integração no Onboarding (`src/pages/onboarding/OnboardingSetupHub.tsx`)
- Seletor visual interativo com os 4 nichos principais (Salão, Clínica, Estúdio, Freelancer) e pré-seleção automática.
- Visualização instantânea das terminologias correspondentes.
- Persistência automática no Firestore ao salvar e no botão final "Acessar Painel Principal".

---

## 5. Adaptação Dinâmica nas Telas do Dashboard
- **`AppointmentsPage.tsx`**:
  - Detecção da aba padrão (fluxo de comandas para salões; agenda/calendário para clínicas, estúdios e freelancers).
  - Acolhimento dinâmico na estação ("Acolher no(a) Cadeira", "No(a) Sala / Consultório", "No(a) Estação").
  - Termos de clientes e fluxo adaptados ("Check-In de paciente/cliente", "Abrir Prontuário/Comanda").
- **`ClientsPage.tsx`**: Títulos e cabeçalhos refletindo "Pacientes", "Clientes & Contas" ou "Contratantes".
- **`DashboardHome.tsx`**: Ícones de ação rápida (Scissors vs Activity vs Briefcase) e atalhos customizados.
