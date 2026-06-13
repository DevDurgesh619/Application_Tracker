# Application_Tracker

A college-application tracking dashboard built for counsellors — turn a student's
application spreadsheet into a clean, clickable web app. Every university acts as a
**master record**: click a school and instantly see its deadlines, costs, SAT stats,
essays, interviews, links, counsellor notes, and a field-by-field data-verification
audit aggregated into one profile.

## Features

- **Overview** — portfolio balance, upcoming deadlines, cost snapshots, data-trust strip
- **Universities** — searchable / filterable grid by tier and country
- **University Detail** — the master profile aggregating every data source for one school
- **Essay Tracker** — shared-essay mapping (write once, reuse across schools), progress + word budget
- **Interview Tracker** — required vs optional, prep status
- **Cost Analysis** — stacked tuition / living / other charts, sortable, full table (₹ Lakh)
- **Activities & Honors** — Common App activity + honor limits flagged
- **Deadline Calendar** — real parsed dates with a live countdown to each deadline
- **Compare** — up to 5 schools side by side across every field
- **Data Verification** — 80 figures cross-checked against official university sources,
  showing tracker-value vs verified-value with source links

## Tech stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/)
- [React Router](https://reactrouter.com/) (HashRouter)
- [Tailwind CSS](https://tailwindcss.com/)
- [Recharts](https://recharts.org/) for charts
- [lucide-react](https://lucide.dev/) for icons

## Getting started

```bash
cd dashboard
npm install
npm run dev      # http://localhost:5173
```

Build for production:

```bash
npm run build
npm run preview
```

## Data pipeline

The app is driven by `dashboard/src/data/master.json`, generated from the source
Excel tracker by `dashboard/scripts/extract_excel.py` (joins all sheets by university
name). Re-run it after the spreadsheet changes:

```bash
python3 dashboard/scripts/extract_excel.py
```

## Author

**DevDurgesh**
