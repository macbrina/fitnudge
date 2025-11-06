# 🏗️ Modular API Architecture - FitNudge Mobile

## ✅ **You're Absolutely Right!**

**Modular API structure with separate service files is the best practice for scalable applications.** Here's the organized structure I've implemented:

## 📁 **New File Structure**

```
src/
├── services/
│   └── api/
│       ├── base.ts              # Base API service class
│       ├── auth.ts              # Authentication service
│       ├── user.ts              # User management service
│       ├── goals.ts             # Goals service
│       ├── checkins.ts          # Check-ins service
│       ├── social.ts            # Social features service
│       └── index.ts             # Export all services
├── hooks/
│   └── api/
│       ├── useAuth.ts           # Auth-related hooks
│       ├── useUser.ts           # User-related hooks
│       ├── useGoals.ts          # Goals-related hooks
│       ├── useCheckIns.ts       # Check-ins-related hooks
│       ├── useSocial.ts         # Social-related hooks
│       └── index.ts             # Export all hooks
└── lib/
    └── routes.ts                # Centralized route definitions
```

## 🎯 **Benefits of Modular Structure**

### **1. Separation of Concerns**

- ✅ Each service handles one domain
- ✅ Easy to find and modify specific functionality
- ✅ Clear responsibility boundaries
- ✅ Reduced cognitive load

### **2. Scalability**

- ✅ Easy to add new services (e.g., `notifications.ts`, `analytics.ts`)
- ✅ Teams can work on different services independently
- ✅ Services can be tested in isolation
- ✅ Easy to refactor individual services

### **3. Maintainability**

- ✅ Smaller, focused files
- ✅ Clear import/export structure
- ✅ Easy to locate specific functionality
- ✅ Reduced merge conflicts

### **4. Reusability**

- ✅ Services can be used across different hooks
- ✅ Services can be used directly when needed
- ✅ Easy to create composite hooks
- ✅ Consistent API patterns

## 🔧 **Service Structure**

### **Base Service (`base.ts`)**

```typescript
export abstract class BaseApiService {
  // Common HTTP methods
  protected async get<T>(endpoint: string): Promise<ApiResponse<T>>;
  protected async post<T>(
    endpoint: string,
    data?: any
  ): Promise<ApiResponse<T>>;
  protected async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>>;
  protected async delete<T>(endpoint: string): Promise<ApiResponse<T>>;

  // Common utilities
  async isAuthenticated(): Promise<boolean>;
  async getAuthHeaders(): Promise<HeadersInit>;
}
```

### **Domain Services**

```typescript
// auth.ts
export class AuthService extends BaseApiService {
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>>;
  async signup(userData: SignupRequest): Promise<ApiResponse<LoginResponse>>;
  async logout(): Promise<ApiResponse>;
  // ... more auth methods
}

// user.ts
export class UserService extends BaseApiService {
  async getCurrentUser(): Promise<ApiResponse<User>>;
  async updateProfile(updates: UpdateUserRequest): Promise<ApiResponse<User>>;
  // ... more user methods
}
```

## 🎣 **Hook Organization**

### **Domain-Specific Hooks**

```typescript
// useAuth.ts
export const useLogin = () => {
  /* ... */
};
export const useSignup = () => {
  /* ... */
};
export const useLogout = () => {
  /* ... */
};

// useGoals.ts
export const useGoals = () => {
  /* ... */
};
export const useCreateGoal = () => {
  /* ... */
};
export const useUpdateGoal = () => {
  /* ... */
};
```

### **Query Key Organization**

```typescript
export const authQueryKeys = {
  isAuthenticated: ["auth", "isAuthenticated"] as const,
} as const;

export const goalsQueryKeys = {
  all: ["goals"] as const,
  list: () => [...goalsQueryKeys.all, "list"] as const,
  detail: (id: string) => [...goalsQueryKeys.all, "detail", id] as const,
} as const;
```

## 📱 **Usage Patterns**

### **Pattern 1: Direct Service Usage**

```tsx
import { authService, userService } from "../hooks/api";

const LoginScreen = () => {
  const handleLogin = async () => {
    const response = await authService.login({ email, password });
    // Handle response
  };
};
```

