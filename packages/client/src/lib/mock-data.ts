import type { PRInfo } from "@/types/pr"
import type { DiffFile } from "@/types/diff"
import type { ChangeGroup } from "@/types/grouping"
import type { AIReviewItem, ReviewComment } from "@/types/review"
import type { DiffFileData } from "@/components/diff-panel"

export const mockPR: PRInfo = {
  number: 42,
  title: "feat: Add AI-powered code review",
  author: { login: "octocat", avatarUrl: "https://github.com/octocat.png" },
  description: "This PR adds AI-powered code review functionality",
  baseBranch: "main",
  headBranch: "feature/ai-review",
  state: "open",
}

export const mockFileTree: DiffFile[] = [
  {
    path: "src/components/review-panel.tsx",
    status: "added",
    additions: 142,
    deletions: 0,
    hunks: [],
  },
  {
    path: "src/lib/ai-client.ts",
    status: "added",
    additions: 89,
    deletions: 0,
    hunks: [],
  },
  {
    path: "src/hooks/use-review.ts",
    status: "modified",
    additions: 23,
    deletions: 8,
    hunks: [],
  },
  {
    path: "src/types/review.ts",
    status: "modified",
    additions: 15,
    deletions: 3,
    hunks: [],
  },
  {
    path: "src/legacy/old-review.ts",
    status: "deleted",
    additions: 0,
    deletions: 156,
    hunks: [],
  },
  {
    path: "src/utils/helpers.ts",
    oldPath: "src/lib/helpers.ts",
    status: "renamed",
    additions: 2,
    deletions: 1,
    hunks: [],
  },
]

export const mockChangeGroups: ChangeGroup[] = [
  {
    id: "1",
    title: "AI Review Feature",
    summary:
      "Core AI-powered code review functionality including the review panel component and AI client integration.",
    files: ["src/components/review-panel.tsx", "src/lib/ai-client.ts"],
    totalAdditions: 231,
    totalDeletions: 0,
    riskLevel: "medium",
    riskReason: "New feature with AI integration",
  },
  {
    id: "2",
    title: "Review Hook Improvements",
    summary:
      "Enhanced useReview hook with TypeScript types and callback support.",
    files: ["src/hooks/use-review.ts", "src/types/review.ts"],
    totalAdditions: 38,
    totalDeletions: 11,
    riskLevel: "low",
    riskReason: "Type improvements and refactoring",
  },
  {
    id: "3",
    title: "Code Cleanup",
    summary: "Removed legacy review module and reorganized utility helpers.",
    files: ["src/legacy/old-review.ts", "src/utils/helpers.ts"],
    totalAdditions: 2,
    totalDeletions: 157,
    riskLevel: "low",
    riskReason: "Legacy code removal",
  },
  {
    id: "4",
    title: "Authentication System",
    summary: "New JWT-based authentication with refresh token support and session management.",
    files: ["src/auth/jwt-handler.ts", "src/auth/session.ts"],
    totalAdditions: 189,
    totalDeletions: 12,
    riskLevel: "high",
    riskReason: "Core authentication and security changes",
  },
  {
    id: "5",
    title: "Database Migrations",
    summary: "Schema updates for user preferences and review history tables.",
    files: ["src/db/migrations/001-users.sql", "src/db/migrations/002-reviews.sql"],
    totalAdditions: 87,
    totalDeletions: 0,
    riskLevel: "high",
    riskReason: "Database schema changes",
  },
  {
    id: "6",
    title: "API Endpoints",
    summary: "RESTful endpoints for review CRUD operations and user management.",
    files: ["src/api/reviews.ts", "src/api/users.ts", "src/api/middleware.ts"],
    totalAdditions: 312,
    totalDeletions: 45,
    riskLevel: "medium",
    riskReason: "API endpoint changes",
  },
  {
    id: "7",
    title: "UI Components",
    summary: "New reusable UI components including buttons, modals, and form elements.",
    files: ["src/components/ui/button.tsx", "src/components/ui/modal.tsx"],
    totalAdditions: 156,
    totalDeletions: 8,
    riskLevel: "low",
    riskReason: "UI component additions",
  },
  {
    id: "8",
    title: "Testing Infrastructure",
    summary: "Unit and integration test setup with Jest and React Testing Library.",
    files: ["src/tests/setup.ts", "src/tests/utils.ts"],
    totalAdditions: 98,
    totalDeletions: 0,
    riskLevel: "low",
    riskReason: "Test infrastructure only",
  },
  {
    id: "9",
    title: "Configuration Updates",
    summary: "Environment configuration and build tooling improvements.",
    files: ["config/webpack.config.js", "config/env.ts"],
    totalAdditions: 45,
    totalDeletions: 23,
    riskLevel: "medium",
    riskReason: "Build configuration changes",
  },
  {
    id: "10",
    title: "Documentation",
    summary: "API documentation and developer onboarding guides.",
    files: ["docs/api.md", "docs/getting-started.md", "docs/contributing.md"],
    totalAdditions: 234,
    totalDeletions: 12,
    riskLevel: "low",
    riskReason: "Documentation only",
  },
]

