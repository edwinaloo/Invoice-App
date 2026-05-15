# InvoiceApp

A full-stack invoice and billing application built with React + TypeScript (frontend) and Flask + PostgreSQL (backend). Features client management, invoice CRUD, status tracking, and PDF export.

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router v6, React Hook Form |
| Backend | Python 3, Flask, SQLAlchemy, Flask-Migrate |
| Database | PostgreSQL |
| PDF | ReportLab |
| Payments | Stripe *(coming soon)* |

## Project Structure

```
Invoice App/
├── backend/
│   ├── app/
│   │   ├── models/        # Client, Invoice, InvoiceItem
│   │   ├── routes/        # clients, invoices, dashboard blueprints
│   │   └── utils/         # PDF generator
│   ├── requirements.txt
│   └── run.py
└── frontend/
    ├── src/
    │   ├── api/           # Axios API calls
    │   ├── components/    # Layout, Sidebar, StatCard, StatusBadge
    │   ├── pages/         # Dashboard, Invoices, InvoiceDetail, InvoiceForm, Clients
    │   └── types/         # TypeScript interfaces
    └── package.json
```

## Quick Start

### 1. Install PostgreSQL

```bash
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 2. Create the database

```bash
sudo -u postgres psql -c "CREATE DATABASE invoice_app;"
# Optional: set a password for the postgres user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
```

### 3. Backend setup

```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env if your DB credentials differ

# Run migrations
flask --app run db init
flask --app run db migrate -m "initial"
flask --app run db upgrade

# Start the API server (runs on port 5000)
python run.py
```

### 4. Frontend setup

```bash
cd frontend
npm install
npm run dev   # runs on http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/dashboard/stats | Dashboard KPIs |
| GET | /api/clients | List all clients |
| POST | /api/clients | Create client |
| PUT | /api/clients/:id | Update client |
| DELETE | /api/clients/:id | Delete client |
| GET | /api/invoices | List invoices (optional ?status=) |
| POST | /api/invoices | Create invoice |
| GET | /api/invoices/:id | Invoice detail with items |
| PUT | /api/invoices/:id | Update invoice |
| PATCH | /api/invoices/:id/status | Update status only |
| DELETE | /api/invoices/:id | Delete invoice |
| GET | /api/invoices/:id/pdf | Download PDF |

## Invoice Statuses

`draft` → `sent` → `paid` or `overdue`

## Adding Stripe (next step)

1. `pip install stripe`
2. Add `STRIPE_SECRET_KEY` to `.env`
3. Add a `/api/invoices/:id/payment-link` endpoint that creates a Stripe Payment Link
4. Add `VITE_STRIPE_PUBLISHABLE_KEY` to `frontend/.env` for the hosted checkout
