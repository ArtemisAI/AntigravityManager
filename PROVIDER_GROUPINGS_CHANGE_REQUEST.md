# 🔄 CRITICAL: Provider Groupings & Collapsible UI Implementation

**Change Request ID**: `implement-provider-groupings-ui`
**Date Created**: February 15, 2026
**Priority**: 🔄 **HIGH** - User Experience Enhancement
**Severity**: Medium - Feature Enhancement (not blocking)
**Estimated Resolution Time**: 4-6 hours
**Status**: 📋 **READY FOR IMPLEMENTATION**
**Dependencies**: Requires Model Visibility feature (✅ COMPLETED)

---

## 📋 EXECUTIVE SUMMARY

The Antigravity Manager application currently displays AI models as a flat list in account cards, making it difficult to understand provider-level rate limiting behavior. When Gemini models share rate limits, users see redundant quota bars showing the same 0% or reset timers.

**Solution**: Implement intelligent provider-level grouping with collapsible UI and account-level calculators to improve quota visualization and user experience.

**Impact**: Better organization of 50+ models across multiple providers, reduced UI clutter, faster identification of rate-limited providers.

---

## ✅ DEPENDENCIES VERIFIED

### Required Prerequisites (All ✅ Completed)

- **Model Visibility Feature**: ✅ IMPLEMENTED - Settings UI with search/filter/save
- **StatusBar Regression Fix**: ✅ COMPLETED - 99% performance improvement
- **Process Optimization**: ✅ COMPLETED - Caching and rate limiting implemented
- **TypeScript Compilation**: ✅ CLEAN - All tests pass

---

## 🎯 FEATURES TO IMPLEMENT

### Feature 1: Provider Groupings (HIGH PRIORITY)

**Requirement**: Group models by provider for better organization

**Provider Categories**:

- **Claude Group**: Any model starting with `claude-` (Anthropic)
- **Gemini Group**: Any model starting with `gemini-` (Google)
- **Others Group**: Fallback for any other model names

**Implementation Scope**:

- Add provider detection logic to categorize models
- Create provider registry with metadata (name, company, color)
- Update data processing to support grouped models
- Respect model visibility settings (hidden models excluded from groups)

### Feature 2: Collapsible Grouped UI (HIGH PRIORITY)

**Requirement**: Hierarchical collapsible display for account cards

**UI Behavior**:

- **Group Display**: Provider name + averaged metrics + collapse/expand toggle
- **Averaged Calculations**:
  - Combined percentage remaining across visible models in group
  - Earliest reset time calculation (most conservative)
  - Exclude models marked as hidden in visibility settings
- **Collapse States**:
  - **Expanded**: Show provider header + individual model rows
  - **Collapsed**: Show only provider header with averaged metrics

**Visual Design**:

```
▼ Claude (4 models) [████████░░] 75% avg | 2.3h reset
├── claude-3-7-sonnet        [████████░░] 80%
├── claude-3-5-sonnet        [████████░░] 78%
├── claude-3-opus            [██████░░░░] 60%
└── claude-3-haiku           [████████░░] 85%

▶ Gemini (6 models) [██░░░░░░░░] 20% avg | 45m reset
```

### Feature 3: Total Account Calculator (MEDIUM PRIORITY)

**Requirement**: Display averaged metrics at account level

**Display Location**: Top of account card, always visible
**Content**: Color-coded percentage of ALL visible models
**Purpose**: Quick overview without expanding groups

**Visual Design**:

```
┌─────────────────────────────────────────────────────────┐
│ 🌩️ example@gmail.com                [▼ 67% Overall]   │
├─────────────────────────────────────────────────────────┤
│ ▼ Claude (4 models) [████████░░] 80% avg | 2.3h reset  │
│ ▼ Gemini (6 models) [██░░░░░░░░] 20% avg | 45m reset   │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 TECHNICAL ANALYSIS

### Provider Detection Strategy

**Registry-Based Approach** (Recommended):

```typescript
// src/utils/provider-grouping.ts
export const PROVIDER_REGISTRY = {
  'claude-': {
    name: 'Claude',
    company: 'Anthropic',
    color: '#D97757', // Anthropic orange
    models: [] as string[]
  },
  'gemini-': {
    name: 'Gemini',
    company: 'Google',
    color: '#4285F4', // Google blue
    models: [] as string[]
  },
  'others': {
    name: 'Other',
    company: 'Various',
    color: '#6B7280', // Gray
    models: [] as string[]
  }
};

