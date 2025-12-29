# Authentication Flow - Visual Diagrams

## 1. Login Flow

```
┌─────────┐
│  User   │
└────┬────┘
     │
     │ Enters credentials
     ▼
┌─────────────────┐
│  Login Page     │
└────┬────────────┘
     │
     │ POST /accounts/login/
     ▼
┌─────────────────┐
│  Backend API    │
└────┬────────────┘
     │
     │ Returns: { access, refresh, user_data }
     ▼
┌─────────────────┐
│  Auth Store     │
│  - Save tokens  │
│  - Save user    │
└────┬────────────┘
     │
     │ Store in localStorage
     │ + Zustand state
     ▼
┌─────────────────┐
│ Dashboard/Home  │
└─────────────────┘
```

## 2. Normal API Request Flow

```
┌──────────────┐
│  Component   │
│  makes API   │
│  call        │
└──────┬───────┘
       │
       │ apiCallProtected.get('/endpoint')
       ▼
┌──────────────────────┐
│ Request Interceptor  │
│ Adds Authorization:  │
│ Bearer <accessToken> │
└──────┬───────────────┘
       │
       │ HTTP Request with token
       ▼
┌──────────────────────┐
│   Backend API        │
│   Validates token    │
└──────┬───────────────┘
       │
       │ 200 OK + Data
       ▼
┌──────────────────────┐
│ Response Interceptor │
│ Returns data         │
└──────┬───────────────┘
       │
       │ Resolved Promise
       ▼
┌──────────────────────┐
│   Component          │
│   Receives data      │
└──────────────────────┘
```

## 3. Token Refresh Flow (Single Request)

```
┌──────────────┐
│  Component   │
│  makes API   │
└──────┬───────┘
       │
       │ Request with expired token
       ▼
┌──────────────────────┐
│   Backend API        │
│   Token expired!     │
└──────┬───────────────┘
       │
       │ 401 Unauthorized
       ▼
┌──────────────────────────────┐
│   Response Interceptor       │
│   - Catches 401 error        │
│   - Checks if refresh needed │
│   - Mark request for retry   │
└──────┬───────────────────────┘
       │
       │ Set isRefreshing = true
       ▼
┌──────────────────────────────┐
│   Auth Store                 │
│   refreshAccessToken()       │
└──────┬───────────────────────┘
       │
       │ POST /api/token/refresh/
       │ Body: { refresh: <token> }
       ▼
┌──────────────────────────────┐
│   Backend API                │
│   - Validate refresh token   │
│   - Generate new access      │
└──────┬───────────────────────┘
       │
       │ 200 OK: { access: <new_token> }
       ▼
┌──────────────────────────────┐
│   Auth Store                 │
│   - Save new access token    │
│   - Update localStorage      │
└──────┬───────────────────────┘
       │
       │ Return new token
       ▼
┌──────────────────────────────┐
│   Response Interceptor       │
│   - Update request headers   │
│   - Retry original request   │
└──────┬───────────────────────┘
       │
       │ Same request, new token
       ▼
┌──────────────────────────────┐
│   Backend API                │
│   - Validate new token ✓     │
│   - Return data              │
└──────┬───────────────────────┘
       │
       │ 200 OK + Data
       ▼
┌──────────────────────────────┐
│   Component                  │
│   Receives data (seamless!)  │
└──────────────────────────────┘
```

## 4. Multiple Simultaneous 401s with Request Queuing

```
Time →

Request A ────┐
Request B ─────┤
Request C ──────┤
                │
                │ All get 401
                ▼
        ┌───────────────────┐
        │ Response          │
        │ Interceptor       │
        └───────┬───────────┘
                │
                ├─ Request A: isRefreshing=false → START REFRESH
                ├─ Request B: isRefreshing=true  → QUEUE
                └─ Request C: isRefreshing=true  → QUEUE

                │
                ▼ Request A proceeds
        ┌───────────────────┐
        │ Call Refresh API  │
        │ isRefreshing=true │
        └───────┬───────────┘
                │
                │ Get new access token
                ▼
        ┌───────────────────┐
        │ Process Queue     │
        │ failedQueue.push  │
        └───────┬───────────┘
                │
                ├─→ Resolve Request A promise → Retry A ✓
                ├─→ Resolve Request B promise → Retry B ✓
                └─→ Resolve Request C promise → Retry C ✓

                │ isRefreshing=false
                ▼
        All requests succeed with new token!
```

## 5. Refresh Token Expired Flow

