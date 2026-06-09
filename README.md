# Taams Monorepo

A modern monorepo setup with Next.js frontend, Express API backend, and public site, all connected to PostgreSQL via Prisma.

## 🏗️ Project Structure

```
taams/
├── apps/
│   ├── frontend/          # Next.js app (port 3011)
│   ├── api/              # API server (port 3012)
│   └── public/           # Public marketing site (port 3002)
├── packages/
│   └── shared/           # Shared types and utilities
├── package.json          # Root workspace configuration
├── turbo.json           # Turborepo configuration
└── tsconfig.json        # Root TypeScript configuration
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- PostgreSQL database (Neon recommended)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Copy the example env file in the API app
cp apps/api/env.example apps/api/.env

# Update the following variables:
# - DATABASE_URL with your Neon PostgreSQL connection string
# - BETTER_AUTH_SECRET with a secure random string (32+ characters)
# - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for Google OAuth (optional)
```

3. Set up the database:
```bash
cd apps/api
npm run db:push
npm run db:generate
```

### Development

Start all applications in development mode:
```bash
npm run dev
```

This will start:
- Frontend: http://localhost:3011
- API: http://localhost:3012
- Public site: http://localhost:3002

### Individual App Commands

#### Frontend App
```bash
cd apps/frontend
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
```

#### API App
```bash
cd apps/api
npm run dev        # Start development server with hot reload
npm run build      # Build for production
npm run start      # Start production server
npm run db:studio  # Open Prisma Studio
```

#### Public Site
```bash
cd apps/public
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Mantine UI, Tailwind CSS
- **Backend**: Express.js, TypeScript, Prisma ORM
- **Database**: PostgreSQL (Neon)
- **Authentication**: Better Auth with email/password + Google OAuth
- **Monorepo**: Turborepo
- **Styling**: Mantine UI Components + Tailwind CSS
- **Icons**: Tabler Icons
- **Package Manager**: npm workspaces

## 📁 Apps Overview

### Frontend (`/apps/frontend`)
Main application interface built with Next.js, featuring:
- Mantine UI components for modern design
- Better Auth integration for authentication
- Protected dashboard and user management
- Notification system integration
- Responsive design with Grid system
- Tailwind CSS for custom styling

### API (`/apps/api`)
RESTful API server with Express.js, featuring:
- Better Auth for secure authentication
- Prisma ORM for database operations
- Protected API routes with middleware
- CORS and security middleware
- Health check endpoints
- Structured routing

### Public Site (`/apps/public`)
Marketing/landing page built with Next.js, featuring:
- Beautiful Mantine UI components
- Gradient text effects and modern design
- Tabler icons for visual elements
- Responsive grid layout

### Shared Package (`/packages/shared`)
Common types, utilities, and configurations shared across apps.

## 🗄️ Database

This project uses Prisma ORM with PostgreSQL. The schema includes example User and Post models.

To modify the database schema:
1. Edit `apps/api/prisma/schema.prisma`
2. Run `npm run db:push` to apply changes
3. Run `npm run db:generate` to update the Prisma client

## 🔐 Authentication

This project uses [Better Auth](https://www.better-auth.com/) for comprehensive authentication:

### Features
- **Email & Password Authentication**: Secure user registration and login
- **Google OAuth**: Sign in with Google accounts
- **Session Management**: Secure session handling with automatic refresh
- **Protected Routes**: API middleware for route protection
- **Type Safety**: Full TypeScript support across the auth flow

### Available Endpoints
- `POST /api/auth/sign-up` - User registration
- `POST /api/auth/sign-in` - User login
- `POST /api/auth/sign-out` - User logout
- `GET /api/auth/session` - Get current session
- `GET /api/auth/google` - Google OAuth login

### Frontend Usage
```typescript
import { signIn, signUp, signOut, useSession } from '@/lib/auth-client';

// Sign up new user
await signUp.email({ email, password, name });

// Sign in existing user
await signIn.email({ email, password });

// Sign in with Google
await signIn.social({ provider: 'google' });

// Get current session (React hook)
const { data: session, isPending } = useSession();

// Sign out
await signOut();
```

### Setting up Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3012/api/auth/callback/google` (development)
6. Copy Client ID and Client Secret to your `.env` file

## 🔧 Scripts

- `npm run dev` - Start all apps in development mode
- `npm run build` - Build all apps
- `npm run lint` - Lint all apps
- `npm run format` - Format code with Prettier
- `npm run clean` - Clean all build artifacts

## 🚀 Deployment

Each app can be deployed independently:

- **Frontend & Public**: Deploy to Vercel, Netlify, or similar
- **API**: Deploy to Railway, Render, Heroku, or similar
- **Database**: Use your Neon PostgreSQL instance

## 📝 Next Steps

1. Set up your Neon PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. Start implementing your first feature!

---

Built with ❤️ using modern web technologies.
