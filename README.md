# SIVACAD - paquete ejecutable

## Estructura
- `backend/`: API Node.js + Express + MySQL
- `frontend/`: React + Vite
- `database/`: SQL base

## Ejecución
### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Importa `database/sivacad_isc.sql` en MySQL/XAMPP.