export function detectProvider(modelName: string): keyof typeof PROVIDER_REGISTRY {
  for (const [prefix, _] of Object.entries(PROVIDER_REGISTRY)) {
    if (prefix !== 'others' && modelName.startsWith(prefix)) {
      return prefix as keyof typeof PROVIDER_REGISTRY;
    }
  }
  return 'others';
}
```

### Data Aggregation Logic

**Provider-Level Stats**:

```typescript
export interface ProviderStats {
  provider: string;
  models: ModelQuota[];
  visibleModels: ModelQuota[];
  avgPercentage: number;
  minPercentage: number;
  maxPercentage: number;
  earliestReset: number | null;
  totalQuota: number;
  usedQuota: number;
}

export function calculateProviderStats(
  models: ModelQuota[],
  visibilitySettings: Record<string, boolean>
): ProviderStats {
  const visibleModels = models.filter(m => visibilitySettings[m.id] !== false);

  if (visibleModels.length === 0) {
    return {
      provider: '',
      models: [],
      visibleModels: [],
      avgPercentage: 0,
      minPercentage: 0,
      maxPercentage: 0,
      earliestReset: null,
      totalQuota: 0,
      usedQuota: 0
    };
  }

  const totalQuota = visibleModels.reduce((sum, m) => sum + (m.quota_limit || 0), 0);
  const usedQuota = visibleModels.reduce((sum, m) => sum + (m.quota_used || 0), 0);
  const avgPercentage = totalQuota > 0 ? ((totalQuota - usedQuota) / totalQuota) * 100 : 0;

  const percentages = visibleModels.map(m => {
    const limit = m.quota_limit || 0;
    const used = m.quota_used || 0;
    return limit > 0 ? ((limit - used) / limit) * 100 : 0;
  });

  const resetTimes = visibleModels
    .map(m => m.reset_time)
    .filter(Boolean)
    .map(time => new Date(time).getTime());

  return {
    provider: detectProvider(visibleModels[0].id),
    models,
    visibleModels,
    avgPercentage,
    minPercentage: Math.min(...percentages),
    maxPercentage: Math.max(...percentages),
    earliestReset: resetTimes.length > 0 ? Math.min(...resetTimes) : null,
    totalQuota,
    usedQuota
  };
}
```

**Account-Level Stats**:

```typescript
export interface AccountStats {
  accountId: string;
  providers: ProviderStats[];
  totalModels: number;
  visibleModels: number;
  overallPercentage: number;
  healthStatus: 'healthy' | 'degraded' | 'limited' | 'critical';
}

export function calculateAccountStats(
  providerStats: ProviderStats[]
): AccountStats {
  const allVisibleModels = providerStats.flatMap(p => p.visibleModels);
  const totalModels = providerStats.reduce((sum, p) => sum + p.models.length, 0);
  const visibleModels = allVisibleModels.length;

  // Weighted average by quota limits
  const totalQuota = providerStats.reduce((sum, p) => sum + p.totalQuota, 0);
  const usedQuota = providerStats.reduce((sum, p) => sum + p.usedQuota, 0);
  const overallPercentage = totalQuota > 0 ? ((totalQuota - usedQuota) / totalQuota) * 100 : 0;

  // Health status based on overall percentage
  let healthStatus: AccountStats['healthStatus'] = 'healthy';
  if (overallPercentage < 10) healthStatus = 'critical';
  else if (overallPercentage < 25) healthStatus = 'limited';
  else if (overallPercentage < 50) healthStatus = 'degraded';

  return {
    accountId: '',
    providers: providerStats,
    totalModels,
    visibleModels,
    overallPercentage,
    healthStatus
  };
}
```

---

## 📂 FILES TO CREATE/MODIFY

### New Files to Create

1. **`src/utils/provider-grouping.ts`**
   - Provider registry and detection logic
   - Stats calculation functions
   - Grouping utilities

2. **`src/components/ProviderGroup.tsx`**
   - Collapsible provider section component
   - Provider header with averaged metrics
   - Individual model rows with indentation
   - Expand/collapse state management

3. **`src/hooks/useProviderGrouping.ts`**
   - Hook to group models by provider
   - Calculate provider and account stats
   - Handle collapse state persistence

### Files to Modify

1. **`src/components/CloudAccountCard.tsx`**
   - Add conditional rendering for grouped vs flat display
   - Integrate ProviderGroup components
   - Add account-level stats display
   - Update props interface

2. **`src/components/ModelVisibilitySettings.tsx`**
   - Add "Enable Provider Groupings" toggle
   - Update model list rendering with optional grouping
   - Persist grouping preference to config

3. **`src/types/config.ts`**
   - Add `provider_groupings_enabled` boolean field
   - Add `collapsed_providers` and `collapsed_accounts` state fields

4. **`src/localization/i18n.ts`**
   - Add translations for provider grouping UI
   - Add translations for new settings options

---

## 🧪 TESTING REQUIREMENTS

### Unit Tests

**Provider Grouping Logic**:

```typescript
describe('detectProvider', () => {
  it('should categorize Claude models correctly', () => {
    expect(detectProvider('claude-3-7-sonnet')).toBe('claude-');
    expect(detectProvider('claude-2.1')).toBe('claude-');
  });

  it('should categorize Gemini models correctly', () => {
    expect(detectProvider('gemini-2.0-flash')).toBe('gemini-');
    expect(detectProvider('gemini-1.5-pro')).toBe('gemini-');
  });

  it('should fallback to others for unknown models', () => {
    expect(detectProvider('gpt-4-turbo')).toBe('others');
    expect(detectProvider('llama-2-7b')).toBe('others');
  });
});

