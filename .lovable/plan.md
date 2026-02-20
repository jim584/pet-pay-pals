
# PetCare Platform — Full MVP Plan

## Overview
A modern, bold-styled pet care platform connecting pet owners, veterinarians, and administrators. Built with Supabase for backend (auth, database, edge functions) and Stripe for payments with Klarna/Afterpay BNPL support.

---

## Phase 1: Foundation & Authentication

### User Registration & Login
- Email/password authentication via Supabase Auth
- Role-based access: **Pet Owner**, **Vet**, **Admin**
- After signup, users select their role (pet owner or vet); admins are assigned manually
- Profile creation flow tailored to each role

### Design System
- Modern & bold aesthetic: strong typography, gradients, dark accents
- Mobile-responsive throughout
- Sidebar navigation for dashboards

---

## Phase 2: Pet Owner Experience

### Pet Profiles
- Create/edit pet profiles with: name, breed, age, photo, weight
- Health records section: vaccination history, medical notes, allergies
- Emergency contacts per pet
- Multiple pets per owner

### Membership System
- Membership tiers (e.g., Basic, Premium) managed by admin
- Users can view, upgrade, downgrade, or cancel membership from their dashboard
- Membership status visible on profile

### Pet Owner Dashboard
- Overview of pets, upcoming appointments, payment history
- Notifications for payment reminders, appointment confirmations, membership renewals
- Quick actions: book consultation, make payment, manage pets

---

## Phase 3: Vet Experience

### Vet Profiles & Services
- Vets create profiles with: clinic name, specializations, location, contact info
- List services with pricing
- Manage availability for consultations

### Vet Dashboard
- View patient history (pets they've treated)
- Track upcoming appointments
- View and approve BNPL payment plans from pet owners
- Payment tracking: completed, pending, overdue

---

## Phase 4: Payments & BNPL

### Direct Payments via Stripe
- Pet owners pay vets directly for services
- Stripe Checkout integration for secure card payments
- Payment history for both owners and vets

### BNPL via Stripe (Klarna/Afterpay)
- Enable Klarna and Afterpay as payment methods in Stripe Checkout
- Pet owners can split payments over installments at checkout
- Vets see full payment amount; Stripe/Klarna handles installment collection
- Payment schedule visibility for pet owners

---

## Phase 5: Admin Dashboard

### User Management
- View/search all pet owners and vets
- Approve or decline vet registration requests
- Manage membership tiers and pricing

### Analytics Overview
- Total members, active users, new signups
- Payment summary: total revenue, pending payments, BNPL usage
- System health metrics

### Content Management
- Manage membership plans
- View and resolve flagged issues or disputes

---

## Phase 6: Notifications

### In-App Notifications
- Payment due reminders
- Appointment confirmations and reminders
- Membership renewal alerts
- Profile update confirmations

### Email Notifications (via Supabase Edge Functions)
- Key transactional emails: welcome, payment confirmation, appointment booking

---

## Database Structure (Supabase)
- **profiles** — linked to auth, stores name, avatar, contact info
- **user_roles** — separate role table (pet_owner, vet, admin)
- **pets** — pet profiles linked to owners
- **health_records** — vaccination, medical history per pet
- **emergency_contacts** — per pet
- **vet_profiles** — clinic details, specializations, services
- **services** — vet service listings with pricing
- **appointments** — bookings between owners and vets
- **memberships** — membership plans and user subscriptions
- **payments** — payment records linked to Stripe
- **notifications** — in-app notification storage

All tables will have proper RLS policies to ensure data security.