### **Pattern 2: React Query Hooks (Recommended)**

```tsx
import { useLogin, useCurrentUser } from "../hooks/api";

const LoginScreen = () => {
  const loginMutation = useLogin();
  const { data: user } = useCurrentUser();

  const handleLogin = async () => {
    await loginMutation.mutateAsync({ email, password });
  };
};
```

### **Pattern 3: Mixed Usage**

```tsx
import { useGoals, goalsService } from "../hooks/api";

const GoalsScreen = () => {
  const { data: goals } = useGoals();

  const handleDirectAction = async () => {
    // Use service directly for one-off actions
    await goalsService.archiveGoal(goalId);
  };
};
```

## 🔄 **Data Flow**

```
Component → Hook → Service → Base Service → Routes → Backend
    ↓         ↓        ↓           ↓          ↓
  UI State  Cache   Domain    HTTP Logic  Endpoint
```

## 🧪 **Testing Benefits**

### **Service Testing**

```typescript
// Easy to mock individual services
const mockAuthService = {
  login: jest.fn().mockResolvedValue({ data: mockUser }),
};

// Test services in isolation
test("AuthService.login should handle credentials", async () => {
  const authService = new AuthService();
  const result = await authService.login(credentials);
  expect(result.data).toBeDefined();
});
```

### **Hook Testing**

```typescript
// Easy to test hooks with specific services
test("useLogin should call authService.login", async () => {
  const { result } = renderHook(() => useLogin());
  await act(async () => {
    await result.current.mutateAsync(credentials);
  });
  expect(authService.login).toHaveBeenCalledWith(credentials);
});
```

## 📊 **Performance Benefits**

### **Code Splitting**

- Services can be lazy-loaded
- Hooks can be imported on-demand
- Smaller bundle sizes
- Better tree-shaking

### **Caching Strategy**

- Domain-specific cache invalidation
- Granular query key management
- Optimized re-renders
- Better memory management

## 🚀 **Adding New Features**

### **1. Add New Service**

```typescript
// services/api/notifications.ts
export class NotificationsService extends BaseApiService {
  async getNotifications(): Promise<ApiResponse<Notification[]>> {
    return this.get<Notification[]>("/notifications");
  }
}

export const notificationsService = new NotificationsService();
```

### **2. Add New Hooks**

```typescript
// hooks/api/useNotifications.ts
export const useNotifications = () => {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsService.getNotifications(),
  });
};
```

### **3. Export Everything**

```typescript
// services/api/index.ts
export * from "./notifications";

// hooks/api/index.ts
export * from "./useNotifications";
```

## 🎯 **Best Practices**

### **DO:**

- ✅ Keep services focused on single domains
- ✅ Use consistent naming conventions
- ✅ Export services as singletons
- ✅ Use TypeScript for all interfaces
- ✅ Organize query keys hierarchically
- ✅ Use React Query for state management
- ✅ Test services and hooks separately

### **DON'T:**

- ❌ Mix different domains in one service
- ❌ Create circular dependencies
- ❌ Hardcode endpoints in services
- ❌ Forget to export new services/hooks
- ❌ Use services directly in components (prefer hooks)
- ❌ Ignore error handling
- ❌ Skip testing

## 📈 **Scalability Examples**

### **Current Structure Supports:**

- ✅ 5 domain services (auth, user, goals, checkins, social)
- ✅ 50+ API endpoints
- ✅ 30+ React Query hooks
- ✅ Easy to add new domains

### **Future Additions:**

- 🔮 `notifications.ts` - Push notifications
- 🔮 `analytics.ts` - User analytics
- 🔮 `subscriptions.ts` - Payment handling
- 🔮 `media.ts` - File uploads
- 🔮 `admin.ts` - Admin functions

## 🎉 **Summary**

This modular architecture provides:

1. **Clear Organization**: Each domain has its own service and hooks
2. **Easy Maintenance**: Small, focused files
3. **Great Scalability**: Easy to add new features
4. **Better Testing**: Services and hooks can be tested independently
5. **Team Collaboration**: Multiple developers can work on different services
6. **Performance**: Better code splitting and caching
7. **Type Safety**: Full TypeScript support throughout

**This is exactly the right approach for a growing mobile application!** 🚀
