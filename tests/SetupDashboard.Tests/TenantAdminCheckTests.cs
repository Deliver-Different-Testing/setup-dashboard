using System.Text.Json.Nodes;
using Microsoft.Extensions.Caching.Memory;
using SetupDashboard.Services;
using SetupDashboard.Services.TenantApps;

namespace SetupDashboard.Tests;

public class TenantAdminCheckTests
{
    private static FakeApps Permissions(params string[] keys)
        => new() { Respond = c => ApiResult.Success(c.App, 200, new JsonArray([.. keys.Select(k => (JsonNode)JsonValue.Create(k)!)])) };

    private static TenantAdminCheck Check(FakeApps apps) => new(apps, new MemoryCache(new MemoryCacheOptions()));

    [Fact]
    public async Task Tenant_staff_with_edit_settings_are_tenant_admins()
    {
        var apps = Permissions("manage-users", "edit-settings");

        Assert.True(await Check(apps).IsTenantAdminAsync(Make.Caller(clientTypeId: 4), CancellationToken.None));
        var call = Assert.Single(apps.Calls);
        Assert.Equal((TenantApp.Settings, "GET", "/api/me/permissions"), (call.App, call.Method, call.Path));
    }

    [Fact]
    public async Task Tenant_staff_without_edit_settings_are_not()
        => Assert.False(await Check(Permissions("manage-users")).IsTenantAdminAsync(Make.Caller(clientTypeId: 4), CancellationToken.None));

    [Fact]
    public async Task Customers_are_never_tenant_admins_and_Settings_is_not_asked()
    {
        var apps = Permissions("edit-settings");

        Assert.False(await Check(apps).IsTenantAdminAsync(Make.Caller(clientTypeId: 2), CancellationToken.None));
        Assert.Empty(apps.Calls);
    }

    [Fact]
    public async Task Settings_failing_means_no()
    {
        var apps = new FakeApps { Respond = c => ApiResult.Fail(c.App, 500, "boom") };

        Assert.False(await Check(apps).IsTenantAdminAsync(Make.Caller(clientTypeId: 4), CancellationToken.None));
    }

    [Fact]
    public async Task The_answer_is_cached_per_person()
    {
        var apps = Permissions("edit-settings");
        var check = Check(apps);

        await check.IsTenantAdminAsync(Make.Caller(clientTypeId: 4), CancellationToken.None);
        await check.IsTenantAdminAsync(Make.Caller(clientTypeId: 4), CancellationToken.None);

        Assert.Single(apps.Calls);
    }
}
