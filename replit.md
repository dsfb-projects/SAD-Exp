# CargoFleet — Distribuição de Carga

Sistema web para distribuição automática de produtos em frotas de caminhões.

## Stack
- **Frontend**: React + Vite (TypeScript) — porta 5000
- **Backend**: Python Flask — porta 5001
- **Database**: PostgreSQL (Replit built-in)

## Arquitetura
- `frontend/` — interface React com Vite
- `backend/app.py` — API Flask com toda lógica de alocação
- Vite faz proxy de `/api` para Flask em localhost:5001

## Funcionalidades
- Cadastro de produtos (código, dimensões, peso, empilhável)
- Cadastro de frotas (carretas com área base)
- Cadastro de pedidos de venda
- Importação via Excel (produtos e pedidos)
- Calculadora de carga — distribui produtos nas carretas respeitando área de piso e peso

## User preferences
- Interface em português brasileiro
- Tema escuro
