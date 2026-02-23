# Design Document: 5 Minutes a Day 

## 1. Executive Summary
5 Minutes a Day is a web-based "Build in Public" platform designed to help users overcome the friction of starting. By celebrating daily efforts as small as 5 minutes, it fosters long-term consistency through social accountability and automated tracking.


## 2. Core Features & Requirements

### 2.1 The "Check-in" System
Manual Posts: Users can post updates containing Text and Images.
The 5-Minute Philosophy: A soft goal. No hard timer; any logged activity constitutes "showing up."
Automated Validation: Initial support for GitHub. Any commit to a linked repository automatically validates the daily goal and increments/maintains the streak. It also automatically posts an update to the feed: “Rob has worked on their project today, that's x days in a row!” 🔥

### 2.2 Social Engine
The Global Firehose: A real-time public feed of all user updates.
Interactions: Users can "Heart" posts and leave comments.
Categorization: Users assign a category to their project (e.g., #Writing, #Coding, #Art).
Filtering: The feed can be filtered by these categories to find like-minded builders.
Public Profiles: Every user has a profile showcasing their current project, a visual "streak map" (similar to GitHub's contribution graph), and a history of past updates.

### 2.3 Streak & Grace Logic
The "48-Hour" Rule: To keep the habit sustainable, a streak only resets if a user misses two consecutive days of activity.
Freeze Mechanic: Users are granted a limited number of "Freeze" tokens to pause a streak during planned breaks or emergencies.
Timezone Standard: All logic is calculated based on Global UTC. The UI will clearly show a "Time Remaining" countdown to the next UTC day.

## 3. High-Level Architecture
The system utilizes a standard three-tier architecture with an external worker to handle the GitHub polling/webhook events.
Tech Stack (MVP)
Frontend: Next.js (Primary choice for SEO-friendly public profiles).
Backend: Node.js/TypeScript.
Database: PostgreSQL 
Auth: GitHub OAuth (Simplifies the linking of repos immediately).
Storage: Firebase




# Screens

## 1. The Landing & Global Firehose (Dual State)
This is the primary URL. It serves as both the homepage and the community hub.
Guest View: * Header: "5 Minutes a Day" branding + "Login" button (Google/GitHub).
Hero Message: A brief, punchy value prop about building in public.
The Feed: A scrollable list of all user updates (Text + Images).
Interaction Restrictions: "Heart" and "Comment" buttons are visible but trigger a login prompt when clicked.
Authenticated View:
The Composer: A persistent box at the top: "What did you do for 5 minutes today?" with text input and image upload.
Daily Status Tracker: A small widget showing your current streak flame and the UTC countdown.
Full Interaction: Ability to heart and comment on any post.
Category Filter Bar: Quick-toggle chips (#Coding, #Writing, #Art, etc.).


## 2. The Login / Gateway Screen
A clean, minimalist screen focused on conversion.
Login Options: Two large buttons: "Continue with GitHub" and "Continue with Google."
Social Proof: A small caption: "Join 1,200+ builders staying consistent today."


## 3. Onboarding / Project Setup
Shown only to new users or those starting a new project.
Project Name: "What are you working on?" (e.g., Writing my sci-fi novel).
Category Picker: A grid of icons (Coding, Art, Writing, Fitness, Music, Other).
The GitHub Hook (Optional): If logged in via GitHub, a searchable dropdown of their public repositories to enable auto-tracking.


## 4. User Profile Page (Public)
The user’s personal "Proof of Work" page.
Profile Header: Avatar, Bio, and "Project Mission."
Streak Dashboard: * The Flame: Current streak count (e.g., 15 Days).
The Status: Shows "Safe" (Checkmark), "At Risk" (Ghost Flame), or "Frozen."
The Grid: A 365-day consistency map (visualizing activity over time).
Personal Feed: A chronological list of only this user's 5-minute updates.

## 5. Post Detail View (Thread)
When a user wants to dive deeper into a specific update.
The Content: The full text and high-res image.
Social Stats: Who hearted the post.
Comments: A simple, linear conversation thread.

## 6. User Settings & Dashboard (Private)
Account Management: Link/Unlink GitHub or Google accounts.
Active Project Settings: Change project name or category.
The "Freeze" Vault: View and activate "Freeze Tokens" to protect a streak during a planned break.
Timezone Reference: A reminder that the app runs on Global UTC, showing the current UTC time vs. the user's local time.





