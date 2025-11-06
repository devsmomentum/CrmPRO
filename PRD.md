# Planning Guide

A comprehensive CRM platform that enables businesses to manage leads through customizable pipelines with multi-channel communication, AI-powered task automation, team collaboration, and intelligent follow-up systems.

**Experience Qualities**:
1. **Efficient** - Streamlined workflows that minimize clicks and maximize productivity for sales teams managing multiple leads simultaneously
2. **Intelligent** - AI-powered automation that learns from conversations and automatically assigns tasks, creating a proactive sales environment
3. **Connected** - Unified multi-channel communication hub that consolidates Instagram, Facebook, WhatsApp, and internal notes into a single interface

**Complexity Level**: Complex Application (advanced functionality, accounts)
- This is a full-featured CRM requiring extensive state management, multiple interconnected features, team collaboration, AI integration, automation workflows, and dynamic form configurations across different pipeline stages.

## Essential Features

### Pipeline & Flow Management
- **Functionality**: Create and manage multiple CRM flows (Sales, Support, Administrative) with custom stages for each pipeline
- **Purpose**: Allow businesses to segregate different customer journey phases and departments
- **Trigger**: User clicks "New Flow" or "New Stage" buttons in settings
- **Progression**: Settings → Pipeline Configuration → Create Flow/Stage → Define Stage Properties → Save → View in Kanban Board
- **Success criteria**: Leads can be dragged between stages, flows can switch based on lead status changes

### Lead Management with Multi-Channel Chat
- **Functionality**: Centralized lead profiles with integrated chat supporting Instagram, Facebook, WhatsApp channels
- **Purpose**: Provide complete communication history and context for every customer interaction
- **Trigger**: Click on lead card in kanban or list view
- **Progression**: Lead Card Click → Lead Detail Panel → Multi-Tab View (Overview/Chat/Budget/Tasks) → Select Channel → View/Send Messages
- **Success criteria**: All messages are timestamped, channel-specific, and searchable

### Tags, Priorities & Budget System
- **Functionality**: Color-coded tags, priority levels (High/Medium/Low), and budget tracking with custom amounts
- **Purpose**: Quick visual categorization and financial qualification of leads
- **Trigger**: Click tag icon or priority dropdown in lead detail view
- **Progression**: Lead Detail → Click Add Tag → Select/Create Colored Tag → Auto-trigger tag-specific actions → Visual confirmation
- **Success criteria**: Tags display with distinct colors, priorities affect task ordering, budgets show in lead cards

### AI Voice-to-Task Assignment
- **Functionality**: Record audio notes that AI transcribes and converts into assigned tasks
- **Purpose**: Enable rapid task creation during calls or meetings without manual typing
- **Trigger**: Click microphone button in lead detail or dashboard
- **Progression**: Click Mic → Record Audio → Stop → AI Processing → Task Summary Display → Assign to Team Member → Confirm
- **Success criteria**: Transcription appears within 3 seconds, AI correctly extracts action items and suggests assignees

### Automated Actions & Workflows
- **Functionality**: Pre-configured and custom automation rules triggered by tags, stage changes, or time-based events
- **Purpose**: Reduce manual work and ensure consistent follow-up processes
- **Trigger**: Tag addition, stage transition, or scheduled time event
- **Progression**: Trigger Event → Rule Evaluation → Action Execution (Send Email/SMS, Create Task, Move Stage) → Log Activity
- **Success criteria**: Actions fire reliably, users can view automation logs, emails/messages send via configured APIs

### Meeting Minutes & Notes
- **Functionality**: Timestamped meeting notes attached to leads with participant tracking
- **Purpose**: Document important discussions and decisions for team reference
- **Trigger**: Click "Add Meeting Note" in lead timeline
- **Progression**: Click Button → Modal Opens → Enter Date/Time/Participants/Notes → Save → Appears in Timeline
- **Success criteria**: Notes are searchable, sortable by date, and visible to entire team