```
┌──────────────┐
│  Component   │
│  makes API   │
└──────┬───────┘
       │
       │ Request with expired access token
       ▼
┌──────────────────────┐
│   Backend API        │
└──────┬───────────────┘
       │
       │ 401 Unauthorized
       ▼
┌──────────────────────────────┐
│   Response Interceptor       │
│   Detects 401                │
└──────┬───────────────────────┘
       │
       │ Try to refresh
       ▼
┌──────────────────────────────┐
│   POST /api/token/refresh/   │
│   Body: { refresh: <token> } │
└──────┬───────────────────────┘
       │
       │ 401 Unauthorized
       │ (Refresh token expired!)
       ▼
┌──────────────────────────────┐
│   Response Interceptor       │
│   - Detects refresh failed   │
│   - url.includes("refresh")  │
└──────┬───────────────────────┘
       │
       │ Trigger logout
       ▼
┌──────────────────────────────┐
│   Auth Store                 │
│   resetAuth()                │
│   - Clear localStorage       │
│   - Clear state              │
└──────┬───────────────────────┘
       │
       ├─→ Show toast: "Session expired"
       │
       │ window.location.href = "/login"
       ▼
┌──────────────────────────────┐
│   Login Page                 │
│   User must login again      │
└──────────────────────────────┘
```

## 6. State Management Flow

```
┌─────────────────────────────────────────────────┐
│                                                 │
│   Zustand Auth Store (In-Memory)               │
│   ┌───────────────────────────────────────┐   │
│   │ - user: User | null                   │   │
│   │ - accessToken: string | null          │   │
│   │ - refreshToken: string | null         │   │
│   └───────────────────────────────────────┘   │
│                      ↕                          │
│                Synchronized                     │
│                      ↕                          │
│   localStorage (Persistent)                    │
│   ┌───────────────────────────────────────┐   │
│   │ - user: JSON string                   │   │
│   │ - accessToken: string                 │   │
│   │ - refreshToken: string                │   │
│   └───────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
                      ↕
            Used by Interceptors
                      ↕
    ┌─────────────────────────────────────┐
    │   Request Interceptor               │
    │   - Reads accessToken               │
    │   - Adds to headers                 │
    └─────────────────────────────────────┘
                      ↕
    ┌─────────────────────────────────────┐
    │   Response Interceptor              │
    │   - Reads refreshToken              │
    │   - Calls refreshAccessToken()      │
    │   - Updates tokens                  │
    └─────────────────────────────────────┘
```

## 7. Error Handling Decision Tree

```
                    ┌─────────────┐
                    │  API Error  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ What status?│
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
    ┌───▼───┐         ┌───▼───┐         ┌───▼───┐
    │  401  │         │  403  │         │ Other │
    └───┬───┘         └───┬───┘         └───┬───┘
        │                 │                  │
        │                 │                  └──→ Show error
        │                 │                       message
        │             ┌───▼───┐
        │             │ Has   │
        │             │token? │
        │             └───┬───┘
        │                 │
        │          ┌──────┼──────┐
        │          │             │
        │        ┌─▼──┐       ┌──▼───┐
        │        │Yes │       │ No   │
        │        └─┬──┘       └──┬───┘
        │          │             │
        │      ┌───▼───┐         └──→ Show error
        │      │Logout │              message
        │      └───────┘
        │
    ┌───▼────────┐
    │ Is refresh │
    │  endpoint? │
    └───┬────────┘
        │
    ┌───┼───┐
    │       │
┌───▼──┐ ┌──▼────┐
│ Yes  │ │  No   │
└───┬──┘ └──┬────┘
    │        │
    │        └─────→ Try refresh
    │                    │
    └──→ Refresh failed  │
         Logout user     │
                         │
                 ┌───────▼────────┐
                 │ Refresh success│
                 └───────┬────────┘
                         │
                 ┌───────▼────────┐
                 │ Retry request  │
                 └────────────────┘
```

## 8. Token Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                     Token Lifecycle                         │
└─────────────────────────────────────────────────────────────┘

Login
  ↓
┌─────────────────────┐
│ Fresh Tokens        │ ← access_token (15-30 min)
│ access + refresh    │ ← refresh_token (7-30 days)
└─────┬───────────────┘
      │
      │ Time passes...
      │
      ▼
┌─────────────────────┐
│ Access Expired      │ ← access_token ✗
│ Refresh Valid       │ ← refresh_token ✓
└─────┬───────────────┘
      │
      │ Automatic refresh triggered
      ▼
┌─────────────────────┐
│ Refresh API Call    │
│ POST /token/refresh │
└─────┬───────────────┘
      │
      ▼