export const mockAIReviewItems: AIReviewItem[] = [
  {
    id: "1",
    filePath: "src/lib/ai-client.ts",
    lineNumber: 45,
    severity: "critical",
    message: "API key is hardcoded in the source code",
    suggestion: "Use environment variables to store sensitive credentials",
    categories: ["security"],
  },
  {
    id: "2",
    filePath: "src/hooks/use-review.ts",
    lineNumber: 12,
    severity: "warning",
    message: "Missing error handling for async operations",
    suggestion: "Add try-catch block and error state management",
    categories: ["code-quality"],
  },
  {
    id: "3",
    filePath: "src/components/review-panel.tsx",
    lineNumber: 8,
    severity: "info",
    message: "Consider memoizing this component for better performance",
    categories: ["performance"],
  },
  {
    id: "4",
    filePath: "src/hooks/use-review.ts",
    lineNumber: 5,
    severity: "warning",
    message: "Dependency array may be missing dependencies",
    categories: ["code-quality"],
  },
  {
    id: "5",
    filePath: "src/auth/jwt-handler.ts",
    lineNumber: 23,
    severity: "critical",
    message: "JWT secret should not be committed to version control",
    suggestion: "Move JWT_SECRET to environment variables and add to .gitignore",
    categories: ["security"],
  },
  {
    id: "6",
    filePath: "src/auth/jwt-handler.ts",
    lineNumber: 67,
    severity: "warning",
    message: "Token expiration is set to 30 days which may be too long",
    suggestion: "Consider using shorter expiration with refresh tokens",
    categories: ["security", "api-design"],
  },
  {
    id: "7",
    filePath: "src/auth/session.ts",
    lineNumber: 15,
    severity: "warning",
    message: "Session data is stored in memory, will be lost on restart",
    suggestion: "Use Redis or database for session persistence",
    categories: ["architecture"],
  },
  {
    id: "8",
    filePath: "src/api/reviews.ts",
    lineNumber: 34,
    severity: "critical",
    message: "SQL injection vulnerability in query parameter",
    suggestion: "Use parameterized queries or an ORM",
    categories: ["security"],
  },
  {
    id: "9",
    filePath: "src/api/reviews.ts",
    lineNumber: 89,
    severity: "warning",
    message: "Missing rate limiting on this endpoint",
    suggestion: "Add rate limiting middleware to prevent abuse",
    categories: ["security", "api-design"],
  },
  {
    id: "10",
    filePath: "src/api/users.ts",
    lineNumber: 12,
    severity: "info",
    message: "Consider adding request validation middleware",
    categories: ["api-design"],
  },
  {
    id: "11",
    filePath: "src/api/users.ts",
    lineNumber: 56,
    severity: "warning",
    message: "Password is logged in debug mode",
    suggestion: "Remove sensitive data from logs",
    categories: ["security"],
  },
  {
    id: "12",
    filePath: "src/components/ui/button.tsx",
    lineNumber: 8,
    severity: "info",
    message: "Missing aria-label for icon-only button variant",
    categories: ["accessibility"],
  },
  {
    id: "13",
    filePath: "src/components/ui/modal.tsx",
    lineNumber: 24,
    severity: "warning",
    message: "Focus trap not implemented for modal",
    suggestion: "Use a focus trap library or implement focus management",
    categories: ["accessibility"],
  },
  {
    id: "14",
    filePath: "src/db/migrations/001-users.sql",
    lineNumber: 5,
    severity: "info",
    message: "Consider adding an index on email column for faster lookups",
    categories: ["performance"],
  },
  {
    id: "15",
    filePath: "src/tests/setup.ts",
    lineNumber: 18,
    severity: "info",
    message: "Mock implementations could be more comprehensive",
    categories: ["testing"],
  },
]

