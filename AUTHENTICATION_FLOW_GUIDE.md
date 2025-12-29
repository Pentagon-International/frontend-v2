# Authentication Flow Implementation Guide

## Overview

This application implements a robust JWT-based authentication flow with automatic token refresh. The implementation follows OAuth2 best practices and ensures seamless user experience by automatically refreshing expired access tokens.

## Architecture

### Components

1. **Auth Store** (`src/store/authStore.ts`)
   - Manages authentication state using Zustand
   - Stores user data, access token, and refresh token in localStorage
   - Provides methods for login, logout, and token refresh

2. **Request Interceptor** (`src/api/requestInterceptor.ts`)
   - Automatically attaches the access token to all protected API requests
   - Adds `Authorization: Bearer <access_token>` header

3. **Response Interceptor** (`src/api/responseInterceptor.ts`)
   - Handles API responses and errors
   - Implements automatic token refresh on 401 errors
   - Manages request queuing during token refresh
   - Retries failed requests with new tokens

## Authentication Flow

### 1. Login Flow

```
User Login → API Response → Store Tokens → Set Auth State
```

The login API returns:

```json
{
  "refresh": "eyJhbGc...",
  "access": "eyJhbGc...",
  "pulse_id": "P2PEN",
  "full_name": "Paresh",
  "user_identifier": "paresh@pentagonindia.net",
  ...
}
```

Both tokens are stored in:

- `localStorage` (for persistence)
- Zustand store (for state management)

### 2. API Request Flow

```
API Request → Request Interceptor → Add Bearer Token → Send Request
```

Every protected API request automatically gets the access token attached via the request interceptor.

### 3. Token Expiration & Refresh Flow

When an access token expires:

```
API Request → 401 Error → Refresh Token API → New Access Token → Retry Original Request
```

**Detailed Steps:**

1. **API returns 401 Unauthorized**
   - Response interceptor catches the error
   - Checks if the request was already retried (prevents infinite loops)
   - Marks request for retry

2. **Check if refresh is in progress**
   - If YES: Queue the failed request
   - If NO: Start the refresh process

3. **Call Refresh Token API**
   - Endpoint: `POST /api/token/refresh/`
   - Body: `{ "refresh": "<refresh_token>" }`
   - No auth header required

4. **Handle Refresh Response**
   - **Success**:
     - Store new access token
     - Update authorization header
     - Process queued requests
     - Retry the original request
   - **Failure (401)**:
     - Clear all tokens
     - Show "Session expired" message
     - Redirect to login page

### 4. Request Queuing System

When multiple API calls fail simultaneously due to token expiration:

```
Request 1 (401) → Start Refresh
Request 2 (401) → Queue
Request 3 (401) → Queue
Refresh Success → Process Queue → Retry All Requests
```

This prevents multiple refresh token API calls and ensures all failed requests are retried with the new token.

### 5. Logout Flow

**Manual Logout:**

```
User Clicks Logout → Clear Tokens → Clear State → Redirect to Login
```

**Automatic Logout (Refresh Token Expired):**

```
Refresh API (401) → Clear Tokens → Show Message → Redirect to Login
```

## API Endpoints

### Login

- **URL**: `accounts/login/`
- **Method**: POST
- **Auth**: No
- **Response**: `{ access, refresh, user_data }`

### Refresh Token

- **URL**: `api/token/refresh/`
- **Method**: POST
- **Auth**: No
- **Request Body**: `{ "refresh": "<refresh_token>" }`
- **Response**: `{ "access": "<new_access_token>" }`

## Key Features

### 1. Automatic Token Refresh

- Transparent to the user
- No interruption in user experience
- Failed requests automatically retry

### 2. Request Queuing

- Prevents multiple simultaneous refresh calls
- Ensures all pending requests complete after refresh

### 3. Smart Error Handling

- Only logs out when refresh token expires
- Distinguishes between access token and refresh token expiration
- Prevents infinite retry loops

### 4. Session Persistence

