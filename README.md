# Monitor IA — Plataforma de Estudos Gamificada para Concurso

> 🚀 Plataforma web full-stack com IA para preparação de concursos públicos. Ciclo de aprendizado em 3 etapas, gamificação completa, análise de provas e busca em fontes confiáveis.

## 📋 Stack

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 14 + TypeScript |
| Backend | Node.js + Express |
| Banco de dados | SQLite (via better-sqlite3) |
| IA | OpenAI GPT-4o |
| Busca Web | Serper API + web scraping |
| PDF | pdf-parse |

---

## ⚡ Setup Rápido

### 1. Clonar/acessar o projeto

```bash
cd c:/git/monitor-ia
```

### 2. Configurar variáveis de ambiente do backend

```bash
cd backend
copy .env.example .env
```

Edite o arquivo `backend/.env` e adicione suas chaves:

```env
OPENAI_API_KEY=sk-...           # Obtenha em platform.openai.com
SERPER_API_KEY=...              # Obtenha em serper.dev (opcional)
EXAM_DATE=2026-10-19            # Data do seu concurso
```

> ⚠️ Sem a `OPENAI_API_KEY`, o sistema funciona em **modo demonstração** com conteúdo mockado.

### 3. Instalar dependências do backend

```bash
cd backend
npm install
```

### 4. Instalar dependências do frontend

```bash
cd ../frontend
npm install
```

### 5. Iniciar os servidores

**Backend** (porta 3001):
```bash
cd backend
npm run dev
```

**Frontend** (porta 3000) — em outro terminal:
```bash
cd frontend
npm run dev
```

### 6. Acessar a aplicação

Abra no navegador: **http://localhost:3000**

---

## 📁 Estrutura do Projeto

```
monitor-ia/
├── backend/
│   ├── .env.example            # Template de variáveis de ambiente
│   ├── package.json
│   └── src/
│       ├── server.js           # Servidor Express principal
│       ├── db/
│       │   └── database.js     # SQLite + schema completo
│       ├── routes/
│       │   ├── ai.js           # Geração de conteúdo (pre-reading, questões)
│       │   ├── documents.js    # Upload e processamento de PDFs
│       │   ├── sessions.js     # Sessões de estudo + gamificação
│       │   ├── search.js       # Busca web + scraping
│       │   └── gamification.js # Perfil, XP, badges, calendário
│       └── services/
│           ├── openai.service.js   # GPT-4o integração
│           ├── pdf.service.js      # Extração de texto PDF
│           ├── search.service.js   # Serper API + scraping
│           └── calendar.service.js # Dias úteis, feriados
├── frontend/
│   ├── package.json
│   ├── next.config.js          # Proxy para backend
│   └── src/
│       ├── app/
│       │   ├── globals.css     # Design system completo
│       │   ├── layout.tsx      # Root layout (Inter font)
│       │   ├── page.tsx        # 🏠 Dashboard
│       │   ├── study/          # 📚 Sessão de estudo (3 fases)
│       │   ├── calendar/       # 📅 Calendário inteligente
│       │   ├── upload/         # 📁 Upload de documentos
│       │   ├── stats/          # 📊 Estatísticas + busca web
│       │   └── settings/       # ⚙️ Configurações
│       ├── components/
│       │   └── Sidebar.tsx     # Navegação lateral
│       └── lib/
│           └── api.ts          # Cliente API tipado
└── README.md
```

---

## 🎮 Funcionalidades

### 📚 Ciclo de Estudo em 3 Etapas
1. **Pré-leitura** — Conteúdo gerado por IA (≤5 min), otimizado para concurso
2. **Questões** — 10 questões estilo banca, priorizando padrões das provas anexadas
3. **Correção Ativa** — Revisão dos erros com explicações detalhadas por IA

### 🎯 Gamificação
| Ação | XP |
|------|-----|
| Completar sessão | +100 XP |
| Acerto em questão | +10 XP |
| Sessão perfeita | +200 XP |
| Upload de documento | +20 XP |

- **Streak**: Conta dias consecutivos de estudo
- **Níveis**: A cada 500 XP sobe de nível
- **Badges**: Conquistas por marcos (primeira sessão, 7 dias seguidos, etc.)

### 📅 Calendário Inteligente
- Conta apenas **dias úteis** até o concurso (exclui fins de semana e feriados nacionais de 2026)
- Visualização mensal com destaque para dias estudados e data do concurso

### 📁 Upload de Documentos
- **PDFs de provas** (p1, p2): Extraídos e indexados para análise de padrões
- **Gabaritos** (g1, g2): Usados para cruzar com análise de provas
- **Edital**: Conteúdo programático como base para geração de questões
- **Material de apoio**: Artigos, resumos, anotações

### 🔍 Busca em Fontes Confiáveis
- Busca via **Serper API** (Google Search com foco em fontes jurídicas)
- Sites prioritários: planalto.gov.br, lexml.gov.br
- Buscas rápidas pré-configuradas para LGPD, ISO 27001, Marco Civil

---

## 🔑 APIs Necessárias

| API | Uso | Link |
|-----|-----|------|
| OpenAI (obrigatória) | Geração de conteúdo, questões, análise | [platform.openai.com](https://platform.openai.com/api-keys) |
| Serper (opcional) | Busca web integrada | [serper.dev](https://serper.dev) |

---

## 📊 Disciplinas Suportadas

| Disciplina | Emoji | Cor |
|------------|-------|-----|
| Legislação (LGPD, ISO 27001/27002) | ⚖️ | Indigo |
| Lógica Proposicional | 🧠 | Verde |
| Matemática | 📐 | Laranja |
| Informática | 💻 | Azul |
| Português | 📖 | Rosa |

---

## 🛠️ Solução de Problemas

**Backend não inicia:**
```bash
cd backend && npm install
```

**Frontend não conecta ao backend:**
- Certifique-se que o backend está rodando em `localhost:3001`
- O Next.js usa proxy automático configurado no `next.config.js`

**Erro de permissão de arquivo (Windows):**
```bash
# Execute o PowerShell como Administrador se necessário
```

**SQLite erro:**
```bash
cd backend
mkdir data   # Cria pasta do banco se não existir
npm run dev
```
