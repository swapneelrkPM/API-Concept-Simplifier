# API Simplifier — Sample Test Data

Each block below maps to a specific test case category.
Copy the content between the dashed lines and paste it directly into the tool.

---

## TEST 1 — Happy Path: REST API Endpoint
Category: Standard REST API documentation with methods, params, and responses.
Expected behavior: All three output sections render with relevant, specific content.

--------------------------------------------------
Endpoint: POST /v1/payments/initiate

Description:
Initiates a payment transaction. Creates a payment intent and returns a
transaction ID that must be confirmed within 15 minutes. If not confirmed,
the intent expires and must be recreated.

Authentication: Bearer token (OAuth 2.0). Scope required: payments:write

Request Headers:
  Content-Type: application/json
  Authorization: Bearer {access_token}
  Idempotency-Key: string (optional but strongly recommended for retries)

Request Body:
  {
    "amount": integer (required) — amount in smallest currency unit (e.g. paise, cents)
    "currency": string (required) — ISO 4217 currency code, e.g. "INR", "USD"
    "customer_id": string (required) — ID of the customer initiating payment
    "payment_method": string (required) — "card" | "upi" | "netbanking" | "wallet"
    "description": string (optional) — shown to customer on payment receipt
    "metadata": object (optional) — arbitrary key-value pairs, max 10 keys
  }

Response (200 OK):
  {
    "transaction_id": string,
    "status": "pending",
    "expires_at": ISO 8601 timestamp,
    "payment_url": string — redirect URL for customer to complete payment
  }

Error Responses:
  400 — Invalid request body (missing required fields or invalid currency code)
  401 — Invalid or expired bearer token
  402 — Customer payment method declined by issuer
  409 — Duplicate Idempotency-Key detected for a different request body
  429 — Rate limit exceeded. Limit: 100 requests per minute per merchant account
--------------------------------------------------


---

## TEST 2 — Happy Path: Engineering Architecture Note
Category: Internal technical note describing a new service design.
Expected behavior: Tool translates system design language into plain
business English and surfaces meaningful PM questions.

--------------------------------------------------
Notification Service — Architecture Proposal v0.3

We are moving from the current monolithic email-sending approach to an
event-driven notification service. The new service will consume events
from a central Kafka topic (user.events) and fan them out to the
appropriate delivery channel: email via SendGrid, push via Firebase Cloud
Messaging, and in-app via WebSocket connections.

Each notification type (payment_confirmation, onboarding_step_complete,
inactivity_nudge, weekly_digest) will have its own template stored in a
separate template registry. Templates support variable substitution and
A/B variants. Template updates do not require a service deployment.

User notification preferences are stored in a separate preferences service
with a gRPC API. The notification service calls preferences before
dispatching each notification. Users can opt out of each notification type
independently. Global opt-out is also supported.

Delivery status is tracked in a PostgreSQL table. Failed deliveries are
retried up to 3 times with exponential backoff. After 3 failures, the event
is moved to a dead-letter queue for manual inspection.

SLA target: 95% of notifications delivered within 60 seconds of event.
Expected load at launch: ~2,000 events per minute, scaling to 20,000
events per minute at 18-month growth projections.
--------------------------------------------------


---

## TEST 3 — Happy Path: GraphQL Schema
Category: GraphQL type definitions and a mutation.
Expected behavior: Tool correctly identifies it as an API spec and
produces plain-English output based on what the schema describes.

--------------------------------------------------
type User {
  id: ID!
  email: String!
  displayName: String!
  role: UserRole!
  createdAt: DateTime!
  subscription: Subscription
  preferences: UserPreferences!
}

enum UserRole {
  ADMIN
  EDITOR
  VIEWER
}

type Subscription {
  plan: SubscriptionPlan!
  status: SubscriptionStatus!
  currentPeriodEnd: DateTime!
  cancelAtPeriodEnd: Boolean!
  seats: Int!
  usedSeats: Int!
}

enum SubscriptionPlan {
  FREE
  STARTER
  GROWTH
  ENTERPRISE
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  TRIALING
}

type UserPreferences {
  emailNotifications: Boolean!
  weeklyDigest: Boolean!
  timezone: String!
  language: String!
}

mutation UpdateSubscription(
  $userId: ID!
  $plan: SubscriptionPlan!
  $seats: Int
) {
  updateSubscription(userId: $userId, plan: $plan, seats: $seats) {
    subscription {
      plan
      status
      seats
      currentPeriodEnd
    }
    error {
      code
      message
    }
  }
}
--------------------------------------------------


---

## TEST 4 — Edge Case: Partial / Incomplete Spec
Category: A spec that is cut off mid-description with missing context.
Expected behavior: Tool acknowledges incompleteness explicitly in the
Plain English section and analyzes only what is present.

--------------------------------------------------
GET /api/v2/reports/generate

Parameters:
  report_type: string — "engagement" | "revenue" | "retention" |
  date_from: string (ISO 8601)
  date_to: string (ISO 8601)
  filters:
    segment_id: string (optional)
    cohort:
--------------------------------------------------


---

## TEST 5 — Edge Case: Parameters Only, No Description
Category: Spec with parameters and types but no explanation of purpose.
Expected behavior: Plain English section notes that the purpose is
inferred from parameter naming only, not stated in the documentation.

--------------------------------------------------
POST /v1/content/moderate

Request Body:
  content_id: string
  content_type: "text" | "image" | "video"
  action: "approve" | "reject" | "escalate" | "request_edit"
  reason_code: string
  reviewer_id: string
  notes: string (optional)
  notify_creator: boolean
  override_auto_decision: boolean

Response:
  204 No Content on success
  422 if action conflicts with current content state
--------------------------------------------------


---

## TEST 6 — Guardrail: Non-Technical Content
Category: Input that is not API documentation at all.
Expected behavior: Tool displays the "Content type not recognized"
amber block with a specific explanation. No output cards are rendered.

--------------------------------------------------
I wanted to share some thoughts on our product strategy for next quarter.
I think we should focus on three core areas: improving onboarding for new
users, building out the analytics dashboard for enterprise clients, and
exploring a mobile app. The team has been stretched thin and we need to
make sure we are prioritizing the right things before planning season.
--------------------------------------------------


---

## TEST 7 — Edge Case: Webhook Payload Spec
Category: Event/webhook documentation rather than a callable endpoint.
Expected behavior: Tool correctly handles event-driven specs and surfaces
relevant product opportunities around webhook-based integrations.

--------------------------------------------------
Webhook Event: order.status_changed

Triggered when an order transitions between any of the following states:
  placed → confirmed → processing → shipped → delivered
  placed → cancelled
  processing → refund_initiated → refunded

Payload:
  {
    "event": "order.status_changed",
    "timestamp": ISO 8601,
    "order_id": string,
    "previous_status": string,
    "new_status": string,
    "customer": {
      "id": string,
      "email": string
    },
    "items": [
      {
        "sku": string,
        "quantity": integer,
        "unit_price": integer (in paise)
      }
    ],
    "estimated_delivery": ISO 8601 | null,
    "tracking_url": string | null
  }

Delivery:
  Retries: up to 5 times with exponential backoff (1s, 2s, 4s, 8s, 16s)
  Timeout: 10 seconds per attempt
  Signature: HMAC-SHA256 in X-Webhook-Signature header
--------------------------------------------------
