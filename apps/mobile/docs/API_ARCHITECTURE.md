# 🏗️ API Architecture Guide - FitNudge Mobile

## ✅ **Recommended Approach: Centralized API Service Layer**

### **Why This Approach?**

1. **Single Source of Truth**: All API endpoints defined in `routes.ts`
2. **Consistency**: Same endpoints used across web and mobile
3. **Maintainability**: Easy to update endpoints in one place
4. **Type Safety**: Full TypeScript support
5. **Error Handling**: Centralized error management
6. **Token Management**: Automatic JWT handling
7. **Testing**: Easy to mock and test

## 📁 **File Structure**

```
src/
├── lib/
│   └── routes.ts              # Centralized route definitions
├── services/
│   └── api.ts                 # Main API service class
├── hooks/
│   └── useApi.ts              # React Query hooks
└── components/
    └── examples/
        └── ApiUsageExample.tsx # Usage examples
```

## 🔧 **Implementation**

### **1. Centralized Routes (`routes.ts`)**

```typescript
export const ROUTES = {
  AUTH: {
    LOGIN: "/auth/login",
    SIGNUP: "/auth/signup",
    LOGOUT: "/auth/logout",
    REFRESH: "/auth/refresh",
  },
  GOALS: {
    LIST: "/goals",
    CREATE: "/goals",
    UPDATE: (id: string) => `/goals/${id}`,
    DELETE: (id: string) => `/goals/${id}`,
  },
  // ... more routes
} as const;
```

### **2. API Service (`api.ts`)**

```typescript
class ApiService {
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const response = await this.post<LoginResponse>(
      ROUTES.AUTH.LOGIN,
      credentials
    );
    // Handle tokens, errors, etc.
    return response;
  }
}

export const apiService = new ApiService();
```

### **3. React Query Hooks (`useApi.ts`)**

```typescript
export const useLogin = () => {
  return useMutation({
    mutationFn: (credentials: LoginRequest) => apiService.login(credentials),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
};
```

## 🎯 **Usage Patterns**

### **Pattern 1: Direct API Service (Simple)**

```tsx
const LoginScreen = () => {
  const handleLogin = async () => {
    const response = await apiService.login({ email, password });
    if (response.data) {
      // Handle success
    } else {
      // Handle error
    }
  };
};
```

### **Pattern 2: React Query Hooks (Recommended)**

```tsx
const LoginScreen = () => {
  const loginMutation = useLogin();

  const handleLogin = async () => {
    try {
      await loginMutation.mutateAsync({ email, password });
      // Success handled automatically
    } catch (error) {
      // Error handled automatically
    }
  };
};
```

### **Pattern 3: React Query Queries (Data Fetching)**

```tsx
const GoalsScreen = () => {
  const { data: goals, isLoading, error } = useGoals();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage />;

  return <GoalsList goals={goals} />;
};
```

## 🔄 **Data Flow**

```
Component → React Query Hook → API Service → Routes → Backend
    ↓              ↓              ↓           ↓
  UI State    Cache Management  HTTP Logic  Endpoint
```

## 🛡️ **Benefits**

### **Centralized Management**

- ✅ All endpoints in one place
- ✅ Easy to update URLs
- ✅ Consistent naming
- ✅ Type safety

### **Error Handling**

- ✅ Centralized error processing
- ✅ Consistent error responses
- ✅ Automatic retry logic
- ✅ Network error handling

### **Token Management**

- ✅ Automatic JWT handling
- ✅ Token refresh logic
- ✅ Secure storage
- ✅ Logout cleanup

### **Caching & Performance**

- ✅ React Query caching
- ✅ Background refetching
- ✅ Optimistic updates
- ✅ Request deduplication

## 📱 **Mobile-Specific Features**

### **Platform Detection**

```typescript
const baseURL = Platform.select({
  ios: "http://localhost:54321/api/v1",
  android: "http://10.0.2.2:54321/api/v1",
  default: "http://localhost:54321/api/v1",
});
```

### **Offline Support**

- React Query provides offline caching
- Automatic retry on network recovery
- Background sync when online

### **Performance**

- Request timeouts
- Request cancellation
- Memory management
- Background processing

## 🧪 **Testing**

### **Mock API Service**

```typescript
const mockApiService = {
  login: jest.fn().mockResolvedValue({ data: mockUser }),
  getGoals: jest.fn().mockResolvedValue({ data: mockGoals }),
};
```

### **Test Components**

```typescript
test('should login user', async () => {
  render(<LoginScreen />);
  fireEvent.press(screen.getByText('Login'));
  expect(mockApiService.login).toHaveBeenCalledWith(credentials);
});
```

## 🚀 **Best Practices**

### **DO:**

- ✅ Use centralized routes
- ✅ Use React Query for state management
- ✅ Handle loading and error states
- ✅ Implement proper TypeScript types
- ✅ Test your API calls
- ✅ Use optimistic updates where appropriate

### **DON'T:**

- ❌ Hardcode API endpoints in components
- ❌ Make direct fetch calls everywhere
- ❌ Ignore error handling
- ❌ Forget to clean up on logout
- ❌ Mix different API patterns in the same app

## 📊 **Performance Considerations**

### **Caching Strategy**

- **User data**: 5 minutes
- **Goals**: 2 minutes
- **Check-ins**: 1 minute
- **Feed**: 30 seconds

### **Request Optimization**

- Automatic request deduplication
- Background refetching
- Stale-while-revalidate pattern
- Optimistic updates

## 🔧 **Configuration**

### **Environment Variables**

```typescript
const API_CONFIG = {
  baseURL: process.env.EXPO_PUBLIC_API_URL || "http://localhost:54321/api/v1",
  timeout: 10000,
  retryAttempts: 3,
};
```

### **Development vs Production**

- Development: Local Supabase instance
- Production: Supabase cloud instance
- Staging: Separate environment config

## 📈 **Monitoring & Analytics**

### **Request Tracking**

- Automatic request/response logging
- Error tracking with Sentry
- Performance monitoring
- User behavior analytics

### **Debugging**

- Network request inspection
- Error boundary implementation
- Development-only logging
- React Query DevTools

This architecture provides a robust, scalable, and maintainable foundation for your FitNudge mobile app's API interactions! 🎉
