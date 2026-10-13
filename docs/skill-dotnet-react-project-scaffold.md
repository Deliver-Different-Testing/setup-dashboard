# Skill: Scaffold a .NET 8 + React 19 Web Application

Use this skill when asked to create a new web application, internal tool, or dashboard from scratch. This defines the standard project structure, tooling, and patterns.

---

## Prerequisites — What Must Be Installed

Before scaffolding, confirm the developer's machine has:

| Tool | Version | Purpose | Install |
|------|---------|---------|---------|
| **Visual Studio 2022** | 17.8+ | Primary IDE, F5 debugging, solution management | VS Installer |
| **.NET 8 SDK** | 8.0.x | Backend runtime + CLI (`dotnet` commands) | dotnet.microsoft.com |
| **Node.js** | 20 LTS+ | Frontend build toolchain | nodejs.org |
| **npm** | 10+ | Frontend package manager (ships with Node) | (bundled) |
| **SQL Server** | 2019+ | Database (can be LocalDB, Express, or full) | SQL Server downloads |
| **SSMS** or **Azure Data Studio** | Latest | Database management GUI | Microsoft downloads |
| **Git** | 2.40+ | Version control | git-scm.com |

### Optional (add when needed)

| Tool | When to add |
|------|-------------|
| **Redis** (local or cloud) | When you need distributed caching or session persistence across restarts |
| **Docker Desktop** | When you need containerized deployment |
| **AWS CLI** | When deploying to AWS (ECS, SSM, S3) |
| **GitLab Runner** | When setting up CI/CD pipelines locally |

---

## Server Environment

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Web Server** | Kestrel (built into .NET 8) | No IIS needed in dev. Use reverse proxy (nginx/ALB) in prod |
| **Database** | SQL Server | EF Core code-first. Use `[Table]` attributes to map to existing tables |
| **Cache** | Redis (optional) | Falls back to in-memory `IDistributedCache` in dev |
| **Cloud** | AWS | SSM for secrets, ECS/Fargate for containers, S3 for storage |
| **CI/CD** | GitLab CI | Docker build + push to registry + deploy |
| **Container** | Docker | Multi-stage build: .NET SDK → runtime image |
| **Source Control** | Git + GitLab | Feature branches, merge requests |

---

## Project Types This Covers

- Internal dashboards and admin tools
- Wizard/onboarding flows
- Data import/export tools
- CRUD apps with SQL Server backend
- Multi-step forms with session state
- Apps that need to call external REST APIs

---

## Step 1: Create the Solution

```bash
mkdir MyProject && cd MyProject

# Create .NET solution and API project
dotnet new sln -n MyProject
dotnet new webapi -n MyProject.Api
dotnet sln add MyProject.Api/MyProject.Api.csproj

# Create React frontend at solution root
npm create vite@latest . -- --template react-ts

# Install standard frontend dependencies
npm install react-router-dom zustand lucide-react
npm install -D @tailwindcss/vite tailwindcss
```

### Result

```
MyProject/
├── MyProject.sln                       # Open this in Visual Studio
├── MyProject.Api/                      # .NET 8 Web API
│   ├── MyProject.Api.csproj            # NuGet refs + MSBuild frontend targets
│   ├── Program.cs                      # DI, middleware, EF Core
│   ├── appsettings.json                # Config (logging, CORS)
│   ├── appsettings.Development.json    # Dev overrides
│   ├── Properties/launchSettings.json  # Dev env vars, ports
│   ├── Controllers/                    # API endpoints
│   ├── Core/Domain/                    # EF Core layer
│   │   ├── Entities/                   # POCO classes
│   │   └── AppDbContext.cs             # DbContext
│   ├── Models/                         # Request/response DTOs
│   ├── Services/                       # Business logic
│   └── wwwroot/                        # Built frontend (auto-generated)
├── src/                                # React 19 source
│   ├── App.tsx                         # Root component
│   ├── main.tsx                        # Entry point
│   ├── store.ts                        # Zustand state management
│   ├── lib/api.ts                      # All API calls (one file)
│   ├── components/                     # UI components
│   └── index.css                       # Tailwind imports
├── package.json                        # Frontend dependencies
├── vite.config.ts                      # Build config + dev proxy
├── tsconfig.json                       # TypeScript config
├── CLAUDE.md                           # AI assistant instructions
└── changes.log                         # Change documentation
```

---

## Step 2: Configure the .csproj