### Intelligent Automated Messaging
- **Functionality**: AI-generated follow-up messages scheduled based on conversation context and lead behavior
- **Purpose**: Maintain engagement without manual intervention
- **Trigger**: System analyzes conversation sentiment and last contact time
- **Progression**: Background Analysis → Message Generation → Schedule Time → User Review/Approve → Auto-Send
- **Success criteria**: Messages feel personalized, timing is contextually appropriate, 80%+ approval rate

### Appointment Calendar System
- **Functionality**: Dual calendar view - internal for team, public for lead self-booking
- **Purpose**: Streamline meeting scheduling and reduce back-and-forth communication
- **Trigger**: Click "Book Meeting" or access public booking link
- **Progression**: Calendar View → Select Available Slot → Enter Details → Confirm → Notification Sent → Calendar Updated
- **Success criteria**: No double-bookings, timezone-aware, integrates with lead timeline

### Real-Time Notifications
- **Functionality**: Push notifications for task deadlines, new messages, stage changes, and upcoming appointments
- **Purpose**: Keep team members immediately informed of critical updates
- **Trigger**: System events matching notification rules
- **Progression**: Event Occurs → Notification Generated → Badge/Toast Display → Click → Navigate to Context
- **Success criteria**: Notifications appear within 1 second, dismissible, actionable with direct links

### Salesperson Daily Dashboard
- **Functionality**: Personalized view showing assigned tasks, today's meetings, overdue items, and performance metrics
- **Purpose**: Provide focus and clarity on daily priorities
- **Trigger**: Login or click "My Dashboard"
- **Progression**: Navigate to Dashboard → View Categorized Tasks → See Calendar Events → Review Metrics → Click Item to Act
- **Success criteria**: Updates in real-time, tasks are prioritized intelligently, clear visual hierarchy

### Analytics & Statistics Dashboard
- **Functionality**: Visual charts showing pipeline velocity, conversion rates, revenue forecasts, team performance
- **Purpose**: Enable data-driven decisions and track business health
- **Trigger**: Click "Analytics" in main navigation
- **Progression**: Analytics Page → Select Date Range → Choose Metrics → View Charts → Export Reports
- **Success criteria**: Charts load quickly, data is accurate, filters work smoothly

### Budget & Proposal Builder
- **Functionality**: Pre-built budget templates with line items, tax calculations, approval workflows, and intelligent item selector with catalog management
- **Purpose**: Standardize pricing presentation, accelerate quote delivery, and maintain consistent product/service catalog
- **Trigger**: Click "Create Budget" in lead detail
- **Progression**: Select Template → Choose Items from Catalog (or create new) → Customize Line Items → Calculate Total → Preview → Send to Lead → Track Views
- **Success criteria**: Templates are editable, calculations are accurate, leads can view without login, catalog items can be created on-the-fly or pre-managed in settings

### Company & Multi-Business Management
- **Functionality**: Users can create and manage multiple companies/businesses with separate logos, switch between them, and maintain isolated data
- **Purpose**: Enable agencies or multi-business owners to manage different entities within one account
- **Trigger**: Navigate to Settings → Companies tab, or click company switcher
- **Progression**: Settings → Companies → Create New Company → Upload Logo → Enter Details → Switch Active Company → Data Context Updates
- **Success criteria**: Logo uploads work (max 2MB, image formats), company switching updates all views, each company has isolated pipelines/leads/data

### Product/Service Catalog Management
- **Functionality**: Centralized catalog of items/services with names, descriptions, and prices that can be reused across budgets
- **Purpose**: Maintain consistency in pricing, speed up budget creation, and manage service/product offerings
- **Trigger**: Settings → Catalog tab, or during budget creation when selecting items
- **Progression**: Navigate to Catalog → Create Item → Enter Name/Description/Price → Save → Use in Budget Creation
- **Success criteria**: Items are searchable, can be created inline during budget creation, prices auto-populate when selected, catalog is editable from settings

### Lead-to-Client Conversion Flow
- **Functionality**: Automated transition from sales to administrative/support pipeline when marked as "Won"
- **Purpose**: Seamlessly hand off customers between departments with proper context
- **Trigger**: Salesperson marks deal as "Won"
- **Progression**: Mark Won → Trigger Transfer → Change Pipeline → Update Custom Fields → Notify Support Team → Archive Sales Tasks
- **Success criteria**: No data loss, support sees relevant customer info, clean handoff notification

