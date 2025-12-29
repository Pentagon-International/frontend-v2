# Authentication Flow - Quick Start Guide

## 🚀 Quick Start

The authentication flow is **already implemented and ready to use**. No additional setup required!

## ✅ What's Already Done

1. ✅ Token storage in localStorage
2. ✅ Automatic token refresh on 401 errors
3. ✅ Request retry with new tokens
4. ✅ Request queuing during refresh
5. ✅ Smart logout on refresh token expiration
6. ✅ Error handling for all scenarios

## 📋 How to Use

### Login

```typescript
import useAuthStore from "./store/authStore";

// In your login component
const handleLogin = async (credentials) => {
  const response = await apiCall.post("/accounts/login/", credentials);

  // Store authentication data
  useAuthStore.getState().login(response);

  // User is now authenticated!
  navigate("/dashboard");
};
```

### Make Protected API Calls

```typescript
import { apiCallProtected } from "./api/axios";

// Just use it normally - everything is automatic!
const fetchCustomers = async () => {
  try {
    const data = await apiCallProtected.get(
      "/customer_master/customer-master/"
    );
    console.log(data);
  } catch (error) {
    console.error(error.message);
  }
};
```

### Logout

```typescript
import useAuthStore from "./store/authStore";

const handleLogout = () => {
  useAuthStore.getState().logout();
  // User is logged out and redirected to login page
};
```

### Check Authentication Status

```typescript
import useAuthStore from './store/authStore';

const MyComponent = () => {
  const { user, accessToken } = useAuthStore();

  if (!accessToken) {
    return <Navigate to="/login" />;
  }

  return <div>Welcome, {user?.full_name}!</div>;
};
```

## 🔄 What Happens Automatically

### When Access Token Expires

1. API returns 401
2. System automatically calls refresh token API
3. Gets new access token
4. Updates localStorage
5. Retries the original request
6. Returns data to your component
7. **User doesn't notice anything!**

### When Refresh Token Expires

1. Refresh API returns 401
2. System clears all tokens
3. Shows toast: "Session expired"
4. Redirects to login page
5. User logs in again

## 🎯 Key Points

### ✅ DO:

- Use `apiCallProtected` for authenticated endpoints
- Use `apiCall` for public endpoints (login, etc.)
- Handle errors in your components
- Let the interceptors manage tokens

### ❌ DON'T:

- Manually add Authorization headers (interceptor does this)
- Manually handle 401 errors (interceptor does this)
- Manually refresh tokens (interceptor does this)
- Store tokens in component state (use authStore)

## 🔍 Debugging

### Check if User is Logged In

```javascript
// In browser console
localStorage.getItem("accessToken"); // Should return a JWT token
localStorage.getItem("refreshToken"); // Should return a JWT token
```

### Monitor Token Refresh

1. Open browser DevTools
2. Go to Network tab
3. Make API calls
4. Look for `token/refresh` requests
5. Should see original request retry after refresh

### Clear Tokens (Force Logout)

```javascript
// In browser console
useAuthStore.getState().logout();
```

## 📊 Testing Scenarios

### Test 1: Normal Usage

```typescript
// Just use the API normally
const data = await apiCallProtected.get("/endpoint");
// Works seamlessly!
```

### Test 2: Token Expiration

```typescript
// Delete access token to simulate expiration
localStorage.removeItem("accessToken");

// Make API call
const data = await apiCallProtected.get("/endpoint");

// Check: New token should be in localStorage
console.log(localStorage.getItem("accessToken")); // New token!

// Check: Request should succeed
console.log(data); // Your data!
```

### Test 3: Refresh Token Expiration

```typescript
// Set invalid refresh token
localStorage.setItem("refreshToken", "invalid_token");

// Make API call
const data = await apiCallProtected.get("/endpoint");

// Result: Logged out and redirected to login
```

## 🛠️ Configuration

### Environment Variable (Already Set)

```env
VITE_API_BASE_URL=http://13.201.171.0:8000/
```

### API Endpoints Used

- Login: `POST /accounts/login/`
- Refresh: `POST /api/token/refresh/`

## 📝 Example Component

```typescript
import { useState, useEffect } from 'react';
import { apiCallProtected } from '../api/axios';
import useAuthStore from '../store/authStore';

const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Token refresh happens automatically if needed!
      const data = await apiCallProtected.get('/customer_master/customer-master/');

      setCustomers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Welcome, {user?.full_name}</h1>
      <h2>Customers</h2>
      <ul>
        {customers.map(customer => (
          <li key={customer.id}>{customer.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default CustomersPage;
```

## 🎨 User Experience

### Before Implementation

- User makes API call
- Token expired
- ❌ Request fails
- ❌ User sees error
- ❌ Must login again

### After Implementation

- User makes API call
- Token expired
- ✅ Automatic refresh
- ✅ Request succeeds
- ✅ User sees data
- 😊 Seamless experience!

## 🔐 Security Features

1. **Automatic Token Refresh** - No expired tokens in use
2. **Request Queuing** - Prevents multiple refresh calls
3. **Infinite Loop Prevention** - `_retry` flag
4. **Smart Logout** - Only when refresh token expires
5. **Error Handling** - Graceful degradation

## 📚 More Information

- **Detailed Documentation**: `AUTHENTICATION_FLOW_GUIDE.md`
- **Implementation Details**: `AUTHENTICATION_IMPLEMENTATION_SUMMARY.md`
- **Visual Diagrams**: `AUTH_FLOW_DIAGRAMS.md`

## ⚡ TL;DR

1. Use `apiCallProtected` for authenticated API calls
2. Everything else is automatic
3. Token refresh happens seamlessly
4. Users never see token expiration
5. Only logout when refresh token expires

## 🆘 Need Help?

1. Check browser console for errors
2. Check Network tab for failed requests
3. Verify tokens in localStorage
4. Read the detailed documentation
5. Check the visual diagrams

---

**Status**: ✅ Ready to Use
**Last Updated**: November 5, 2025

**Remember**: You don't need to do anything special. Just use `apiCallProtected` for your API calls and the system handles everything automatically! 🎉