export const mockComments: ReviewComment[] = [
  {
    id: "comment-1",
    filePath: "src/components/review-panel.tsx",
    lineNumber: 4,
    side: "additions",
    content: "Consider adding prop types for better documentation and type safety.",
    author: { type: "ai", name: "AI Assistant" },
    severity: "info",
    createdAt: new Date("2024-01-15T10:30:00Z"),
    replies: [
      {
        id: "comment-1-reply-1",
        filePath: "src/components/review-panel.tsx",
        lineNumber: 4,
        side: "additions",
        content: "Good point! I'll add TypeScript interface for the props.",
        author: { type: "human", name: "octocat" },
        createdAt: new Date("2024-01-15T10:35:00Z"),
        replies: [],
      },
    ],
  },
  {
    id: "comment-2",
    filePath: "src/hooks/use-review.ts",
    lineNumber: 6,
    side: "additions",
    content: "The useState generic type is correctly applied here. Nice TypeScript usage!",
    author: { type: "human", name: "reviewer123" },
    createdAt: new Date("2024-01-15T11:00:00Z"),
    replies: [],
  },
  {
    id: "comment-3",
    filePath: "src/hooks/use-review.ts",
    lineNumber: 8,
    side: "deletions",
    content: "This callback could cause memory leaks if the component unmounts during an async operation. Consider adding cleanup logic.",
    author: { type: "ai", name: "AI Assistant" },
    severity: "warning",
    createdAt: new Date("2024-01-15T11:15:00Z"),
    replies: [],
  },
]