### Dynamic Form Configuration
- **Functionality**: Custom field sets that change based on pipeline/stage context
- **Purpose**: Collect appropriate information at each customer journey phase
- **Trigger**: Lead moves to different pipeline or stage
- **Progression**: Stage Change → Detect New Pipeline → Load Field Configuration → Display Custom Form → Validate Input
- **Success criteria**: Fields appear/disappear correctly, data persists appropriately, validation works

## Edge Case Handling

- **Concurrent Editing**: Optimistic updates with conflict detection when multiple users edit same lead - show toast notification with refresh option
- **Offline Mode**: Queue actions locally and sync when connection restored - display offline indicator
- **AI Failures**: Fallback to manual task creation if AI transcription fails - show error toast with retry option
- **Missing Budget Templates**: Allow ad-hoc budget creation if no templates exist - provide blank template
- **Double-Booking Prevention**: Lock calendar slots during booking process - release after 5 minutes if abandoned
- **Tag Limit**: Cap at 10 tags per lead to prevent visual clutter - show warning at 8 tags
- **Empty States**: Show helpful onboarding messages for new users with no leads/pipelines - include quick-start actions
- **Deleted Team Members**: Reassign orphaned tasks to team admin - notify admin of reassignment
- **Expired Automation APIs**: Detect failed API calls and notify admin - pause automation until fixed
- **Calendar Timezone Issues**: Always store UTC, display in user's local timezone - show timezone in booking confirmations

## Design Direction

The design should feel professional, trustworthy, and efficient - like a sophisticated business tool that balances power with simplicity. A clean, data-dense interface with subtle depth cues (soft shadows, gentle gradients) guides focus without overwhelming. Minimal interface that prioritizes information density while maintaining breathing room for cognitive ease.

## Color Selection

Triadic color scheme - using blue (trust/professionalism), orange (energy/action), and purple (intelligence/automation) to create visual distinction between different functional areas while maintaining cohesive brand identity.

- **Primary Color**: Deep Professional Blue `oklch(0.45 0.15 250)` - Represents reliability and corporate trust, used for main actions and navigation
- **Secondary Colors**: Slate Gray `oklch(0.35 0.02 250)` for secondary UI elements and muted backgrounds, White `oklch(0.98 0 0)` for cards and content areas
- **Accent Color**: Vibrant Orange `oklch(0.68 0.18 45)` - Draws attention to critical actions like "Send Message" or "Create Task", used sparingly for high-priority CTAs
- **Foreground/Background Pairings**:
  - Background (White `oklch(0.98 0 0)`): Dark Slate Text `oklch(0.25 0.02 250)` - Ratio 13.2:1 ✓
  - Card (Light Gray `oklch(0.96 0 0)`): Dark Slate Text `oklch(0.25 0.02 250)` - Ratio 12.5:1 ✓
  - Primary (Deep Blue `oklch(0.45 0.15 250)`): White Text `oklch(0.98 0 0)` - Ratio 8.1:1 ✓
  - Secondary (Slate `oklch(0.35 0.02 250)`): White Text `oklch(0.98 0 0)` - Ratio 11.8:1 ✓
  - Accent (Orange `oklch(0.68 0.18 45)`): Dark Text `oklch(0.25 0.02 250)` - Ratio 5.2:1 ✓
  - Muted (Light Purple `oklch(0.92 0.04 280)`): Medium Text `oklch(0.50 0.02 250)` - Ratio 5.8:1 ✓

## Font Selection

Modern sans-serif typefaces that convey clarity and efficiency - Inter for its exceptional readability at small sizes (critical for data tables) and Poppins for headings to add approachable personality without sacrificing professionalism.

- **Typographic Hierarchy**:
  - H1 (Page Titles): Poppins SemiBold/32px/tight (-0.02em) - Used for main page headers
  - H2 (Section Headers): Poppins Medium/24px/tight (-0.01em) - Pipeline names, modal titles
  - H3 (Card Headers): Poppins Medium/18px/normal - Lead names, widget titles
  - Body (General Text): Inter Regular/14px/relaxed (1.5) - Main content, descriptions
  - Small (Meta Info): Inter Regular/12px/normal - Timestamps, labels, helper text
  - Button Text: Inter SemiBold/14px/normal - All interactive elements

