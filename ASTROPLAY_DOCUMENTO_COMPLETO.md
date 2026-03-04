# ASTROPLAY SYSTEM — DOCUMENTO EXHAUSTIVO DE ANÁLISIS
**Versión del documento:** 1.0 — Marzo 2026
**Tipo de sistema:** Software de Gestión para Centro de Entretenimiento Infantil
**Stack tecnológico:** Tauri 2 + React 19 + TypeScript + PocketBase

---

## ÍNDICE

1. [Modelo de Negocio](#1-modelo-de-negocio)
2. [Arquitectura General del Sistema](#2-arquitectura-general-del-sistema)
3. [Estructura de Carpetas y Archivos](#3-estructura-de-carpetas-y-archivos)
4. [Esquema de Base de Datos (Colecciones PocketBase)](#4-esquema-de-base-de-datos)
5. [Modelo de Datos — Interfaces TypeScript](#5-modelo-de-datos)
6. [Gestión de Estado — Zustand Stores](#6-gestión-de-estado)
7. [Jerarquía de Componentes UI](#7-jerarquía-de-componentes-ui)
8. [Control de Acceso y Seguridad](#8-control-de-acceso-y-seguridad)
9. [Flujos Operativos Completos](#9-flujos-operativos-completos)
10. [Módulos Administrativos](#10-módulos-administrativos)
11. [Sistema Financiero (Caja y Auditoría)](#11-sistema-financiero)
12. [Sistema de Reportes e Inteligencia de Negocio](#12-sistema-de-reportes)
13. [Integración de Hardware](#13-integración-de-hardware)
14. [Configuración Global del Sistema](#14-configuración-global)
15. [Stack Técnico Detallado](#15-stack-técnico)
16. [Variables de Entorno y Configuración](#16-variables-de-entorno)
17. [Análisis de Riesgos y Áreas de Mejora](#17-análisis-de-riesgos)

---

## 1. MODELO DE NEGOCIO

### 1.1 Descripción del Negocio

AstroPlay es un **centro de entretenimiento infantil** (tipo parque de juegos / arcade familiar) que opera con:

- **Sesiones de tiempo** de juego para niños (tipo "boletos de tiempo")
- **Alquiler de karts / gokarts** como atracción premium
- **Servicio de tren** (atracción de paseo)
- **Punto de Venta (TPV/POS)** de snacks, bebidas y calcetines antideslizantes
- **CRM básico** de familias: padres, hijos, visitas y puntos de lealtad

### 1.2 Actores del Sistema

| Actor | Rol en el sistema | Acceso |
|-------|-------------------|--------|
| **Administrador** | Propietario / gerente | Acceso total: reportes, auditoría, configuración, todas las vistas |
| **Operador** | Cajero / personal de piso | Dashboard operativo, check-in, POS, cierre de caja (restringido) |
| **Cliente (Padre/Tutor)** | Usuario final del servicio | Solo existe como registro en la DB; no accede al software |
| **Niño** | Beneficiario del servicio | Solo existe como registro en la DB |

### 1.3 Flujo de Valor (Journey del Cliente)

```
LLEGADA → CHECK-IN → PAGO/VENTA → SESIÓN ACTIVA → TIEMPO EXTRA (opcional) → SALIDA
                                                  ↓
                                          CORTE DE CAJA (al cierre de turno)
                                                  ↓
                                          AUDITORÍA ADMIN (revisión de corte)
```

### 1.4 Fuentes de Ingreso Modeladas

1. **Tiempo de juego** — Servicio principal (categoría `service`, `duration_min` definido)
2. **Gokarts** — Categoría especial con bandera `is_gokart: true` en sesiones
3. **Tren** — Atracción adicional (gestionada desde LiveMonitor)
4. **Snacks y bebidas** — Productos categoría `snack`, subcategorías: Bebidas / Snacks
5. **Calcetines antideslizantes** — Productos categoría `socks`, tallas M/G/L
6. **Tiempo extra (overtime)** — Cobro en fracciones configurables tras vencimiento

### 1.5 Métricas de Negocio Rastreadas

- Ventas totales por turno / día / semana / mes
- Sesiones activas en tiempo real (capacidad vs. aforo)
- Método de pago (efectivo vs. tarjeta)
- Diferencial de caja (efectivo contado vs. esperado)
- Visitas totales por familia (`total_visits`)
- Puntos de lealtad (`loyalty_points`)
- Stock de inventario vs. mínimos configurados
- Rendimiento por estación/terminal

---

## 2. ARQUITECTURA GENERAL DEL SISTEMA

### 2.1 Diagrama de Capas

```
┌─────────────────────────────────────────────────────────┐
│                   CAPA DE PRESENTACIÓN                   │
│              React 19 + TypeScript + Vite                │
│         Tailwind CSS v4 + shadcn/ui + lucide-react        │
├─────────────────────────────────────────────────────────┤
│                   CAPA DE ESTADO                          │
│                  Zustand Stores (8)                       │
│   auth • workstation • session • settings • theme         │
│   ui • cashSession • cartAction                           │
├─────────────────────────────────────────────────────────┤
│                   CAPA DE INTEGRACIÓN                     │
│              PocketBase JS SDK (pocketbase.ts)            │
│         Lib: cashSession • printer • download             │
│              inventoryLog • utils                         │
├─────────────────────────────────────────────────────────┤
│                   CAPA NATIVA (DESKTOP)                   │
│                    Tauri 2 (Rust)                          │
│     Plugins: fs • dialog • opener • window API           │
├─────────────────────────────────────────────────────────┤
│                   CAPA DE DATOS                           │
│               PocketBase (Backend/DB)                     │
│   SQLite embebido • REST API • Auth integrado             │
│              Auto-hospedado / Cloud                       │
├─────────────────────────────────────────────────────────┤
│               CAPA DE HARDWARE PERIFÉRICO                 │
│     Impresora Térmica (ZPL/Zebra) • Webcam               │
│         Lector de código de barras (HID)                  │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Modelo de Despliegue

```
[PC Windows con Tauri App]  ←→  [PocketBase Server]
         ↓                            ↓
   Impresora Zebra              SQLite Database
   Cámara USB                   (local o red)
   Lector Barcode
```

- El ejecutable es una **aplicación desktop nativa** empaquetada con Tauri
- No requiere navegador; tiene su propio runtime WebView
- PocketBase puede correr en el mismo PC o en un servidor en red local
- **Múltiples terminales** (workstations) comparten el mismo servidor PocketBase

### 2.3 Multi-Terminal

El sistema soporta operación **multi-estación**. Cada terminal:
1. Se identifica con un `workstationId` único (persistido en `localStorage`)
2. Verifica su estado al iniciar (handshake con PocketBase)
3. Tiene su propio tipo: `FULL_SERVICE`, `SNACK_ONLY`, o `TIME_ONLY`
4. Gestiona su propia sesión de caja (`cash_session`)

---

## 3. ESTRUCTURA DE CARPETAS Y ARCHIVOS

```
AstroPlay-System/
├── src/                              # Código fuente del frontend (React)
│   ├── main.tsx                      # Punto de entrada React DOM
│   ├── App.tsx                       # Router principal + Auth Guard
│   ├── App.css                       # Estilos raíz adicionales
│   ├── index.css                     # Sistema de design tokens (Tailwind v4)
│   │
│   ├── types/
│   │   └── index.ts                  # Todas las interfaces TypeScript del dominio
│   │
│   ├── lib/                          # Utilidades y servicios
│   │   ├── pocketbase.ts             # Cliente PocketBase singleton
│   │   ├── cashSession.ts            # Lógica de ciclo de vida de caja
│   │   ├── printer.ts                # Integración impresora térmica (ZPL)
│   │   ├── download.ts               # Export PDF/Excel (Tauri + browser)
│   │   ├── inventoryLog.ts           # Registro de movimientos de inventario
│   │   └── utils.ts                  # Helper cn() para Tailwind
│   │
│   ├── store/                        # Zustand state management
│   │   ├── auth.store.ts             # Autenticación
│   │   ├── workstation.store.ts      # Identidad de terminal
│   │   ├── session.store.ts          # Sesión padre/hijo activa
│   │   ├── settings.store.ts         # Configuración global
│   │   ├── theme.store.ts            # Tema dark/light
│   │   ├── ui.store.ts               # Estado UI (fullscreen)
│   │   ├── cashSession.store.ts      # Sesión de caja activa
│   │   └── cartAction.store.ts       # Acción pendiente en POS
│   │
│   ├── components/
│   │   ├── Login.tsx                 # Pantalla de login
│   │   ├── WorkstationSetup.tsx      # Selección de estación
│   │   ├── SecurityCheckIn.tsx       # Check-in biométrico de familias
│   │   ├── Dashboard.tsx             # (legacy/wrapper)
│   │   ├── ErrorBoundary.tsx         # Error boundary React
│   │   │
│   │   ├── admin/                    # Vistas exclusivas de administrador
│   │   │   ├── SettingsView.tsx      # Configuración global del sistema
│   │   │   ├── StationManager.tsx    # CRUD de estaciones de trabajo
│   │   │   ├── HardwareConfig.tsx    # Gestión de equipos/activos físicos
│   │   │   └── AdminAuditView.tsx    # Auditoría de cortes de caja
│   │   │
│   │   ├── dashboard/                # Vistas del dashboard operativo
│   │   │   ├── TimeDashboard.tsx     # Dashboard del operador (sesiones en tiempo real)
│   │   │   ├── LiveMonitor.tsx       # Monitor de flota para administrador
│   │   │   ├── SessionTimerCard.tsx  # Tarjeta de sesión con contador regresivo
│   │   │   ├── SessionActionBar.tsx  # Barra de acciones sobre sesión activa
│   │   │   ├── AdminPinModal.tsx     # Modal de PIN para acciones protegidas
│   │   │   ├── OvertimeSettlementModal.tsx # Modal de liquidación de tiempo extra
│   │   │   ├── CashCloseView.tsx     # Corte de caja (conteo ciego)
│   │   │   └── ReportsView.tsx       # Reportes e inteligencia de negocio
│   │   │
│   │   ├── inventory/                # Sistema de inventario y POS
│   │   │   ├── InventoryPOS.tsx      # Wrapper POS/Inventario con selector de vista
│   │   │   └── InventoryManagement.tsx # Gestión de stock y catálogo de productos
│   │   │
│   │   ├── layout/                   # Componentes de layout
│   │   │   ├── MainLayout.tsx        # Layout principal (TitleBar + Sidebar + Header + main)
│   │   │   ├── Sidebar.tsx           # Navegación lateral (colapsable por hover)
│   │   │   ├── Header.tsx            # Barra superior (reloj, tema, usuario)
│   │   │   └── TitleBar.tsx          # Barra de título Tauri custom (sin chrome nativo)
│   │   │
│   │   └── ui/                       # Componentes shadcn/ui reutilizables
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── input.tsx
│   │       ├── label.tsx
│   │       ├── dialog.tsx
│   │       ├── switch.tsx
│   │       ├── popover.tsx
│   │       └── DatePicker.tsx
│   │
│   └── assets/
│       └── react.svg
│
├── src-tauri/                        # Backend nativo Tauri (Rust)
│   ├── src/
│   │   ├── main.rs                   # Punto de entrada del ejecutable Tauri
│   │   └── lib.rs                    # Registro de plugins Tauri
│   ├── capabilities/
│   │   └── default.json              # Capacidades y permisos Tauri
│   ├── icons/                        # Iconos del ejecutable
│   ├── Cargo.toml                    # Dependencias Rust
│   └── tauri.conf.json               # Configuración Tauri (ventana, bundle)
│
├── index.html                        # HTML raíz (WebView entry)
├── vite.config.ts                    # Configuración Vite
├── tsconfig.json                     # Configuración TypeScript
├── package.json                      # Dependencias npm
├── components.json                   # Configuración shadcn/ui
├── .env                              # Variables de entorno (VITE_PB_URL)
└── .gitignore
```

---

## 4. ESQUEMA DE BASE DE DATOS

La base de datos es **PocketBase** (SQLite embebido con ORM propio y API REST automática).

### 4.1 Colecciones Identificadas

#### `users` (Auth collection nativa de PocketBase)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | PK auto-generado |
| `email` | string | Email de acceso |
| `name` | string | Nombre de display |
| `avatar` | file | Foto de perfil |
| `role` | enum | `'admin'` \| `'operator'` |

#### `parents` (Tutores / Guardianes)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | PK |
| `name` | string | Nombre completo |
| `email` | string? | Correo electrónico |
| `phone` | string? | Teléfono (10 dígitos validados) |
| `card_id` | string? | ID de tarjeta/barcode |
| `face_photo` | file? | Foto biométrica capturada con webcam |
| `loyalty_points` | number? | Puntos de lealtad acumulados |
| `total_visits` | number? | Contador de visitas históricas |
| `created` | datetime | Auto-generado |
| `updated` | datetime | Auto-generado |

#### `children` (Niños)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | PK |
| `name` | string | Nombre del niño |
| `birth_date` | string | Fecha de nacimiento |
| `parent` | relation → parents | FK al tutor |
| `allergies` | string? | Notas de alergias |
| `created` | datetime | Auto-generado |
| `updated` | datetime | Auto-generado |

#### `sessions` (Sesiones de Juego)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | PK |
| `parent` | relation → parents? | FK al tutor (opcional para ventas express) |
| `child` | relation[] → children? | FK múltiple a hijos |
| `sale` | relation → sales? | FK a la venta asociada |
| `status` | enum | `active` \| `finished` \| `overtime` \| `paused` \| `pending_settlement` |
| `operator` | relation → users? | FK al operador que creó |
| `start_time` | datetime | Inicio de sesión |
| `end_time` | datetime? | Fin de sesión |
| `is_paid` | boolean? | Si fue cobrada |
| `bracelet_color` | string? | Color del brazalete asignado |
| `is_gokart` | boolean? | Si es sesión de gokart |
| `paused_at` | datetime? | Timestamp de pausa |
| `remaining_seconds` | number? | Segundos restantes al pausar |
| `cancel_reason` | string? | Motivo de cancelación |

#### `products` (Catálogo de Productos)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | PK |
| `name` | string | Nombre del producto |
| `category` | enum? | `service` \| `snack` \| `socks` |
| `subcategory` | enum? | `Bebidas` \| `Snacks` |
| `duration_min` | number? | Duración en minutos (para servicios de tiempo) |
| `size` | enum? | `M` \| `G` \| `L` (para calcetines) |
| `price` | number | Precio de venta |
| `cost` | number? | Costo de adquisición |
| `stock` | number? | Unidades en existencia |
| `min_stock` | number? | Umbral mínimo para alerta |
| `imagen` | file? | Imagen del producto |
| `is_for_sale` | boolean? | Si está disponible en POS |

#### `sales` (Ventas)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | PK |
| `parent` | relation → parents? | FK al cliente |
| `total_amount` | number | Monto total de la venta |
| `payment_method` | enum? | `cash` \| `card` |
| `operator` | relation → users? | FK al operador |
| `workstation` | relation → workstations? | FK a la estación |
| `cash_session` | relation → cash_sessions? | FK a sesión de caja |

#### `sale_items` (Líneas de Venta)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | PK |
| `sale` | relation → sales? | FK a la venta padre |
| `product` | relation → products? | FK al producto |
| `quantity` | number? | Cantidad vendida |
| `unit_price` | number | Precio unitario al momento de venta |

#### `workstations` (Estaciones de Trabajo)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | PK |
| `name` | string | Nombre descriptivo (ej: "Caja 1") |
| `type` | enum? | `FULL_SERVICE` \| `SNACK_ONLY` \| `TIME_ONLY` |
| `is_active` | boolean? | Si la estación está habilitada |
| `printer_name` | string? | Nombre de la impresora asignada |

#### `cash_sessions` (Sesiones de Caja/Turno)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | PK |
| `operator` | relation → users | FK al operador responsable |
| `station` | relation → workstations? | FK a la estación |
| `opening_balance` | number? | Caja inicial al abrir |
| `sales_total` | number? | Total acumulado de ventas en el turno |
| `reported_cash` | number? | Efectivo contado por operador al cierre |
| `difference` | number? | `reported_cash - (opening_balance + sales_total)` |
| `status` | enum | `open` \| `closed` |
| `opened_at` | datetime? | Timestamp de apertura |
| `closed_at` | datetime? | Timestamp de cierre |
| `notes` | string? | Notas de discrepancia |
| `audit_status` | enum? | `pending` \| `verified` \| `disputed` |
| `audited_by` | relation → users? | FK al admin que auditó |
| `cash_retained` | number? | Efectivo dejado en caja para siguiente turno |
| `cash_withdrawn` | number? | Efectivo retirado/depositado |

#### `assets` (Activos / Equipos Físicos)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | PK |
| `name` | string | Nombre del activo (ej: "Gokart #3") |
| `type` | string? | Tipo de activo |
| `status` | enum | `available` \| `in_use` \| `maintenance` |
| `workstation` | relation → workstations? | Asignación a estación |
| `last_report` | string? | Último reporte de incidencia |

#### `inventory_logs` (Bitácora de Inventario)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | PK |
| `product` | relation → products | FK al producto |
| `quantity` | number | Cantidad del movimiento |
| `type` | enum | `purchase` \| `sale` \| `adjustment` \| `waste` |
| `operator` | relation → users | FK al operador que realizó el movimiento |

#### `settings` (Configuración Global — Singleton)
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | Siempre `pbcsettingsv002` (singleton) |
| `max_capacity` | number | Aforo máximo del parque |
| `grace_period` | number | Minutos de tolerancia al cierre de sesión |
| `fraction_size` | number | Tamaño de bloque para cobrar tiempo extra (minutos) |
| `fixed_opening_balance` | number | Monto base de apertura de caja |
| `require_admin_pin` | boolean | Si se requiere PIN admin para acciones sensibles |
| `require_signature` | boolean | Si se requiere firma digital en cierres |
| `is_cash_session_mandatory` | boolean | Si el TPV se bloquea sin sesión de caja abierta |

### 4.2 Diagrama de Relaciones

```
users
  ├── operator → sessions (created_by)
  ├── operator → sales (processed_by)
  ├── operator → cash_sessions (responsible)
  ├── operator → inventory_logs (author)
  └── audited_by → cash_sessions (reviewer)

parents
  ├── parent → sessions (has_sessions)
  ├── parent → children (has_children)
  └── parent → sales (has_purchases)

children
  └── child[] → sessions (participates_in)

sessions
  └── sale → sales (linked_to)

sales
  └── sale_items[] → products (contains)

cash_sessions
  └── cash_session → sales (contains_sales)

workstations
  ├── station → cash_sessions
  ├── workstation → sales
  └── workstation → assets
```

---

## 5. MODELO DE DATOS

### 5.1 Interfaces TypeScript Completas

```typescript
// src/types/index.ts

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'operator';
}

interface Parent {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  card_id?: string;
  face_photo?: string;
  loyalty_points?: number;
  total_visits?: number;
  created?: string;
  updated?: string;
}

interface Child {
  id: string;
  name: string;
  birth_date: string;
  parent: string; // FK
  allergies?: string;
  created?: string;
  updated?: string;
}

interface Session {
  id: string;
  parent?: string;
  child?: string[];
  sale?: string;
  status: 'active' | 'finished' | 'overtime' | 'paused' | 'pending_settlement';
  operator?: string;
  start_time: string;
  end_time?: string;
  is_paid?: boolean;
  bracelet_color?: string;
  is_gokart?: boolean;
  paused_at?: string;
  remaining_seconds?: number;
  cancel_reason?: string;
}

interface Product {
  id: string;
  name: string;
  category?: 'service' | 'snack' | 'socks';
  subcategory?: 'Bebidas' | 'Snacks';
  duration_min?: number;
  size?: 'M' | 'G' | 'L';
  price: number;
  cost?: number;
  stock?: number;
  min_stock?: number;
  imagen?: string;
  is_for_sale?: boolean;
}

interface Workstation {
  id: string;
  name: string;
  type?: 'FULL_SERVICE' | 'SNACK_ONLY' | 'TIME_ONLY';
  is_active?: boolean;
  printer_name?: string;
}

interface Sale {
  id: string;
  parent?: string;
  total_amount: number;
  payment_method?: 'cash' | 'card';
  operator?: string;
  workstation?: string;
  cash_session?: string;
}

interface SaleItem {
  id: string;
  sale?: string;
  product?: string;
  quantity?: number;
  unit_price: number;
}

interface Asset {
  id: string;
  name: string;
  type?: string;
  status: 'available' | 'in_use' | 'maintenance';
  workstation?: string;
  last_report?: string;
}

interface CashSession {
  id: string;
  operator: string;
  opening_balance?: number;
  sales_total?: number;
  reported_cash?: number;
  difference?: number;
  status: 'open' | 'closed';
  opened_at?: string;
  closed_at?: string;
  station?: string;
  notes?: string;
  audit_status?: 'pending' | 'verified' | 'disputed';
  audited_by?: string;
  cash_retained?: number;
  cash_withdrawn?: number;
}

interface InventoryLog {
  id: string;
  product: string;
  quantity: number;
  type: 'purchase' | 'sale' | 'adjustment' | 'waste';
  operator: string;
}

interface Settings {
  id: string;
  max_capacity: number;
  grace_period: number;
  fraction_size: number;
  fixed_opening_balance: number;
  require_admin_pin: boolean;
  require_signature: boolean;
  is_cash_session_mandatory: boolean;
}
```

---

## 6. GESTIÓN DE ESTADO

El sistema usa **Zustand** como gestor de estado global, con persistencia selectiva en `localStorage`.

### 6.1 Mapa de Stores

```
auth.store          → isValid, user, setAuth(), logout()
workstation.store   → workstationId, workstationName, workstationType
session.store       → activeParent, selectedChild[], sessionId, isFirstVisit
settings.store      → settings (global config), fetchSettings(), updateSettings()
theme.store         → theme ('dark'|'light'), toggleTheme()
ui.store            → isFullscreen, setFullscreen()
cashSession.store   → activeSession, loadSession(), openNewSession(), clearSession()
cartAction.store    → pendingAction (overtime/POS integration)
```

### 6.2 Persistencia

| Store | Persiste | Clave localStorage |
|-------|----------|--------------------|
| `auth.store` | `user` (no `isValid`) | `astroplay-auth` |
| `workstation.store` | `workstationId`, `name`, `type` | `workstation-storage` |
| `session.store` | No persiste | — |
| `settings.store` | No persiste | — |
| `theme.store` | `theme` | `theme-storage` |
| `cashSession.store` | Parcial | — |

### 6.3 Decisión de Seguridad en Auth Store

```typescript
// Al importarse el store, se limpia el token de PocketBase.
// Esto garantiza que aunque user esté en localStorage,
// isValid siempre arranca en false → fuerza login cada inicio.
pb.authStore.clear();
```

Este patrón asegura que aunque el dispositivo quede con una sesión persistida, **siempre se requiere volver a ingresar las credenciales** al abrir la app.

---

## 7. JERARQUÍA DE COMPONENTES UI

### 7.1 Árbol Completo de Componentes

```
<App>
├── [No autenticado]  → <Login>
├── [Sin estación]    → <WorkstationSetup>
└── [Autenticado + Estación]
    └── <MainLayout currentView onNavigate>
        ├── <TitleBar>
        │   ├── Botones: Minimizar, Maximizar, Cerrar
        │   └── Botón Pantalla Completa (F11)
        │
        ├── <Sidebar currentView onNavigate>
        │   ├── Logo AstroPlay OS
        │   ├── [FULL_SERVICE + todos los roles]
        │   │   ├── Dashboard
        │   │   ├── Reportes & BI        (solo admin)
        │   │   ├── Check-in
        │   │   ├── Punto de Venta
        │   │   ├── Inventario           (solo admin)
        │   │   ├── Corte de Caja
        │   │   └── Auditoría Cajas      (solo admin)
        │   ├── [SNACK_ONLY]
        │   │   ├── Punto de Venta
        │   │   └── Inventario           (solo admin)
        │   ├── [TIME_ONLY]
        │   │   ├── Dashboard
        │   │   └── Punto de Venta
        │   └── [Admin únicamente - parte inferior]
        │       ├── Configuración
        │       ├── Gestión de Estaciones
        │       └── Configuración de Hardware
        │
        ├── <Header>
        │   ├── Reloj en tiempo real
        │   ├── Toggle dark/light theme
        │   └── Info usuario (nombre, rol)
        │
        └── <main> [Vista activa]
            │
            ├── 'dashboard' (admin)  → <LiveMonitor>
            │   ├── Tab: Playground  → Grid de SessionTimerCards (no-gokart)
            │   ├── Tab: Gokarts     → Grid de SessionTimerCards (gokart)
            │   ├── Tab: Tren        → Gestión atracción tren
            │   ├── Tab: BI          → Paneles de inteligencia de negocio
            │   └── Tab: CRM         → Datos de clientes
            │
            ├── 'dashboard' (operador) → <TimeDashboard>
            │   ├── Tab: Monitor     → Sesiones activas con contadores
            │   └── Tab: Assets      → Estado y reporte de equipos
            │
            ├── 'checkin'  → <SecurityCheckIn>
            │   ├── Búsqueda padre (typeahead + debounce 350ms)
            │   ├── Lector de barcode (entrada HID)
            │   ├── Captura biométrica (react-webcam)
            │   ├── Selección/registro de hijos
            │   ├── Picker de fecha de nacimiento
            │   └── Creación de sesión en PocketBase
            │
            ├── 'pos'      → <InventoryPOS view="pos">
            │   ├── Grid de productos (filtrado por tipo de estación)
            │   ├── Carrito de compras
            │   ├── Selector método de pago (efectivo/tarjeta)
            │   ├── Calculadora de cambio
            │   └── Impresión de ticket
            │
            ├── 'inventory' → <InventoryPOS view="inventory">
            │   └── <InventoryManagement>
            │       ├── Lista de productos con stock
            │       ├── CRUD de productos
            │       └── Alertas de stock mínimo
            │
            ├── 'reports'  → <ReportsView>
            │   ├── Filtros: rango de fechas (Hoy/Ayer/7 días/Mes/Custom)
            │   ├── Filtro por estación
            │   ├── KPIs: ventas totales, sesiones, ticket promedio
            │   ├── Tabla de ventas (paginada, 10 por página)
            │   ├── Detalle de venta (line items)
            │   └── Export: PDF (jsPDF + autoTable) y Excel (ExcelJS)
            │
            ├── 'cashclose' → <CashCloseView>
            │   ├── Balance apertura
            │   ├── Ventas del turno
            │   ├── Conteo ciego (campo reported_cash)
            │   ├── Diferencial calculado
            │   ├── Split: retenido vs. retirado
            │   └── Campo de notas
            │
            ├── 'audits'   → <AdminAuditView>
            │   ├── Lista de cortes cerrados
            │   ├── Filtros por operador/fecha/estado
            │   └── Acciones: Verificar / Disputar
            │
            ├── 'settings' (admin) → <SettingsView>
            │   ├── Sección: Identidad de Caja (Workstation)
            │   ├── Sección: Capacidad y General
            │   ├── Sección: Reglas Financieras y Tiempo Extra
            │   └── Sección: Seguridad y Verificación
            │
            ├── 'stations' (admin) → <StationManager>
            │   └── CRUD de workstations
            │
            └── 'hardware' (admin) → <HardwareConfig>
                └── Gestión de activos físicos
```

### 7.2 Componentes Reutilizables Clave

| Componente | Uso | Ubicación |
|------------|-----|-----------|
| `SessionTimerCard` | Tarjeta de sesión activa con countdown | `dashboard/` |
| `SessionActionBar` | Barra de acciones sobre sesión | `dashboard/` |
| `OvertimeSettlementModal` | Modal de cobro por tiempo extra | `dashboard/` |
| `AdminPinModal` | Modal de confirmación con PIN | `dashboard/` |
| `DatePicker` | Selector de fechas custom | `ui/` |
| `Button`, `Card`, `Input`, etc. | shadcn base components | `ui/` |

---

## 8. CONTROL DE ACCESO Y SEGURIDAD

### 8.1 Niveles de Acceso

```
ADMIN
  └── Acceso completo a todas las vistas
  └── Ve LiveMonitor en dashboard
  └── Puede acceder: Settings, StationManager, HardwareConfig, AdminAuditView
  └── Ve: Reportes, Inventario, Auditoría
  └── SNACK_ONLY admin: POS + Inventario

OPERATOR
  └── Dashboard (TimeDashboard), Check-in, POS, Corte de Caja
  └── FULL_SERVICE: NO accede a Inventario, Reportes, Auditoría
  └── SNACK_ONLY: Solo POS
  └── TIME_ONLY: Dashboard + POS
```

### 8.2 Guardias en App.tsx

```typescript
// Guard 1: Autenticación
if (!isValid) return <Login />;

// Guard 2: Workstation
if (!workstationId) return <WorkstationSetup />;

// Guard 3: Rol en rutas
case 'settings':
  return user?.role === 'admin' ? <SettingsView /> : <TimeDashboard />;
```

### 8.3 Handshake de Workstation

Al iniciar, el app verifica contra PocketBase que la estación sigue activa:
```typescript
const record = await pb.collection('workstations').getOne(workstationId);
if (!record.is_active) clearWorkstation(); // Fuerza re-setup
```

### 8.4 Seguridad de Sesión de Caja

- **Una sola sesión abierta** por operador+estación simultáneamente
- Las ventas requieren una sesión de caja activa (si `is_cash_session_mandatory = true`)
- El cierre requiere conteo ciego (blind count) — el sistema no muestra el total esperado al operador
- La auditoría posterior la realiza el admin de forma independiente

### 8.5 PIN Administrador

El setting `require_admin_pin` habilita una capa extra de confirmación para:
- Cancelar sesiones
- Aplicar descuentos
- Acceder a funciones sensibles

### 8.6 Autenticación PocketBase

- PocketBase gestiona la autenticación con tokens JWT internamente
- El token se limpia al importar `auth.store.ts` (cada inicio de app)
- El campo `isValid` nunca se persiste — siempre requiere login activo

---

## 9. FLUJOS OPERATIVOS COMPLETOS

### 9.1 Flujo de Apertura de Turno

```
1. Operador abre la aplicación
2. Login (email + password → PocketBase auth)
3. Selección de workstation (si no está en localStorage)
   └── Handshake: verifica que la estación esté activa en DB
4. Si is_cash_session_mandatory = true:
   └── Sistema detecta que no hay sesión de caja abierta
   └── Solicita abrir sesión de caja
   └── Muestra balance recomendado (cash_retained de sesión anterior)
   └── Operador confirma monto de apertura
   └── Se crea registro en cash_sessions con status = 'open'
5. Dashboard operativo disponible
```

### 9.2 Flujo de Check-in de Familia

```
1. Operador va a vista "Check-in"
2. BÚSQUEDA DE PADRE:
   a. Busca por nombre (typeahead, debounce 350ms, mínimo 2 chars)
   b. O escanea barcode/tarjeta (lectura HID → card_id)
   c. O registra nuevo padre:
      - Nombre (requerido)
      - Teléfono (10 dígitos, validado)
      - Email (opcional)
      - Foto biométrica (webcam, requerida)
3. SELECCIÓN DE NIÑOS:
   a. Se muestran hijos del padre (si existen)
   b. Selecciona uno o más hijos existentes
   c. O registra nuevo hijo:
      - Nombre
      - Fecha de nacimiento (DatePicker)
      - Alergias (opcional)
4. Selección del SERVICIO (producto tipo 'service')
5. CONFIRMACIÓN:
   a. Se crea/actualiza registro parent
   b. Se crean registros children (si son nuevos)
   c. Se crea session: { status: 'active', start_time: now, parent, child[] }
   d. Se imprime brazalete (ZPL → impresora Zebra)
   e. Navegación automática al POS para procesar el pago
```

### 9.3 Flujo de Sesión Activa (TimeDashboard)

```
TimeDashboard → Tab "Monitor"
  ├── Polling/realtime de sessiones con status = 'active'
  ├── Para cada sesión: <SessionTimerCard>
  │   ├── Muestra: nombre del niño, color de brazalete, tiempo restante
  │   ├── Countdown regresivo (actualización cada 1000ms)
  │   └── Acciones disponibles:
  │       ├── PAUSAR → session.status = 'paused', guarda remaining_seconds
  │       ├── REANUDAR → session.status = 'active', restaura countdown
  │       ├── EXTENDER → abre OvertimeSettlementModal
  │       └── FINALIZAR → session.status = 'finished', session.end_time = now
  │
  └── OVERTIME:
      ├── Sesión vence → status = 'overtime'
      ├── Aparece <OvertimeSettlementModal>
      ├── Operador selecciona paquete adicional
      └── Se procesa como venta en POS → cartAction.store
```

### 9.4 Flujo de Venta en POS

```
InventoryPOS (view="pos")
  ├── Grid de productos (filtrado por workstation type)
  │   ├── FULL_SERVICE: services + snacks + socks
  │   ├── SNACK_ONLY: solo snacks + socks
  │   └── TIME_ONLY: solo services
  ├── Click en producto → agrega al carrito
  ├── Carrito: editar cantidades, eliminar ítems
  ├── Seleccionar método de pago:
  │   ├── Efectivo: captura monto → calcula cambio
  │   └── Tarjeta: monto directo
  ├── PROCESAR:
  │   a. Crea registro sale { total_amount, payment_method, operator, workstation, cash_session }
  │   b. Crea sale_items por cada producto
  │   c. Descuenta stock de cada producto
  │   d. Crea inventory_log type='sale' por cada ítem
  │   e. incrementSessionSales(cashSessionId, total_amount)
  │   f. Si hay sesión vinculada: sale.id → session.sale
  │   g. Imprime ticket (opcional)
  └── Notificación de éxito
```

### 9.5 Flujo de Corte de Caja

```
CashCloseView
  ├── Muestra: apertura, ventas acumuladas, total esperado
  ├── Operador ingresa conteo ciego (reported_cash)
  │   └── NO ve el total esperado hasta confirmar
  ├── Ingresa: notas, cash_retained, cash_withdrawn
  ├── CERRAR TURNO:
  │   a. difference = reported_cash - (opening_balance + sales_total)
  │   b. status = 'closed', closed_at = now
  │   c. audit_status = 'pending'
  └── Admin posteriormente audita en AdminAuditView
      ├── Revisa detalle de ventas
      ├── Marca: 'verified' o 'disputed'
      └── Si 'disputed': abre investigación
```

### 9.6 Flujo del Monitor de Flota (Admin — LiveMonitor)

```
LiveMonitor
  ├── Tab PLAYGROUND: todas las sesiones activas no-gokart
  ├── Tab GOKARTS: sesiones con is_gokart = true
  │   └── Métricas de capacidad de flota
  ├── Tab TREN: gestión de la atracción de tren
  ├── Tab BI: dashboards de negocio
  └── Tab CRM: datos de familias, visitas, lealtad
```

---

## 10. MÓDULOS ADMINISTRATIVOS

### 10.1 StationManager — Gestión de Terminales

Permite al admin:
- **Crear** nuevas estaciones de trabajo con nombre, tipo y estado
- **Editar** propiedades (nombre, tipo, activa/inactiva, impresora)
- **Desactivar** una estación (el handshake la desacopla de cualquier PC)
- **Eliminar** (si no tiene cash_sessions asociadas)

Tipos de estación:
| Tipo | Uso previsto |
|------|-------------|
| `FULL_SERVICE` | Caja principal con tiempo + POS completo |
| `SNACK_ONLY` | Barra de snacks / kiosco |
| `TIME_ONLY` | Terminal solo para sesiones de tiempo (sin POS de consumibles) |

### 10.2 HardwareConfig — Activos Físicos

Gestión de equipos en el parque:
- Gokarts (por número/nombre)
- Trenes
- Otros equipos
- Estado: disponible / en uso / mantenimiento
- Reporte de incidencias desde TimeDashboard (Tab "Assets")

### 10.3 SettingsView — Configuración Master

Parámetros globales (afectan a todas las terminales):

| Parámetro | Efecto Operativo |
|-----------|-----------------|
| `max_capacity` | Umbral de advertencia de aforo en LiveMonitor |
| `grace_period` | Minutos de tolerancia antes de marcar overtime |
| `fraction_size` | Unidad de cobro de tiempo extra (ej: 15 min = $X) |
| `fixed_opening_balance` | Monto sugerido al abrir caja |
| `require_admin_pin` | Bloquea acciones críticas sin PIN |
| `require_signature` | Firma digital en cierres de caja |
| `is_cash_session_mandatory` | Bloquea TPV sin turno abierto |

La configuración usa un **patrón singleton**: existe exactamente un registro con ID `pbcsettingsv002`.

---

## 11. SISTEMA FINANCIERO

### 11.1 Ciclo de Vida de la Caja

```
APERTURA → VENTAS (acumulación) → CIERRE (conteo ciego) → AUDITORÍA
  open         sales_total++         reported_cash           verified/disputed
```

### 11.2 Fórmula de Diferencial

```
diferencia = efectivo_contado - (apertura + ventas_totales)

Positivo (+) → sobrante (posible cobro sin registrar)
Negativo (-) → faltante (posible error o fraude)
```

### 11.3 Handover de Caja

Al abrir un turno, el sistema consulta la última sesión cerrada de esa estación para proponer el `cash_retained` como nueva apertura:

```typescript
getNextOpeningBalance(stationId)
  → lastSession.cash_retained ?? 1000 (default)
```

### 11.4 Estados de Auditoría

| Estado | Significado |
|--------|-------------|
| `pending` | Corte cerrado, esperando revisión admin |
| `verified` | Admin confirmó cuadre correcto |
| `disputed` | Admin marcó discrepancia para investigar |

---

## 12. SISTEMA DE REPORTES

### 12.1 Módulo ReportsView

**Datos consultados:**
- `sales` (con expand de `parent`, `workstation`)
- `sale_items` (con expand de `product`, `sale`)
- `sessions`
- `products` (para alertas de stock bajo)
- `workstations` (para filtro)

**Filtros disponibles:**
- Rango de fecha: Hoy / Ayer / Últimos 7 días / Mes Actual / Rango Custom
- Por estación (workstation)
- Búsqueda por texto

**Lógica de "día de negocio":**
El sistema usa corte a las 5:00 AM. Si la hora actual es antes de las 5 AM, se toma como "día de negocio" anterior. Esto permite que turnos nocturnos se registren correctamente en el día de apertura.

**KPIs mostrados:**
- Total vendido en el período
- Número de sesiones
- Ticket promedio por venta
- Desglose efectivo vs. tarjeta

**Exportación:**
- **PDF**: jsPDF + jspdf-autotable (tablas con autoformat)
- **Excel**: ExcelJS (workbooks con múltiples sheets)
- En app Tauri: usa diálogo nativo de guardado (`tauri-plugin-dialog`)
- En browser: blob download HTML5

---

## 13. INTEGRACIÓN DE HARDWARE

### 13.1 Impresora Térmica (Wristbands)

Protocolo: **ZPL (Zebra Programming Language)**
Función: `triggerWristbandPrint(data: WristbandData)`

Contenido impreso:
- Nombre del niño
- Nombre del padre/tutor
- Barcode (session ID)
- Indicadores de tiempo (inicio/fin estimado)
- Color de brazalete asignado

La impresión se dispara automáticamente al completar el check-in.

### 13.2 Cámara Web (Biométrico)

Librería: `react-webcam`
Uso: Captura de foto facial del padre/tutor durante el registro
La foto se almacena como archivo en PocketBase (campo `face_photo` en `parents`)

### 13.3 Lector de Código de Barras

Tipo: HID (emula teclado)
Se captura via eventos de teclado en el campo `card_id` del formulario de check-in
Permite búsqueda rápida de clientes recurrentes por su tarjeta de lealtad

### 13.4 Tauri File System

El plugin `tauri-plugin-fs` permite:
- Leer/escribir archivos locales
- Export de reportes con diálogo de guardado nativo
- No requiere servidor web para descarga

### 13.5 Ventana Tauri Configurada

```json
{
  "title": "AstroPlay OS",
  "width": 1280,
  "height": 800,
  "minWidth": 900,
  "minHeight": 600,
  "decorations": false,   // Sin barra de título nativa del OS
  "transparent": false,
  "center": true,
  "resizable": true
}
```

La app usa su propia `<TitleBar>` custom con soporte de pantalla completa (F11).

---

## 14. CONFIGURACIÓN GLOBAL

### 14.1 Variables de Entorno

```env
# .env
VITE_PB_URL=http://localhost:8090   # URL del servidor PocketBase
```

### 14.2 Configuración Vite/Tauri

- **devUrl**: `http://localhost:1420`
- **beforeDevCommand**: `npm run dev`
- **beforeBuildCommand**: `tsc && vite build`
- **frontendDist**: `../dist`

### 14.3 PocketBase Colección Settings (Singleton Pattern)

```typescript
// settings.store.ts — siempre usa este ID fijo
const SETTINGS_RECORD_ID = 'pbcsettingsv002';
```

Si el registro no existe, se crean valores por defecto:
```typescript
{
  max_capacity: 50,
  grace_period: 5,
  fraction_size: 15,
  fixed_opening_balance: 1000,
  require_admin_pin: false,
  require_signature: false,
  is_cash_session_mandatory: false,
}
```

---

## 15. STACK TÉCNICO DETALLADO

### 15.1 Dependencias Frontend (package.json)

| Paquete | Versión | Propósito |
|---------|---------|-----------|
| `react` | ^19.1.0 | UI framework |
| `react-dom` | ^19.1.0 | DOM renderer |
| `@tauri-apps/api` | ^2 | APIs nativas Tauri |
| `@tauri-apps/plugin-dialog` | ^2.6.0 | Diálogos nativos |
| `@tauri-apps/plugin-fs` | ^2.4.5 | File system nativo |
| `@tauri-apps/plugin-opener` | ^2 | Abrir archivos/URLs |
| `pocketbase` | ^0.26.8 | Cliente DB/Auth |
| `zustand` | ^5.0.11 | State management |
| `lucide-react` | ^0.574.0 | Íconos SVG |
| `jspdf` | ^4.2.0 | Generación PDF |
| `jspdf-autotable` | ^5.0.7 | Tablas en PDF |
| `exceljs` | ^4.4.0 | Generación Excel |
| `react-webcam` | ^7.2.0 | Captura cámara |
| `class-variance-authority` | ^0.7.1 | Variantes CSS |
| `clsx` | ^2.1.1 | Merge de clases |
| `tailwind-merge` | ^3.5.0 | Merge Tailwind |
| `radix-ui` | ^1.4.3 | Primitivos UI accesibles |
| `tailwindcss-animate` | ^1.0.7 | Animaciones Tailwind |

### 15.2 DevDependencias

| Paquete | Propósito |
|---------|-----------|
| `vite` ^7.0.4 | Build tool y dev server |
| `typescript` ~5.8.3 | Type checking |
| `@vitejs/plugin-react` ^4.6.0 | Plugin React para Vite |
| `@tailwindcss/vite` ^4.2.0 | Integración Tailwind v4 |
| `tailwindcss` ^4.1.18 | Framework CSS |
| `shadcn` ^3.8.5 | CLI de componentes |
| `tw-animate-css` ^1.4.0 | Animaciones adicionales |
| `@tauri-apps/cli` ^2 | CLI de Tauri |

### 15.3 Dependencias Rust (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-dialog = "2"
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### 15.4 Sistema de Temas (Design System)

El sistema usa **CSS Custom Properties con oklch color space** (perceptual color model):

```css
/* Light mode */
:root {
  --background: oklch(1 0 0);               /* Blanco */
  --foreground: oklch(0.129 0.042 264.695); /* Slate oscuro */
  --primary: oklch(0.208 0.042 265.755);    /* Azul primario */
  --destructive: oklch(0.577 0.245 27.325); /* Rojo error */
}

/* Dark mode */
.dark {
  --background: oklch(0.129 0.042 264.695); /* Slate oscuro */
  --foreground: oklch(0.984 0.003 247.858); /* Blanco cálido */
}
```

Variables de radio:
```css
--radius-sm: calc(var(--radius) - 4px)
--radius-md: calc(var(--radius) - 2px)
--radius-lg: var(--radius)
--radius-xl: calc(var(--radius) + 4px)
```

---

## 16. VARIABLES DE ENTORNO Y CONFIGURACIÓN

### 16.1 .env (Frontend Vite)

```env
VITE_PB_URL=http://[host]:[puerto]
```

Esta URL apunta al servidor PocketBase. Puede ser:
- `http://localhost:8090` — desarrollo local
- `http://192.168.x.x:8090` — servidor en red local (multi-terminal)
- `https://[dominio]` — PocketBase en servidor cloud

### 16.2 Identificador de la App

```json
"identifier": "com.sosad.astroplay-system"
```

Usado para el bundle del ejecutable nativo Windows/Mac.

---

## 17. ANÁLISIS DE RIESGOS Y ÁREAS DE MEJORA

### 17.1 Puntos Fuertes Identificados

- **Arquitectura modular**: stores separados por dominio, componentes bien organizados
- **Seguridad de sesión**: `isValid` nunca persiste, token se borra al iniciar
- **Control multi-terminal**: handshake verificado en cada arranque
- **Conteo ciego en caja**: reduce riesgo de manipulación por operadores
- **Auditoría separada**: admin audita independientemente sin contaminar el cierre
- **Tipos estrictos**: TypeScript en toda la capa frontend
- **Exportación dual**: PDF y Excel con descarga nativa en Tauri
- **Día de negocio a las 5 AM**: lógica correcta para operaciones nocturnas

### 17.2 Áreas de Atención Técnica

| Área | Observación |
|------|-------------|
| **CSP nula** | `"csp": null` en tauri.conf.json — sin Content Security Policy |
| **Router simple** | `currentView` con `switch` en App.tsx; sin router real (react-router) |
| **Sin tests** | No hay suite de pruebas (unitarias, integración o e2e) |
| **PocketBase realtime** | No usa subscriptions realtime de PocketBase (polling manual) |
| **Settings singleton** | ID hardcodeado `pbcsettingsv002` — frágil si se elimina el registro |
| **Lógica en componentes** | Parte de la lógica de negocio está dentro de componentes React |
| **Sin offline support** | Dependencia total de PocketBase en red |

### 17.3 Dependencias Clave del Negocio

```
PocketBase (DOWN) → Sistema completamente no operativo
Impresora (DOWN)  → Check-in sin brazaletes (impacto operativo alto)
Red local (DOWN)  → Multi-terminal no funciona
```

### 17.4 Escalabilidad

El sistema está diseñado para **una ubicación** con múltiples terminales.
Para escalar a múltiples ubicaciones requeriría:
- PocketBase en servidor cloud o por ubicación
- Federación o multi-tenant (no implementado actualmente)

---

## RESUMEN EJECUTIVO

**AstroPlay System** es una aplicación de escritorio nativa (Tauri + React) diseñada específicamente para gestionar la operación de un parque de entretenimiento infantil. El sistema cubre de forma integral:

| Área | Funcionalidad |
|------|--------------|
| **Operativa** | Check-in biométrico, sesiones de tiempo real, control de overtime, POS completo |
| **Financiera** | Sesiones de caja con conteo ciego, diferencial, retención y auditoría |
| **Administrativa** | CRUD de estaciones, configuración global, gestión de activos |
| **Analítica** | Reportes filtrados, export PDF/Excel, KPIs de ventas y sesiones |
| **CRM** | Registro de familias, historial de visitas, puntos de lealtad |
| **Control de acceso** | Roles admin/operador con restricciones por tipo de terminal |

El stack tecnológico es moderno y apropiado para el caso de uso (desktop offline-first con backend local), y la arquitectura de código refleja buenas prácticas de separación de responsabilidades.

---

*Documento generado automáticamente a partir del análisis del código fuente — AstroPlay-System v0.1.0*
*Fecha: Marzo 2026*
