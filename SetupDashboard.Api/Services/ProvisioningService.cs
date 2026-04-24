using SetupDashboard.Models;

namespace SetupDashboard.Services;

/// <summary>
/// Pushes wizard data to Admin Manager API.
/// Endpoints and payloads ported from Mike's legacy Node backend:
///   team.ts         → POST /api/user
///   client-import.ts → POST /api/client
///   courier-setup.ts → POST /api/courier + POST /api/agent
///   zone-setup.ts    → POST /api/zoneGroup + POST /api/zoneName
///   rate-setup.ts    → POST /api/rateCard + /api/breakGroup + /API/fuel
///   automations.ts   → POST /api/automationRules
/// </summary>
public class ProvisioningService
{
    private readonly AdminManagerClientFactory _clientFactory;
    private readonly ILogger<ProvisioningService> _logger;

    public ProvisioningService(AdminManagerClientFactory clientFactory, ILogger<ProvisioningService> logger)
    {
        _clientFactory = clientFactory;
        _logger = logger;
    }

    // --- Users ---
    // POST /API/User → UserCreateRequest { UserName, FullName, Password, UserGroupId, Active, InternetAccess }
    // Note: Mike's legacy code sent { name, email, role, active } which doesn't match the DTO — was silently failing.
    public async Task<ProvisionResult> ProvisionUsersAsync(string envKey, List<TeamMember> team, List<int>? alreadyProvisioned = null, string? cookieHeader = null)
    {
        var result = new ProvisionResult();
        try
        {
            var client = _clientFactory.GetClient(envKey);
            if (!client.IsInitialized)
            {
                await EnsureAuthenticated(client, envKey, cookieHeader);
                if (!client.IsInitialized)
                {
                    result.Errors.Add("Users: Admin Manager not authenticated. Ensure the user is logged in via Hub (shared cookie is forwarded automatically).");
                    return result;
                }
            }

            // Resolve UserGroupId from role name via GET /API/UserGroup
            // Response is wrapped: { success, userGroups: [{ id, name, ... }] }
            Dictionary<string, int>? groupMap = null;
            try
            {
                var json = await client.GetRawAsync("/API/UserGroup");
                var doc = System.Text.Json.JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("userGroups", out var groupsArr))
                {
                    groupMap = new(StringComparer.OrdinalIgnoreCase);
                    foreach (var g in groupsArr.EnumerateArray())
                    {
                        var name = g.TryGetProperty("name", out var n) ? n.GetString() : null;
                        var gid = g.TryGetProperty("id", out var idProp) && idProp.TryGetInt32(out var id) ? id : 0;
                        if (!string.IsNullOrEmpty(name) && gid > 0)
                            groupMap[name] = gid;
                    }
                    _logger.LogInformation("Loaded {Count} user groups", groupMap.Count);
                }
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Could not fetch user groups, using default groupId=1"); }

            for (int i = 0; i < team.Count; i++)
            {
                if (alreadyProvisioned != null && i < alreadyProvisioned.Count) continue;
                var m = team[i];
                try
                {
                    var userGroupId = 1;
                    if (groupMap != null && !string.IsNullOrEmpty(m.Role))
                    {
                        groupMap.TryGetValue(m.Role, out userGroupId);
                        if (userGroupId == 0) userGroupId = 1;
                    }

                    var response = await client.PostAsync<Dictionary<string, object>>("/API/User", new
                    {
                        userName = m.Email,
                        fullName = m.Name,
                        password = Guid.NewGuid().ToString("N")[..12] + "!A1",
                        userGroupId,
                        active = true,
                        internetAccess = true,
                    });
                    var id = ExtractId(response);
                    if (id > 0) result.CreatedIds.Add(id);
                    result.Succeeded++;
                }
                catch (Exception ex)
                {
                    result.Failed++;
                    var msg = ex.Message;
                    if (msg.Contains("UNIQUE KEY", StringComparison.OrdinalIgnoreCase) ||
                        msg.Contains("duplicate key", StringComparison.OrdinalIgnoreCase) ||
                        msg.Contains("IX_tblUser_FullName", StringComparison.OrdinalIgnoreCase))
                    {
                        result.Errors.Add($"User '{m.Name}' ({m.Email}): A user with this name already exists. Please use a different name.");
                    }
                    else
                    {
                        result.Errors.Add($"User '{m.Name}' ({m.Email}): {msg}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not provision users to Admin Manager");
        }
        return result;
    }

    // --- Clients ---
    // POST /API/Client → ClientCreateRequest { Name, Code, LegalName, Phone, Email, Type, SmsName, AmericanCity, AmericanState, AmericanZipCode, AddressStreetName, DisplayAddress, ReferralSource, DropOffReport, Active }
    // Fields match Mike's legacy client-import.ts
    public async Task<ProvisionResult> ProvisionClientsAsync(string envKey, List<ClientRecord> clients, List<int>? alreadyProvisioned = null, string? cookieHeader = null)
    {
        var result = new ProvisionResult();
        try
        {
            var client = _clientFactory.GetClient(envKey);
            if (!client.IsInitialized)
            {
                await EnsureAuthenticated(client, envKey, cookieHeader);
                if (!client.IsInitialized)
                {
                    result.Errors.Add("Clients: Admin Manager not authenticated. Ensure the user is logged in via Hub (shared cookie is forwarded automatically).");
                    return result;
                }
            }

            for (int i = 0; i < clients.Count; i++)
            {
                if (alreadyProvisioned != null && i < alreadyProvisioned.Count) continue;
                var c = clients[i];
                try
                {
                    var response = await client.PostAsync<Dictionary<string, object>>("/api/client", new
                    {
                        name = c.Name,
                        code = c.Code ?? c.Name.Replace(" ", "").ToUpper()[..Math.Min(10, c.Name.Length)],
                        legalName = c.LegalName ?? c.Name,
                        phone = c.Phone ?? "",
                        email = c.Email ?? "",
                        type = c.Type ?? "Standard",
                        smsName = c.Name.Length > 20 ? c.Name[..20] : c.Name,
                        americanCity = c.City ?? "Unknown",
                        americanState = c.State ?? "NY",
                        americanZipCode = c.ZipCode ?? "10001",
                        addressStreetName = c.Address ?? "123 Main St",
                        displayAddress = c.Address ?? c.Name,
                        referralSource = 1,
                        dropOffReport = "Standard",
                        active = true,
                    });
                    var id = ExtractId(response);
                    if (id > 0) result.CreatedIds.Add(id);
                    result.Succeeded++;
                }
                catch (Exception ex)
                {
                    result.Failed++;
                    var msg = ex.Message;
                    if (msg.Contains("UNIQUE KEY", StringComparison.OrdinalIgnoreCase) ||
                        msg.Contains("duplicate key", StringComparison.OrdinalIgnoreCase))
                    {
                        result.Errors.Add($"Client '{c.Name}': A client with this name or code already exists.");
                    }
                    else
                    {
                        result.Errors.Add($"Client '{c.Name}': {msg}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not provision clients to Admin Manager");
        }
        return result;
    }

    // --- Couriers ---
    // POST /API/Courier → CourierCreateRequest { Code, FirstName, SurName, PersonalMobile, Email, Password, CourierType(int), Active }
    // POST /API/Agent   → AgentCreateRequest { Name, Phone }
    public async Task<ProvisionResult> ProvisionCouriersAsync(string envKey, List<CourierRecord> couriers, List<int>? alreadyProvisioned = null, string? cookieHeader = null)
    {
        var result = new ProvisionResult();
        try
        {
            var client = _clientFactory.GetClient(envKey);
            if (!client.IsInitialized)
            {
                await EnsureAuthenticated(client, envKey, cookieHeader);
                if (!client.IsInitialized)
                {
                    result.Errors.Add("Couriers: Admin Manager not authenticated. Ensure the user is logged in via Hub (shared cookie is forwarded automatically).");
                    return result;
                }
            }

            for (int i = 0; i < couriers.Count; i++)
            {
                if (alreadyProvisioned != null && i < alreadyProvisioned.Count) continue;
                var c = couriers[i];
                try
                {
                    var nameParts = c.Name.Split(' ');
                    var firstName = c.FirstName ?? nameParts.ElementAtOrDefault(0) ?? c.Name;
                    var surName = c.SurName ?? (nameParts.Length > 1 ? string.Join(" ", nameParts.Skip(1)) : "Driver");

                    // 1. Create courier (CourierCreateRequest — no 'Name' field, uses FirstName/SurName)
                    var courierResp = await client.PostAsync<Dictionary<string, object>>("/API/Courier", new
                    {
                        code = c.Code ?? c.Name.Replace(" ", "").ToUpper()[..Math.Min(10, c.Name.Length)],
                        firstName,
                        surName,
                        personalMobile = c.Phone ?? "",
                        email = c.Email ?? $"{firstName.ToLower()}@driver.local",
                        password = c.Password ?? "Driver123!",
                        courierType = 1,
                        active = true,
                    });
                    var courierId = ExtractId(courierResp);
                    if (courierId > 0) result.CreatedIds.Add(courierId);

                    // 2. Create agent for dispatch assignment (AgentCreateRequest)
                    try
                    {
                        await client.PostAsync<Dictionary<string, object>>("/API/Agent", new
                        {
                            name = c.Name,
                            phone = c.Phone ?? "",
                        });
                    }
                    catch (Exception agentEx)
                    {
                        _logger.LogWarning(agentEx, "Agent creation failed for courier {Name}, continuing", c.Name);
                    }

                    result.Succeeded++;
                }
                catch (Exception ex)
                {
                    result.Failed++;
                    var msg = ex.Message;
                    if (msg.Contains("UNIQUE KEY", StringComparison.OrdinalIgnoreCase) ||
                        msg.Contains("duplicate key", StringComparison.OrdinalIgnoreCase))
                    {
                        result.Errors.Add($"Courier '{c.Name}': A courier with this name already exists.");
                    }
                    else
                    {
                        result.Errors.Add($"Courier '{c.Name}': {msg}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not provision couriers to Admin Manager");
        }
        return result;
    }

    // --- Zones ---
    // POST /api/zoneName → ZoneNameCreateRequest { Name }  (lowercase route — ZoneNameController uses api/[controller])
    public async Task<ProvisionResult> ProvisionZonesAsync(string envKey, List<ZoneRateRow> zones, List<int>? alreadyProvisioned = null, string? cookieHeader = null)
    {
        var result = new ProvisionResult();
        try
        {
            var client = _clientFactory.GetClient(envKey);
            if (!client.IsInitialized)
            {
                await EnsureAuthenticated(client, envKey, cookieHeader);
                if (!client.IsInitialized)
                {
                    result.Errors.Add("Zones: Admin Manager not authenticated. Ensure the user is logged in via Hub (shared cookie is forwarded automatically).");
                    return result;
                }
            }

            for (int i = 0; i < zones.Count; i++)
            {
                if (alreadyProvisioned != null && i < alreadyProvisioned.Count) continue;
                var z = zones[i];
                try
                {
                    var response = await client.PostAsync<Dictionary<string, object>>("/api/zoneName", new
                    {
                        name = z.Name,
                    });
                    var id = ExtractId(response);
                    if (id > 0) result.CreatedIds.Add(id);
                    result.Succeeded++;
                }
                catch (Exception ex)
                {
                    result.Failed++;
                    var msg = ex.Message;
                    if (msg.Contains("UNIQUE KEY", StringComparison.OrdinalIgnoreCase) ||
                        msg.Contains("duplicate key", StringComparison.OrdinalIgnoreCase))
                    {
                        result.Errors.Add($"Zone '{z.Name}': A zone with this name already exists.");
                    }
                    else
                    {
                        result.Errors.Add($"Zone '{z.Name}': {msg}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not provision zones to Admin Manager");
        }
        return result;
    }

    // --- Rates ---
    // POST /API/RateCard → RateCardCreateRequest { Name, Active }
    // POST /API/Fuel     → FuelCreateRequest { Start(DateTime), Rate(decimal), Active }
    public async Task<ProvisionResult> ProvisionRatesAsync(string envKey, RateConfig rates, Dictionary<string, List<int>>? provisionedIds = null, string? cookieHeader = null)
    {
        var result = new ProvisionResult();
        try
        {
            var client = _clientFactory.GetClient(envKey);
            if (!client.IsInitialized)
            {
                await EnsureAuthenticated(client, envKey, cookieHeader);
                if (!client.IsInitialized)
                {
                    result.Errors.Add("Rates: Admin Manager not authenticated. Ensure the user is logged in via Hub (shared cookie is forwarded automatically).");
                    return result;
                }
            }

            // 1. Create rate card
            try
            {
                await client.PostAsync<object>("/api/rateCard", new
                {
                    name = "Default Rate Card",
                    active = true,
                });
                result.Succeeded++;
            }
            catch (Exception ex)
            {
                result.Errors.Add($"Rate card: {ex.Message}");
            }

            // 2. Create fuel surcharge via /API/fuel
            if (rates.FuelSurcharge > 0)
            {
                try
                {
                    await client.PostAsync<object>("/API/fuel", new
                    {
                        start = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                        rate = rates.FuelSurcharge / 100m, // percentage to decimal
                        active = true,
                    });
                    result.Succeeded++;
                }
                catch (Exception ex)
                {
                    result.Errors.Add($"Fuel surcharge: {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not provision rates to Admin Manager");
        }
        return result;
    }

    // --- Automations ---
    // POST /API/AutomationRules → AutomationRuleCreateRequest { Name, Description, Conditions, Actions }
    public async Task<ProvisionResult> ProvisionAutomationsAsync(string envKey, List<Models.SetupAutomationRule> rules, List<int>? alreadyProvisioned = null, string? cookieHeader = null)
    {
        var result = new ProvisionResult();
        try
        {
            var client = _clientFactory.GetClient(envKey);
            if (!client.IsInitialized)
            {
                await EnsureAuthenticated(client, envKey, cookieHeader);
                if (!client.IsInitialized)
                {
                    result.Errors.Add("Automations: Admin Manager not authenticated. Ensure the user is logged in via Hub (shared cookie is forwarded automatically).");
                    return result;
                }
            }

            for (int i = 0; i < rules.Count; i++)
            {
                if (alreadyProvisioned != null && i < alreadyProvisioned.Count) continue;
                var r = rules[i];
                if (!r.Enabled) continue;
                try
                {
                    var response = await client.PostAsync<Dictionary<string, object>>("/api/automationRules", new
                    {
                        name = r.Name ?? $"{r.Type} Rule",
                        description = r.Description ?? "",
                        conditions = r.Conditions ?? new List<object> { new { type = r.Type, jobTypeFilter = "ALL" } },
                        actions = r.Actions ?? new List<object> { new { type = "CREATE_EVENT", eventMessage = $"{r.Type} triggered" } },
                    });
                    var id = ExtractId(response);
                    if (id > 0)
                    {
                        result.CreatedIds.Add(id);

                        // Toggle off if not enabled (legacy pattern: create enabled, then toggle off)
                        if (!r.Enabled)
                        {
                            try { await client.PostAsync<object>($"/api/automationRules/{id}/toggle", new { }); }
                            catch { /* best effort */ }
                        }
                    }
                    result.Succeeded++;
                }
                catch (Exception ex)
                {
                    result.Failed++;
                    var msg = ex.Message;
                    if (msg.Contains("UNIQUE KEY", StringComparison.OrdinalIgnoreCase) ||
                        msg.Contains("duplicate key", StringComparison.OrdinalIgnoreCase))
                    {
                        result.Errors.Add($"Automation '{r.Name}': An automation with this name already exists.");
                    }
                    else
                    {
                        result.Errors.Add($"Automation '{r.Name}': {msg}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not provision automations to Admin Manager");
        }
        return result;
    }

    private async Task EnsureAuthenticated(AdminManagerClient client, string envKey, string? cookieHeader = null)
    {
        // First try: forward the user's shared Hub cookie + validate session
        if (!string.IsNullOrEmpty(cookieHeader))
        {
            var domain = Environment.GetEnvironmentVariable("Domain") ?? "";
            await client.LoadCookiesFromRequestAsync(cookieHeader, domain);
            if (client.IsInitialized) return;
        }

        // Fallback: auto-login with DFRNT credentials (same as legacy Node backend)
        var username = Environment.GetEnvironmentVariable("DFRNT_USERNAME");
        var password = Environment.GetEnvironmentVariable("DFRNT_PASSWORD");
        if (!string.IsNullOrEmpty(username) && !string.IsNullOrEmpty(password))
        {
            _logger.LogInformation("Attempting auto-login for environment {Env}", envKey);
            await client.LoginAsync(username, password);
        }
    }

    private static int ExtractId(Dictionary<string, object>? response)
    {
        if (response == null) return 0;
        // Check "id" and "Id" (legacy pattern from Mike's extractId)
        foreach (var key in new[] { "id", "Id" })
        {
            if (response.TryGetValue(key, out var idObj))
            {
                if (idObj is System.Text.Json.JsonElement je && je.TryGetInt32(out var id))
                    return id;
                if (int.TryParse(idObj?.ToString(), out var parsed))
                    return parsed;
            }
        }
        // Check nested objects (legacy pattern: sometimes ID is in a nested response object)
        foreach (var val in response.Values)
        {
            if (val is System.Text.Json.JsonElement nested && nested.ValueKind == System.Text.Json.JsonValueKind.Object)
            {
                if (nested.TryGetProperty("id", out var nestedId) && nestedId.TryGetInt32(out var nid))
                    return nid;
                if (nested.TryGetProperty("Id", out var nestedId2) && nestedId2.TryGetInt32(out var nid2))
                    return nid2;
            }
        }
        return 0;
    }
}

public class ProvisionResult
{
    public int Succeeded { get; set; }
    public int Failed { get; set; }
    public List<int> CreatedIds { get; set; } = new();
    public List<string> Errors { get; set; } = new();
}