## Animations

Animations should feel purposeful and snappy - reinforcing actions without delaying workflow. Emphasize state transitions (stage changes, task completions) with subtle celebrations while keeping navigation transitions minimal to maintain productivity focus. Motion conveys energy and responsiveness appropriate for a fast-paced sales environment.

- **Purposeful Meaning**: Card drags have physics-based momentum, completed tasks fade out with satisfying checkmark expansion, notification badges pulse gently to draw attention without nagging
- **Hierarchy of Movement**: High priority: Task completions (300ms spring), New messages (200ms slide-in), Pipeline stage changes (250ms smooth drag). Low priority: Hover states (100ms), Dropdowns (150ms), Page transitions (200ms fade)

## Component Selection

- **Components**:
  - **Kanban Board**: Custom component using `Card` + `DragDropContext` for pipeline visualization
  - **Lead Detail Panel**: `Sheet` component for slide-out detail views with tabs
  - **Modals**: `Dialog` for task creation, budget builder, settings
  - **Form Inputs**: `Input`, `Textarea`, `Select` for all data entry with `react-hook-form` validation
  - **Tags**: Custom `Badge` variants with color coding
  - **Calendar**: `Calendar` component for date picking, custom week/month views for appointment scheduling
  - **Navigation**: `Sidebar` for main app navigation with collapsible sections
  - **Tables**: `Table` component for lead lists, analytics data
  - **Charts**: `recharts` for dashboard analytics with custom tooltips
  - **Notifications**: `sonner` toast system for real-time alerts
  - **Dropdown Menus**: `DropdownMenu` for actions on lead cards
  - **Tabs**: `Tabs` for switching between Chat/Budget/Tasks views
  - **Chat Interface**: Custom component using `ScrollArea` + message bubbles
  - **Audio Recorder**: Custom component with visual waveform using Web Audio API

- **Customizations**:
  - Priority indicators with colored dots and glow effects
  - Tag components with remove functionality and color picker
  - Budget line item rows with add/delete actions
  - Message bubbles with channel icons and read receipts
  - Notification badge with count and pulsing animation
  - Stage cards with lead count badges

- **States**:
  - Buttons: Default (solid), Hover (slight lift + shadow), Active (pressed inset), Disabled (50% opacity)
  - Inputs: Default (border), Focus (border accent + ring), Error (red border + icon), Success (green border + checkmark)
  - Cards: Default (flat), Hover (subtle lift), Selected (accent border + shadow), Dragging (elevated shadow + rotation)
  - Tags: Default (colored bg), Hover (darker), Removable (X appears on hover)

- **Icon Selection**:
  - Navigation: `House` (Dashboard), `Kanban` (Pipelines), `ChartBar` (Analytics), `Gear` (Settings)
  - Actions: `Plus` (Create), `PaperPlaneRight` (Send), `Phone` (Call), `CalendarBlank` (Schedule)
  - Status: `CheckCircle` (Complete), `Clock` (Pending), `WarningCircle` (Overdue), `Tag` (Tags)
  - Communication: `InstagramLogo`, `FacebookLogo`, `WhatsappLogo`, `Envelope` (Email)
  - Features: `Microphone` (Voice), `Note` (Notes), `Users` (Team), `Bell` (Notifications)

- **Spacing**:
  - Page padding: `p-6` (24px)
  - Card padding: `p-4` (16px)
  - Section gaps: `gap-6` (24px)
  - List items: `gap-3` (12px)
  - Inline elements: `gap-2` (8px)
  - Tight groups: `gap-1` (4px)

- **Mobile**:
  - Navigation collapses to bottom tab bar on mobile
  - Kanban switches to vertical scrolling list view
  - Sheet panels become full-screen modals
  - Tables switch to card-based layouts
  - Dashboard widgets stack vertically
  - Calendar switches to agenda view on small screens