export const mockDiffFiles: DiffFileData[] = [
  {
    path: "src/components/review-panel.tsx",
    status: "added",
    additions: 5,
    deletions: 0,
    oldContent: "",
    newContent: `import React from 'react';

export function ReviewPanel() {
  return <div className="review-panel">Review Panel</div>;
}`,
  },
  {
    path: "src/hooks/use-review.ts",
    status: "modified",
    additions: 3,
    deletions: 2,
    oldContent: `import { useState } from 'react';

export function useReview() {
  const [reviews, setReviews] = useState([]);
  return { reviews };
}`,
    newContent: `import { useState, useCallback } from 'react';
import type { Review } from '../types';

export function useReview() {
  const [reviews, setReviews] = useState<Review[]>([]);
  
  const addReview = useCallback((review: Review) => {
    setReviews((prev) => [...prev, review]);
  }, []);

  return { reviews, addReview };
}`,
  },
  {
    path: "src/legacy/old-review.ts",
    status: "deleted",
    additions: 0,
    deletions: 3,
    oldContent: `// Legacy review module
export const legacyReview = () => {};
export default legacyReview;`,
    newContent: "",
  },
  {
    path: "src/auth/jwt-handler.ts",
    status: "added",
    additions: 45,
    deletions: 0,
    oldContent: "",
    newContent: `import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const TOKEN_EXPIRY = '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

export function refreshToken(token: string): string | null {
  const payload = verifyToken(token);
  if (!payload) return null;
  
  const { userId, email, role } = payload;
  return generateToken({ userId, email, role });
}

export function decodeToken(token: string): TokenPayload | null {
  try {
    return jwt.decode(token) as TokenPayload;
  } catch {
    return null;
  }
}`,
  },
  {
    path: "src/auth/session.ts",
    status: "added",
    additions: 38,
    deletions: 0,
    oldContent: "",
    newContent: `import { v4 as uuidv4 } from 'uuid';

interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  data: Record<string, unknown>;
}

const sessions = new Map<string, Session>();

export function createSession(userId: string, ttlMs = 3600000): Session {
  const session: Session = {
    id: uuidv4(),
    userId,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + ttlMs),
    data: {},
  };
  
  sessions.set(session.id, session);
  return session;
}

export function getSession(sessionId: string): Session | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  
  if (new Date() > session.expiresAt) {
    sessions.delete(sessionId);
    return null;
  }
  
  return session;
}

export function destroySession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}`,
  },
  {
    path: "src/api/reviews.ts",
    status: "added",
    additions: 67,
    deletions: 0,
    oldContent: "",
    newContent: `import { Router } from 'express';
import { db } from '../db';
import { verifyToken } from '../auth/jwt-handler';

const router = Router();

interface Review {
  id: string;
  title: string;
  content: string;
  rating: number;
  authorId: string;
  createdAt: Date;
}

router.get('/', async (req, res) => {
  try {
    const reviews = await db.query('SELECT * FROM reviews ORDER BY created_at DESC');
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const review = await db.query('SELECT * FROM reviews WHERE id = $1', [id]);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

router.post('/', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const payload = verifyToken(token || '');
  
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { title, content, rating } = req.body;
  
  try {
    const review = await db.query(
      'INSERT INTO reviews (title, content, rating, author_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [title, content, rating, payload.userId]
    );
    res.status(201).json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create review' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM reviews WHERE id = $1', [id]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

export default router;`,
  },
  {
    path: "src/api/users.ts",
    status: "added",
    additions: 52,
    deletions: 0,
    oldContent: "",
    newContent: `import { Router } from 'express';
import { db } from '../db';
import { hashPassword, comparePassword } from '../utils/crypto';
import { generateToken } from '../auth/jwt-handler';

const router = Router();

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  
  try {
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    const hashedPassword = await hashPassword(password);
    const user = await db.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hashedPassword, name]
    );
    
    const token = generateToken({ userId: user.id, email: user.email, role: 'user' });
    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken({ userId: user.id, email: user.email, role: user.role });
    res.json({ user: { id: user.id, email: user.email, name: user.name }, token });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', async (req, res) => {
  // Get current user profile
  res.json({ message: 'Profile endpoint' });
});

export default router;`,
  },
  {
    path: "src/components/ui/button.tsx",
    status: "added",
    additions: 42,
    deletions: 0,
    oldContent: "",
    newContent: `import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };`,
  },
  {
    path: "src/components/ui/modal.tsx",
    status: "added",
    additions: 58,
    deletions: 0,
    oldContent: "",
    newContent: `import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);
  
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };
  
  if (!isOpen) return null;
  
  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={cn(
          'w-full max-w-md rounded-lg bg-background p-6 shadow-lg',
          className
        )}
      >
        {title && (
          <h2 id="modal-title" className="mb-4 text-lg font-semibold">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}`,
  },
  {
    path: "src/db/migrations/001-users.sql",
    status: "added",
    additions: 18,
    deletions: 0,
    oldContent: "",
    newContent: `-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();`,
  },
  {
    path: "src/tests/setup.ts",
    status: "added",
    additions: 25,
    deletions: 0,
    oldContent: "",
    newContent: `import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));`,
  },
]
