# MemoFlow AI

### AI-Powered Personal Memory & Knowledge Workspace

MemoFlow AI is a personal project designed to bring notes, documents, voice memos, images, and web resources together in one organized workspace.

It helps users capture, manage, revisit, and interact with information using AI-powered tools, reducing the need to switch between multiple applications.

## Features

### Knowledge Capture & Organization
- **Notes & Persistent Memory:** Create, save, edit, and revisit notes.
- **Local File Uploads:** Upload documents and images directly from your device.
- **PDF & DOCX Processing:** Extract text from documents for further AI processing.
- **Image OCR:** Extract text from images and handwritten notes.
- **Voice Memos:** Upload and manage voice recordings with transcription and AI processing.
- **Web Content Extraction:** Capture content from supported web URLs and use it for summaries and knowledge management.
- **Collections & Tags:** Organize information into collections and categories.
- **Task Management:** Manage tasks within the workspace.

### AI-Powered Features
- **AI Memory Assistant:** Ask general questions and interact with previously captured knowledge.
- **Context-Grounded Retrieval:** Generate responses using relevant stored information.
- **AI Summaries:** Generate summaries, key takeaways, and action items.
- **AI-Generated Quizzes:** Create quizzes from content and review scores.
- **Content Processing:** Work with extracted text from documents, images, voice recordings, and web resources.

### Productivity & User Experience
- **Quick Search:** Search workspace content using `Ctrl + K`.
- **User Authentication:** Access a personal workspace through authentication.
- **Persistent Storage:** Store notes and uploaded content using Supabase.
- **Access Controls:** Use database Row Level Security (RLS) policies to manage data access.
- **Responsive Interface:** Navigate a modern, interactive workspace.

## Tech Stack

| Category | Technologies |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS, Framer Motion |
| Backend | Next.js API Routes |
| Database | Supabase PostgreSQL |
| Authentication & Storage | Supabase Auth, Supabase Storage |
| AI Integration | Google Gemini API |
| Document Processing | PDF Parse, Mammoth |
| OCR | Tesseract.js |
| Visualizations | Recharts |
| Icons | Lucide React |

## Project Structure

```text
MemoFlow-AI/
├── public/                 # Static assets
├── src/
│   ├── app/
│   │   ├── api/            # AI and content-processing API routes
│   │   └── ...             # Application pages and layouts
│   ├── components/         # Reusable UI components
│   ├── lib/
│   │   ├── services/       # Application services
│   │   └── supabase/       # Supabase integration
│   └── ...
├── supabase/
│   └── migrations/         # Database schema migrations
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js and npm
- A Supabase project
- Google Gemini API access

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/Yumna-Reham/MemoFlow-AI.git
cd MemoFlow-AI
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure environment variables**

Create a `.env.local` file in the project root and configure the required Supabase and Gemini environment variables according to the application's source code.

Never commit actual API keys, service-role keys, or other private credentials.

**4. Configure Supabase**

Set up the required database schema, storage, authentication, and access policies for your Supabase project.

**5. Start the development server**

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |

## Security & Privacy

MemoFlow AI uses Supabase authentication, storage, and database access policies.

- Local environment files are excluded from Git using `.gitignore`.
- Private credentials should be configured through environment variables.
- Database access policies and API authorization should be reviewed before public deployment.
- Users should avoid uploading confidential information to untrusted deployments.

## Project Status

Personal portfolio project. Core knowledge management and AI features have been implemented. Documentation and deployment configuration may continue to evolve.

## Author

Developed by [Yumna-Reham](https://github.com/Yumna-Reham).