- Tokens stored in localStorage
- Survives page refreshes
- Auto-logout only on token expiration

### 5. 403 Forbidden Handling

- Different from 401 (unauthorized)
- Handles insufficient permissions
- Shows appropriate error messages

## Error Handling

### HTTP Status Codes

| Status | Handling                              | User Action                    |
| ------ | ------------------------------------- | ------------------------------ |
| 401    | Refresh token → Retry request         | None (automatic)               |
| 403    | Check if logged in → Logout if needed | Login again if session expired |
| 400    | Show error message                    | Check input                    |
| 404    | Show error message                    | Resource not found             |
| 500    | Show error message                    | Server error                   |
| 503    | Show error message                    | Service unavailable            |

### Refresh Token Failures

If refresh token API returns 401:

1. Clear all authentication data
2. Show toast: "Session expired. Please login again."
3. Redirect to login page

## Usage Examples

### Making Protected API Calls

```typescript
import { apiCallProtected } from "./api/axios";

// The access token is automatically attached
const response = await apiCallProtected.get(
  "/customer_master/customer-master/"
);
```

### Manual Logout

```typescript
import useAuthStore from "./store/authStore";

const handleLogout = () => {
  useAuthStore.getState().logout();
};
```

### Check Authentication Status

```typescript
import useAuthStore from './store/authStore';

const MyComponent = () => {
  const { user, accessToken } = useAuthStore();

  if (!accessToken) {
    // User is not logged in
    return <Navigate to="/login" />;
  }

  return <div>Welcome, {user?.full_name}</div>;
};
```

## Security Considerations

1. **Tokens stored in localStorage**
   - Vulnerable to XSS attacks
   - Ensure your app is protected against XSS
   - Consider httpOnly cookies for production

2. **Refresh token rotation**
   - Current implementation doesn't rotate refresh tokens
   - Consider implementing refresh token rotation for enhanced security

3. **Token expiration**
   - Access tokens should have short expiration (15-30 minutes)
   - Refresh tokens can have longer expiration (7-30 days)

## Testing the Implementation

### 1. Test Normal Flow

- Login
- Make API calls
- Verify token is attached to requests

### 2. Test Token Expiration

- Wait for access token to expire
- Make an API call
- Verify automatic refresh
- Verify request succeeds after refresh

### 3. Test Refresh Token Expiration

- Manually expire refresh token
- Make an API call
- Verify user is logged out
- Verify redirect to login page

### 4. Test Multiple Simultaneous Requests

- Make multiple API calls when token is expired
- Verify only one refresh call is made
- Verify all requests succeed after refresh

## Troubleshooting

### Issue: Infinite Refresh Loop

**Solution**: Check that `originalRequest._retry` flag is properly set

### Issue: User logged out immediately

**Solution**: Check refresh token API endpoint and response format

### Issue: Multiple refresh calls

**Solution**: Verify `isRefreshing` flag is working correctly

### Issue: Requests not retrying after refresh

**Solution**: Check `processQueue` function and failedQueue logic

## Configuration

### Environment Variables

```env
VITE_API_BASE_URL=http://13.201.171.0:8000/
```

### Fallback URL

If `VITE_API_BASE_URL` is not set, the system falls back to:

```
http://13.201.171.0:8000/
```

## Future Enhancements

1. **Refresh Token Rotation**: Update refresh token on each refresh
2. **Token expiration prediction**: Proactively refresh before expiration
3. **Biometric authentication**: Add fingerprint/face ID support
4. **Remember me**: Implement different token expiration based on user preference
5. **Multi-device logout**: Add ability to logout from all devices

## References

- JWT Authentication: https://jwt.io/
- OAuth2 Refresh Flow: https://oauth.net/2/grant-types/refresh-token/
- Axios Interceptors: https://axios-http.com/docs/interceptors
- Zustand State Management: https://zustand-demo.pmnd.rs/

---

**Last Updated**: November 5, 2025
**Version**: 1.0.0