The .csproj does three things beyond a normal API project:
1. **Shows frontend files** in Visual Studio Solution Explorer (but excludes them from .NET compilation)
2. **Auto-builds the frontend** via MSBuild pre-build target (`npm install` + `npm run build`)
3. **Includes built frontend** in `dotnet publish` output

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>MyProject</RootNamespace>
    <SpaRoot>..\</SpaRoot>
  </PropertyGroup>

  <ItemGroup>
    <!-- EF Core + SQL Server -->
    <PackageReference Include="Microsoft.EntityFrameworkCore" Version="8.0.10" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="8.0.10" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Tools" Version="8.0.10">
      <IncludeAssets>runtime; build; native; contentfiles; analyzers; buildtransitive</IncludeAssets>
      <PrivateAssets>all</PrivateAssets>
    </PackageReference>

    <!-- Logging -->
    <PackageReference Include="Serilog.AspNetCore" Version="8.0.3" />
    <PackageReference Include="Serilog.Settings.Configuration" Version="8.0.4" />
    <PackageReference Include="Serilog.Sinks.Console" Version="6.0.0" />

    <!-- Health checks -->
    <PackageReference Include="Microsoft.Extensions.Diagnostics.HealthChecks" Version="8.0.10" />
  </ItemGroup>

  <!-- Show frontend files in Solution Explorer -->
  <ItemGroup>
    <None Include="$(SpaRoot)**"
          Exclude="$(SpaRoot)node_modules\**;$(SpaRoot)dist\**" />
  </ItemGroup>
  <ItemGroup>
    <Content Remove="$(SpaRoot)**" />
  </ItemGroup>

  <!-- Pre-build: npm install + build frontend into wwwroot -->
  <Target Name="NpmBuild" BeforeTargets="Build"
          Condition="!Exists('wwwroot\my-app\index.html')
                     Or '$(BuildingInsideVisualStudio)' == ''">
    <Exec WorkingDirectory="$(SpaRoot)" Command="npm install --prefer-offline --no-audit" />
    <Exec WorkingDirectory="$(SpaRoot)" Command="npm run build" />
  </Target>

  <!-- Publish: always rebuild frontend -->
  <Target Name="PublishSpa" AfterTargets="ComputeFilesToPublish">
    <Exec WorkingDirectory="$(SpaRoot)" Command="npm install" />
    <Exec WorkingDirectory="$(SpaRoot)" Command="npm run build" />
    <ItemGroup>
      <DistFiles Include="wwwroot\my-app\**" />
      <ResolvedFileToPublish Include="@(DistFiles->'%(FullPath)')"
                             Exclude="@(ResolvedFileToPublish)">
        <RelativePath>wwwroot\my-app\%(DistFiles.RecursiveDir)%(DistFiles.Filename)%(DistFiles.Extension)</RelativePath>
        <CopyToPublishDirectory>PreserveNewest</CopyToPublishDirectory>
      </ResolvedFileToPublish>
    </ItemGroup>
  </Target>

</Project>
```

Replace `my-app` with your app's URL slug everywhere.

### Add more NuGet packages as needed

| Package | When |
|---------|------|
| `Microsoft.Data.SqlClient` | Direct SQL queries outside EF Core |
| `Microsoft.Extensions.Caching.StackExchangeRedis` | Redis caching |
| `AspNetCore.HealthChecks.SqlServer` | SQL health probes |
| `CsvHelper` | CSV import/export |
| `ClosedXML` | Excel read/write |
| `FuzzySharp` | Fuzzy string matching |
| `FluentValidation.AspNetCore` | Request validation |
| `Amazon.AspNetCore.DataProtection.SSM` | AWS key storage (prod) |

---

## Step 3: Configure Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/my-app/',
  build: {
    outDir: 'MyProject.Api/wwwroot/my-app',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5200',
    },
  },
})
```

Three things must align:
- `base` here → `MapFallbackToFile` path in Program.cs → `outDir` folder name

---

## Step 4: Program.cs

