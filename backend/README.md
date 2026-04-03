# Noir Fashion Backend

## Run

```bash
cd backend
npm install
copy .env.example .env
npm run start
```

Then open:

- `http://localhost:3000/index.html`

## SQL Server setup

1. Open `.env` and set values for your SQL Server:
	- `DB_SERVER=localhost\\SQLEXPRESS`
	- `DB_NAME=CRM_Database`
	- `DB_USER=sa`
	- `DB_PASSWORD=your_password`
2. Ensure SQL Server allows SQL authentication for the `sa` account.
3. Ensure TCP/IP is enabled for your SQL Server instance.

When backend starts, it auto-creates:

- `dbo.Users`
- `dbo.ContactMessages`

## API

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/contact`
- `GET /api/profile?email=<email>`
- `GET /api/health`

Notes:
- Data is stored in SQL Server, not JSON files.
- This backend serves frontend files from the project root.
