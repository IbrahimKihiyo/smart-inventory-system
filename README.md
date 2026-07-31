# Smart Inventory and Decision Support System

A mobile application for small retail businesses. It manages products, stock and
sales, and adds decision support: expiry alerts, a buying advisor, and credit
reminders. The interface works in English and Kiswahili.

## Structure

- `backend/` — the API server (Laravel, PostgreSQL)
- `frontend/` — the mobile and web application (React Native, Expo)

## Requirements

- PHP 8.3 or later, Composer
- PostgreSQL 14 or later
- Node.js 18 or later
- Expo Go on a phone (for the mobile version)

## Running the backend

```bash
cd backend
composer install
cp .env.example .env          # then fill in the values, especially DB_PASSWORD
php artisan key:generate
php artisan migrate --database=landlord --path=database/migrations/landlord
php artisan storage:link
php artisan serve --host=0.0.0.0 --port=8000
```

## Running the application

```bash
cd frontend
npm install
npx expo start --lan          # scan the QR code with Expo Go
```

For the browser version, run `npx expo start --web` and open `http://localhost:8081`.

## Main features

- Product and stock management, with photographs and units of measure
- Sales by cash, credit, and mobile money (PawaPay)
- Expiry detection and alerts for goods nearing their expiry date
- Buying Advisor: recommends whether to restock based on recent purchase prices
- Credit tracking with partial repayment and reminders for overdue debts
- Selling price suggestions from the buying cost
- English and Kiswahili interface, including the PDF report
- Each business keeps its own isolated data (multi-tenant)

## Notes

- Environment files (`.env`) are not committed. Copy `backend/.env.example` to
  `backend/.env` and provide your own values.
- The PDF report renders through a headless Chrome or Edge browser.
