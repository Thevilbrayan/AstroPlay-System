
## 6. Database Schema & Security Improvements (PocketBase)

We performed a deep restructure of the PocketBase configuration file `pocketbase_schema.json` to reflect enterprise-level auditing and data integrity patterns.

### ✅ Schema Refinements
*   **`sessions`**: Added tracking for `bracelet_id` and `actual_exit_time`. Bound relation `child` to strictly one entity (`maxSelect: 1`) to prevent data race conditions.
*   **`sales`**: Added explicit enumeration for `status` (completed, cancelled, refunded).
*   **`workstations`**: Added programmatic `slug` ID for frontend configuration mapping.
*   **`parents`**: Generated a unique SQL index exclusively on `card_id` (`CREATE UNIQUE INDEX idx_parents_card_id...`) to boost lookup speed upon scanning.

### ✅ Strict API Rule Adjustments
To ensure financial locks and operation auditing:
*   **Inventory Logs (`inventory_logs`)**: Entirely locked down update/delete operations (`null`) to create an immutable audit trail.
*   **Sales & Financials (`sales`, `cash_movements`, `sales_items`)**: Bound Delete operations solely to the `@request.auth.role = "admin"` constraint.
*   **Session State**: Verified integrity boundaries for session flow. Operators can create, but only admins can wipe records entirely.

> [!IMPORTANT]
> Because the schema data model (like adding `bracelet_id` to `sessions`) was modified directly in the JSON, you will need to re-import or push this configuration to your active PocketBase server.
>
> To do this, review the changes in `pocketbase_schema.json` and deploy them via the PocketBase admin UI (Import Schema) or restart your PB executable if it's set to auto-migrate. You may also want to run type generation bindings again.
