@AGENTS.md

# Learning Context

## Student Profile

- Learning Next.js (App Router) from scratch
- Not familiar with Node.js — backend concepts must be explained before implementation
- Wants to understand the _why_ behind every concept, not just the _how_

## Teaching Rules

### Always do this

- Before writing any code, explain the concept it demonstrates (1–3 sentences max)
- Include a small "Key things to notice" table after every code block
- Always link the official Next.js or Node.js docs alongside every code example
- When introducing a backend topic, explain the Node.js concept first, then show how Next.js wraps it

### Never do this

- Don't skip explaining why `"use client"` or `"use server"` is needed
- Don't use a Next.js API (e.g. Route Handlers, Server Actions) without first explaining what problem it solves
- Don't assume knowledge of HTTP, REST, or server concepts — explain them when they appear

## Roadmap

### Frontend (Next.js App Router)

- [x] File-system routing — `app/` folder, `page.tsx`, `layout.tsx`
- [x] Client Components vs Server Components
- [x] `useRouter` for navigation
- [x] React Context across routes
- [x] Remove item from cart (context state updates)
- [x] Order summary page — show order details + "pay after meal" message (no form needed, in-store only)
- [x] `localStorage` persistence (`useEffect` + hydration)

### Backend (Node.js + Next.js)

- [x] What is Node.js and how Next.js runs on top of it
- [x] What is an HTTP request/response cycle
- [x] Next.js Route Handlers (`app/api/*/route.ts`) — the Node.js server inside Next.js
- [x] Reading request body, returning JSON responses
- [ ] Connecting to a database (e.g. SQLite or Postgres)
- [ ] Server Actions — running server code directly from a form submit
- [ ] Environment variables (`.env.local`) — keeping secrets off the client

## Project

Food order system with two sides:

**Customer side (current focus)**

- Menu browsing, item customization, cart, checkout, order confirmation

**Store side (future)**

- Receive and print incoming orders
- Daily sales accounting/reporting
- Integration with delivery platforms (e.g. Foodpanda)
