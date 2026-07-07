# Wolves Security - Multi-Tenant Security Management Platform

A comprehensive Progressive Web Application (PWA) for security guard companies and estates, featuring real-time monitoring, patrol management, and incident reporting.

## 🚀 Features

### Core Functionality
- **Multi-tenant architecture** with complete data isolation
- **Role-based access control** (Guard, Supervisor, Client, Admin)
- **Real-time patrol check-ins** via GPS and QR code scanning
- **Incident management** with photo uploads and status workflows
- **SOS/Emergency alerts** with instant notifications
- **Live dashboard** with guard tracking and activity feeds
- **Comprehensive reporting** with PDF/CSV export capabilities
- **Progressive Web App** with offline support

### Technical Features
- **Firebase Backend** (Auth, Firestore, Cloud Functions, Storage, FCM)
- **Real-time updates** using Firestore listeners
- **MapLibre integration** with Google Maps fallback
- **QR code generation** for patrol points
- **Push notifications** for critical events
- **Offline functionality** for core guard features
- **Mobile-first responsive design**

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Zustand** for state management
- **React Query** for data fetching
- **Wouter** for routing

### Backend Stack
- **Firebase Authentication** (Email/Password + Magic Link)
- **Cloud Firestore** for data storage
- **Cloud Functions** for business logic
- **Firebase Storage** for file uploads
- **Firebase Cloud Messaging** for push notifications

### Security
- **Multi-tenant data isolation** via tenantId
- **Comprehensive Firestore security rules**
- **Role-based access control** at database level
- **Custom claims** for user roles and tenant assignment

## 📋 Prerequisites

- Node.js 18+
- Firebase CLI
- A Firebase project with the following services enabled:
  - Authentication
  - Cloud Firestore
  - Cloud Functions
  - Cloud Storage
  - Cloud Messaging

## ⚡ Quick Start

### 1. Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)

2. Enable the following services:
   - **Authentication**: Enable Email/Password and Email Link providers
   - **Cloud Firestore**: Create database in production mode
   - **Cloud Storage**: Create default bucket
   - **Cloud Functions**: Enable billing (required for external API calls)
   - **Cloud Messaging**: Enable for push notifications

3. Create a web app in your Firebase project and note the configuration values

4. Add your domain to the authorized domains list in Authentication settings

### 2. Environment Configuration

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Fill in your Firebase configuration:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

### 3. Installation

1. Install dependencies:
   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase project:
   ```bash
   firebase use your_project_id
   ```

### 4. Database Setup

1. Deploy Firestore rules and indexes:
   ```bash
   firebase deploy --only firestore
   