┌─────────────────────┐
│ New Access Token    │ ← new access_token (15-30 min)
│ Same Refresh Token  │ ← refresh_token ✓ (unchanged)
└─────┬───────────────┘
      │
      │ Cycle repeats...
      │ Eventually:
      ▼
┌─────────────────────┐
│ Both Expired        │ ← access_token ✗
│                     │ ← refresh_token ✗
└─────┬───────────────┘
      │
      │ Refresh fails (401)
      ▼
┌─────────────────────┐
│ Logout User         │
│ Redirect to Login   │
└─────────────────────┘
```

## 9. Component Integration Pattern

```
┌────────────────────────────────────────────────┐
│           React Component                      │
│                                                │
│  const MyComponent = () => {                   │
│                                                │
│    // Get auth state                           │
│    const { user, accessToken } =               │
│      useAuthStore();                           │
│                                                │
│    // Make API call                            │
│    const fetchData = async () => {             │
│      const data = await                        │
│        apiCallProtected.get('/endpoint');      │
│      // Token refresh happens                  │
│      // automatically if needed!               │
│    };                                          │
│                                                │
│    return <div>...</div>;                      │
│  };                                            │
│                                                │
└────────────────────────────────────────────────┘
                      │
                      │ Uses
                      ▼
┌────────────────────────────────────────────────┐
│           apiCallProtected                     │
│           (Axios Instance)                     │
│                                                │
│   - Request Interceptor adds token             │
│   - Response Interceptor handles refresh       │
│   - Everything automatic!                      │
└────────────────────────────────────────────────┘
```

## 10. Request Queue Management

```
State: isRefreshing = false, failedQueue = []

Request 1 arrives (401)
  ↓
isRefreshing? NO
  ↓
Set isRefreshing = true
Start refresh
  ↓
State: isRefreshing = true, failedQueue = []

Request 2 arrives (401)
  ↓
isRefreshing? YES
  ↓
failedQueue.push({resolve2, reject2})
  ↓
State: isRefreshing = true, failedQueue = [req2]

Request 3 arrives (401)
  ↓
isRefreshing? YES
  ↓
failedQueue.push({resolve3, reject3})
  ↓
State: isRefreshing = true, failedQueue = [req2, req3]

Refresh completes successfully
  ↓
processQueue(null, newToken)
  ↓
  ├─→ resolve1(newToken) → Retry Request 1
  ├─→ resolve2(newToken) → Retry Request 2
  └─→ resolve3(newToken) → Retry Request 3
  ↓
failedQueue = []
isRefreshing = false
  ↓
State: isRefreshing = false, failedQueue = []

All requests succeed!
```

## 11. Complete Request/Response Cycle

```
┌─────────────┐
│  Component  │
└──────┬──────┘
       │ 1. apiCallProtected.get('/data')
       ▼
┌──────────────────────────────────────────────┐
│         REQUEST INTERCEPTOR                  │
│  ┌─────────────────────────────────────┐    │
│  │ const token =                       │    │
│  │   useAuthStore.getState().token     │    │
│  │ config.headers.Authorization =      │    │
│  │   `Bearer ${token}`                 │    │
│  └─────────────────────────────────────┘    │
└──────┬───────────────────────────────────────┘
       │ 2. GET /data + Bearer token
       ▼
┌──────────────────────────────────────────────┐
│           BACKEND API                        │
│  ┌─────────────────────────────────────┐    │
│  │ Verify JWT token                    │    │
│  │ If valid: Return data               │    │
│  │ If expired: Return 401              │    │
│  └─────────────────────────────────────┘    │
└──────┬───────────────────────────────────────┘
       │ 3. Response (200 or 401)
       ▼
┌──────────────────────────────────────────────┐
│         RESPONSE INTERCEPTOR                 │
│  ┌─────────────────────────────────────┐    │
│  │ if (status === 200) {               │    │
│  │   return data                       │    │
│  │ }                                   │    │
│  │ if (status === 401) {               │    │
│  │   await refreshToken()              │    │
│  │   retry(originalRequest)            │    │
│  │   return data                       │    │
│  │ }                                   │    │
│  └─────────────────────────────────────┘    │
└──────┬───────────────────────────────────────┘
       │ 4. Data or Error
       ▼
┌──────────────┐
│  Component   │
│ (gets data)  │
└──────────────┘
```

---

**Note**: These diagrams represent the actual implementation in the codebase. All flows are fully functional and tested.

**Created**: November 5, 2025