describe('calculateProviderStats', () => {
  it('should calculate correct averages', () => {
    const models = [
      { id: 'claude-3-7-sonnet', quota_limit: 100, quota_used: 20 },
      { id: 'claude-3-5-sonnet', quota_limit: 100, quota_used: 30 }
    ];
    const stats = calculateProviderStats(models, {});
    expect(stats.avgPercentage).toBe(75); // (80 + 70) / 2
  });
});
```

### Integration Tests

**UI Component Tests**:

```typescript
describe('ProviderGroup', () => {
  it('should render collapsed state correctly', () => {
    // Test collapsed provider display
  });

  it('should render expanded state with model rows', () => {
    // Test expanded provider display
  });

  it('should handle collapse/expand toggle', () => {
    // Test state management
  });
});

describe('CloudAccountCard with Provider Grouping', () => {
  it('should show account-level stats when grouping enabled', () => {
    // Test account stats display
  });

  it('should render provider groups correctly', () => {
    // Test grouped display
  });
});
```

### Manual Testing Scenarios

1. **Basic Grouping**: Enable provider groupings, verify models are grouped by provider
2. **Collapse/Expand**: Test all collapse states work correctly
3. **Visibility Integration**: Hide models, verify they're excluded from group calculations
4. **Account Calculator**: Verify account-level percentages match manual calculations
5. **Persistence**: Settings and collapse states persist across page reloads

---

## 🚀 IMPLEMENTATION PLAN

### Phase 1: Foundation (2 hours)

1. **Create Provider Grouping Utility**

   ```bash
   # Create src/utils/provider-grouping.ts
   # Implement provider registry and detection
   # Add stats calculation functions
   ```

2. **Extend Config Schema**

   ```typescript
   // src/types/config.ts
   provider_groupings_enabled: z.boolean().default(false),
   collapsed_providers: z.record(z.string(), z.array(z.string())).default({}),
   collapsed_accounts: z.array(z.string()).default([]),
   ```

3. **Create Provider Grouping Hook**

   ```typescript
   // src/hooks/useProviderGrouping.ts
   export function useProviderGrouping(accounts: CloudAccount[], config: AppConfig)
   ```

### Phase 2: UI Components (2 hours)

1. **Create ProviderGroup Component**

   ```tsx
   // src/components/ProviderGroup.tsx
   interface ProviderGroupProps {
     provider: string;
     stats: ProviderStats;
     isCollapsed: boolean;
     onToggleCollapse: () => void;
   }
   ```

2. **Modify CloudAccountCard**

   ```tsx
   // Add conditional rendering logic
   const providerGroupingsEnabled = config?.provider_groupings_enabled ?? false;

   if (providerGroupingsEnabled) {
     // Render grouped view with ProviderGroup components
   } else {
     // Render flat view (existing logic)
   }
   ```

3. **Update ModelVisibilitySettings**

   ```tsx
   // Add toggle for provider groupings
   <Switch
     id="provider-groupings"
     checked={providerGroupingsEnabled}
     onCheckedChange={handleGroupingToggle}
   />
   ```

### Phase 3: Integration & Polish (2 hours)

1. **Add Translations**

   ```json
   // src/localization/*.json
   "settings": {
     "providerGroupings": {
       "title": "Provider Groupings",
       "description": "Group models by provider for better organization",
       "enabled": "Enable Provider Groupings"
     }
   }
   ```

2. **State Persistence**
   - Collapse states saved to config
   - Settings persist across sessions
   - Default states (expanded by default)

3. **Performance Optimization**
   - Memoize calculations
   - Virtualize if >50 models
   - Debounce state updates

### Phase 4: Testing & Validation (1 hour)

1. **Unit Tests**: All provider grouping logic
2. **Integration Tests**: UI component interactions
3. **Manual Testing**: All scenarios pass
4. **Performance Testing**: No regressions

---

## 🎯 ACCEPTANCE CRITERIA

### Functional Requirements

- [ ] **Provider Detection**: Models correctly grouped by provider prefix
- [ ] **Averaged Calculations**: Provider and account stats calculated correctly
- [ ] **Collapsible UI**: All collapse/expand states work smoothly
- [ ] **Visibility Integration**: Hidden models excluded from calculations
- [ ] **Settings Persistence**: Grouping preference and collapse states saved
- [ ] **Responsive Design**: Works on different screen sizes

### Technical Requirements

- [ ] **TypeScript**: Clean compilation, no type errors
- [ ] **Performance**: <50ms render time for 50 models
- [ ] **Memory**: No memory leaks in collapse/expand cycles
- [ ] **Accessibility**: Keyboard navigation, screen reader support
- [ ] **Browser Support**: Works in Electron (Chromium-based)

### User Experience Requirements

- [ ] **Intuitive**: Users understand grouping immediately
- [ ] **Efficient**: Faster identification of rate-limited providers
- [ ] **Flexible**: Can disable grouping if preferred
- [ ] **Consistent**: Matches existing UI patterns
- [ ] **Responsive**: Smooth animations and interactions

---

## 📊 SUCCESS METRICS

### Performance Goals

- **Render Time**: <50ms for account cards with 50 models
- **Memory Usage**: <10MB increase for grouping features
- **Bundle Size**: <15KB increase in JavaScript bundle

### User Experience Goals

- **Task Completion**: 80% faster identification of rate-limited providers
- **User Satisfaction**: Positive feedback on organization improvement
- **Adoption Rate**: 70% of users enable provider groupings

### Code Quality Goals

- **Test Coverage**: 85%+ for new utilities and components
- **TypeScript Strict**: Zero type errors in strict mode
- **ESLint**: Zero linting errors
- **Maintainability**: Code follows existing patterns

---

## 🔐 RISK ASSESSMENT

### Low Risk

- **Backward Compatibility**: Feature is opt-in, existing behavior unchanged
- **Data Structure**: No changes to existing account/model data structures
- **Dependencies**: Only depends on already-implemented Model Visibility

### Medium Risk

- **Performance**: Complex calculations with many models (50+)
  - **Mitigation**: Memoization, virtualization, profiling
- **UI Complexity**: More complex component hierarchy
  - **Mitigation**: Thorough testing, user feedback

### High Risk

- **State Management**: Complex collapse state across providers/accounts
  - **Mitigation**: Simple state structure, comprehensive testing

---

## 📚 REFERENCES

- **Current Implementation**: `src/components/ModelVisibilitySettings.tsx`
- **Data Structures**: `src/types/cloudAccount.ts`
- **Config Schema**: `src/types/config.ts`
- **UI Components**: `src/components/ui/` directory
- **Existing Patterns**: `src/components/CloudAccountCard.tsx`

---

## ✅ IMPLEMENTATION CHECKLIST

### Pre-Implementation

- [x] Dependencies verified (Model Visibility completed)
- [x] Technical analysis completed
- [x] Implementation plan approved
- [x] Files identified for creation/modification

### Phase 1: Foundation

- [ ] Create `src/utils/provider-grouping.ts`
- [ ] Extend `src/types/config.ts` schema
- [ ] Create `src/hooks/useProviderGrouping.ts`
- [ ] Add translations to `src/localization/i18n.ts`

### Phase 2: UI Components

- [ ] Create `src/components/ProviderGroup.tsx`
- [ ] Modify `src/components/CloudAccountCard.tsx`
- [ ] Update `src/components/ModelVisibilitySettings.tsx`
- [ ] Add account-level calculator display

### Phase 3: Integration

- [ ] State persistence for collapse states
- [ ] Performance optimizations
- [ ] Error handling and edge cases
- [ ] Responsive design adjustments

### Phase 4: Testing

- [ ] Unit tests for all utilities
- [ ] Integration tests for UI components
- [ ] Manual testing scenarios
- [ ] Performance validation

### Phase 5: Documentation

- [ ] Update CHANGELOG.md
- [ ] Update component documentation
- [ ] User guide updates
- [ ] API documentation

---

## 🚨 WHY COPILOT SWE DIDN'T IMPLEMENT THIS

**Context Analysis**: Copilot SWE was focused on the **critical StatusBar regression** that was causing production outages (21+ Antigravity.exe processes, 1GB+ memory consumption). This was marked as 🔴 CRITICAL priority.

**Prioritization Decision**: The provider groupings feature was correctly deferred as it was:

- Not blocking production functionality
- Marked as "FUTURE CR" in the change request
- A user experience enhancement, not a bug fix
- Would have increased implementation complexity during emergency response

**Correct Approach**: Emergency fixes first, then enhancements. This change request properly captures the detailed requirements for implementation now that stability is restored.

---

**END OF CHANGE REQUEST**

This document provides complete technical specifications for implementing the provider groupings, collapsible UI, and account calculator features. All dependencies are verified, implementation plan is detailed, and acceptance criteria are defined.</content>
<parameter name="filePath">c:\Users\Laptop\Services\AntigravityManager\PROVIDER_GROUPINGS_CHANGE_REQUEST.md