```csharp
using Microsoft.EntityFrameworkCore;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    var builder = WebApplication.CreateBuilder(args);

    // Serilog
    builder.Host.UseSerilog((ctx, lc) => lc
        .ReadFrom.Configuration(ctx.Configuration)
        .WriteTo.Console());

    // Controllers + camelCase JSON
    builder.Services.AddControllers()
        .AddJsonOptions(opts => {
            opts.JsonSerializerOptions.PropertyNamingPolicy =
                System.Text.Json.JsonNamingPolicy.CamelCase;
            opts.JsonSerializerOptions.DefaultIgnoreCondition =
                System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
        });

    // CORS — allow React dev server
    var corsOrigins = builder.Configuration
        .GetSection("CorsOrigins").Get<string[]>()
        ?? new[] { "http://localhost:5173" };
    builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
        p.WithOrigins(corsOrigins)
         .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

    // EF Core
    var connString = builder.Configuration.GetConnectionString("Default")
        ?? Environment.GetEnvironmentVariable("SQLConnection")
        ?? "Server=(localdb)\\mssqllocaldb;Database=MyProjectDb;Trusted_Connection=True;";
    builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlServer(connString));

    // Health checks
    builder.Services.AddHealthChecks();

    // Register your services:
    // builder.Services.AddScoped<IMyService, MyService>();

    var app = builder.Build();

    app.UseSerilogRequestLogging();
    app.UseCors();

    // Global error handler
    app.Use(async (ctx, next) => {
        try { await next(); }
        catch (KeyNotFoundException ex) {
            ctx.Response.StatusCode = 404;
            await ctx.Response.WriteAsJsonAsync(new { message = ex.Message });
        }
        catch (Exception ex) {
            Log.Error(ex, "Unhandled exception");
            ctx.Response.StatusCode = 500;
            await ctx.Response.WriteAsJsonAsync(new { message = ex.Message });
        }
    });

    app.UseStaticFiles();
    app.MapControllers();
    app.MapHealthChecks("/healthz");

    // SPA fallback
    app.MapFallbackToFile("my-app/index.html");

    app.Run();
}
catch (Exception ex) { Log.Fatal(ex, "Application terminated"); }
finally { Log.CloseAndFlush(); }
```

---

## Step 5: Database Layer

### Entity POCO

One file per entity (or group related ones). Use `[Table]` to map to the real table name. Only include the columns you need.

```csharp
// Core/Domain/Entities/Customer.cs
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MyProject.Core.Domain.Entities;

[Table("tbl_Customer")]
public class Customer
{
    [Key]
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? Code { get; set; }
    public string? Email { get; set; }
    public bool? Active { get; set; }
}
```

### DbContext

Only register DbSets for entities your app uses. Don't scaffold the full database.

```csharp
// Core/Domain/AppDbContext.cs
using Microsoft.EntityFrameworkCore;
using MyProject.Core.Domain.Entities;

namespace MyProject.Core.Domain;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public virtual DbSet<Customer> Customers { get; set; }
}
```

---

## Step 6: Controller

```csharp
// Controllers/CustomerController.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyProject.Core.Domain;

namespace MyProject.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CustomerController : ControllerBase
{
    private readonly AppDbContext _db;
    public CustomerController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var items = await _db.Customers.Where(c => c.Active == true).ToListAsync();
        return Ok(new { customers = items });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _db.Customers.FindAsync(id);
        if (item == null) return NotFound();
        return Ok(item);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Customer customer)
    {
        _db.Customers.Add(customer);
        await _db.SaveChangesAsync();
        return Ok(new { id = customer.Id });
    }
}
```

---

## Step 7: Frontend

### api.ts — One file, one function per endpoint

```typescript
// src/lib/api.ts
const BASE = import.meta.env.VITE_API_URL || '/api'

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.statusText)
  return res.json()
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.statusText)
  return res.json()
}

export const getCustomers = () => get('/customer')
export const createCustomer = (data: unknown) => post('/customer', data)
```

### store.ts — Zustand, empty defaults, load from API

```typescript
// src/store.ts
import { create } from 'zustand'
import * as api from './lib/api'

interface AppState {
  customers: any[]
  loading: boolean
  loadCustomers: () => Promise<void>
}

export const useStore = create<AppState>((set) => ({
  customers: [],       // Start empty, load from API
  loading: false,

  loadCustomers: async () => {
    set({ loading: true })
    try {
      const res = await api.getCustomers()
      set({ customers: res.customers ?? [] })
    } finally {
      set({ loading: false })
    }
  },
}))
```

---

## Step 8: Environment Config

### launchSettings.json

```json
{
  "profiles": {
    "MyProject.Api": {
      "commandName": "Project",
      "launchBrowser": true,
      "launchUrl": "my-app/",
      "applicationUrl": "https://localhost:7200;http://localhost:5200",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development",
        "SQLConnection": "Server=YOUR_SERVER;Database=YOUR_DB;User Id=YOUR_USER;Password=YOUR_PASS;TrustServerCertificate=True"
      }
    }
  }
}
```

### appsettings.json

```json
{
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft": "Warning",
        "Microsoft.AspNetCore": "Warning"
      }
    },
    "WriteTo": [{ "Name": "Console" }]
  },
  "CorsOrigins": ["http://localhost:5173"],
  "AllowedHosts": "*"
}
```

---

## How a Developer Works With This

