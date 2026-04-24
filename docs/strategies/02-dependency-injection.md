# Strategy: Dependency Injection & Container Pattern

Dependencies are wired manually. There is no DI framework (no InversifyJS, no tsyringe). Each module has a `<module>.container.ts` file that constructs and connects instances.

---

## Container Pattern

A container file does three things:
1. Imports all the dependencies the module needs.
2. Instantiates the repository and service, passing dependencies as constructor arguments.
3. Instantiates the controller, passing the service.
4. Exports the controller (routes import the controller, not the service or repository directly).

Routes import the controller from the container, call its methods, and never touch the service or repository themselves.

---

## Circular Dependency Problem

Many services depend on each other. For example:
- `BookingService` depends on `PaymentService`, `ShopService`, `BarberService`, `UserService`, `VendorService`, `FelboCoinService`, and `IssueService`.
- `VendorService` depends on `BookingService`.
- `IssueService` depends on `BookingService` and `VendorService`.

In Node.js, circular imports (`A imports B, B imports A`) can produce `undefined` values at module load time if the modules are not fully evaluated when the circular reference is resolved. This causes subtle runtime errors.

---

## Lazy Getter Pattern (the solution)

Instead of passing service instances directly in constructors, services pass **factory functions** for their cross-module dependencies:

```typescript
// Instead of:
constructor(private readonly bookingService: BookingService) {}

// The pattern used:
constructor(private readonly getBookingService: () => BookingService) {}

private get bookingService(): BookingService {
  return this.getBookingService();
}
```

In the container, the factory function closes over the other module's container reference:

```typescript
// In vendor.container.ts:
const vendorService = new VendorService(
  vendorRepository,
  otpService,
  ...,
  () => bookingContainer.bookingService,  // lazy — evaluated at call time, not at construction time
);
```

By the time `getBookingService()` is first called (at runtime, during an actual request), both containers have finished loading. The circularity is resolved because the getter is evaluated lazily, not at import time.

The private getter property (`get bookingService()`) is a convenience so that call sites within the service can write `this.bookingService.someMethod()` rather than `this.getBookingService().someMethod()`.

---

## Constructor Parameter Rule

Parameters that are only used to store the factory function (`private readonly getFoo: () => Foo`) must have `private readonly` on the constructor parameter because they are stored on the instance. However, if a parameter is used only within the constructor body (e.g., to set up a client), it must **not** use `private readonly` — it should not be stored.

---

## Why Not a DI Framework?

- The module count is stable and small enough that manual wiring is readable.
- Framework-based DI adds decorator metadata and reflection overhead.
- The lazy getter pattern solves the only hard problem (circular deps) with zero runtime overhead.
- Explicit wiring in container files makes the dependency graph easy to trace — just read the constructor calls.

---

## Module Boundaries

Modules never import another module's repository directly. Cross-module data access always goes through the owning service. This keeps the repository as an implementation detail of the module.

The only deliberate exception: `PaymentService` receives `() => BookingRepository` (not `BookingService`) because it needs only a single write operation on the booking from within a webhook context, and introducing the full `BookingService` would create a heavier cycle.