### Option A: Visual Studio (simplest)
1. Open `MyProject.sln` in Visual Studio 2022
2. Press **F5**
3. MSBuild auto-runs `npm install` + `npm run build`
4. .NET starts, browser opens to `https://localhost:7200/my-app/`
5. Done — both backend and frontend are running

### Option B: Two terminals (frontend hot reload)
1. Terminal 1: `cd MyProject.Api && dotnet run` → backend on port 5200
2. Terminal 2: `npm run dev` → Vite dev server on port 5173 with hot reload
3. Open `http://localhost:5173/my-app/`
4. React changes reload instantly, API calls proxy to .NET via Vite

### Adding a new feature
1. Add entity POCO in `Core/Domain/Entities/`
2. Add `DbSet` to `AppDbContext.cs`
3. Add controller with endpoints
4. Add function in `src/lib/api.ts`
5. Add state/action in `src/store.ts`
6. Build component in `src/components/`

---

## Files Checklist

Create in this order when starting a new project:

| # | File | Purpose |
|---|------|---------|
| 1 | `MyProject.sln` | VS solution |
| 2 | `MyProject.Api/MyProject.Api.csproj` | NuGet packages + MSBuild frontend targets |
| 3 | `MyProject.Api/Program.cs` | DI container, middleware, EF Core |
| 4 | `MyProject.Api/appsettings.json` | Logging config, CORS origins |
| 5 | `MyProject.Api/Properties/launchSettings.json` | Dev ports + env vars (DB connection etc.) |
| 6 | `MyProject.Api/Core/Domain/Entities/*.cs` | POCO entity classes |
| 7 | `MyProject.Api/Core/Domain/AppDbContext.cs` | EF Core DbContext |
| 8 | `MyProject.Api/Controllers/*.cs` | API endpoints |
| 9 | `MyProject.Api/Models/*.cs` | Request/response DTOs |
| 10 | `MyProject.Api/Services/*.cs` | Business logic |
| 11 | `package.json` | Frontend deps |
| 12 | `vite.config.ts` | Build output dir + dev proxy |
| 13 | `tsconfig.json` | TypeScript config |
| 14 | `src/main.tsx` | React entry point |
| 15 | `src/App.tsx` | Root component |
| 16 | `src/lib/api.ts` | API client |
| 17 | `src/store.ts` | Zustand state |
| 18 | `CLAUDE.md` | AI assistant instructions |
| 19 | `changes.log` | Change history |

---

## Rules

1. **Visual Studio 2022** is the primary IDE. The solution must open, build, and F5-debug without extra setup steps.
2. **Frontend lives at solution root**, not inside the API project. The `.csproj` uses `<SpaRoot>..\</SpaRoot>` to find it.
3. **MSBuild builds the frontend** automatically. Developer should never need to manually run `npm run build` for F5 to work.
4. **Three paths must match**: Vite `base`, Vite `outDir` folder name, and `MapFallbackToFile` in Program.cs.
5. **Vite dev proxy**: In dev, Vite proxies `/api` to the .NET backend port so no CORS issues during hot reload.
6. **Entity POCOs are slim** — only map the tables and columns you actually use. Don't scaffold the entire database.
7. **One `api.ts` file** — every API call is an exported function. No scattered `fetch()` calls in components.
8. **Store starts empty** — never hardcode demo or placeholder data. Load real data from the API on init.
9. **Controllers return `Ok(new { ... })`** — anonymous objects, camelCase via the JSON config in Program.cs.
10. **`changes.log`** — document every significant change with what and why.

---

## If Porting from Node.js Express

| Express | .NET 8 |
|---------|--------|
| `express.Router()` | `[ApiController]` + `[Route("api/...")]` |
| `req.body` | `[FromBody]` parameter |
| `req.query` | `[FromQuery]` parameter |
| `req.params.id` | Route parameter `{id}` |
| `req.file` (multer) | `IFormFile` parameter |
| `res.json({ ... })` | `return Ok(new { ... })` |
| `res.status(404).json()` | `return NotFound(new { ... })` |
| `express-session` | Custom `ISessionStore` or ASP.NET session |
| `better-sqlite3` / Knex | EF Core `DbContext` |
| `axios` | `HttpClient` / `IHttpClientFactory` |
| `cors()` | `builder.Services.AddCors()` |
| `dotenv` | `launchSettings.json` env vars |
| PapaParse | CsvHelper NuGet |
| xlsx (npm) | ClosedXML NuGet |

### Steps
1. Keep old code in `_legacy/` as read-only reference
2. Create entity POCOs matching the SQL tables
3. Port routes to controllers (keep same URL patterns)
4. Port services to C# classes
5. Frontend usually stays unchanged — just update API base URL
